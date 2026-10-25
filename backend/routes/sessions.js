import express from 'express';
import { inTransaction } from '../db.js';
import { authenticate, authorizeAdmin } from '../middleware/authenticate.js';
import { tenantScope } from '../middleware/tenantScope.js';
import logger from '../logger.js';
import { logAudit } from '../utils/auditLogger.js';
import { startSessionSchema, endSessionSchema } from '../schemas/sessionSchema.js';
import { validate } from '../middleware/validate.js';
import { HttpError, sendHttpError } from '../utils/httpError.js';
import { computeExpectedCash, countOpenOrders, countOpenChecks } from '../utils/session.js';
import { fireDueTakeaway, announceKitchenOrder } from '../utils/takeawayDb.js';
import { applyServiceStartPortions } from '../utils/inventory/portionsDb.js';
import { getTenantModules } from '../utils/tenantModules.js';

const router = express.Router();

export default function (broadcast) {

  router.get('/', authenticate, tenantScope, async (req, res) => {
    try {
      const { rows } = await req.db.query('SELECT * FROM sessions ORDER BY start_time DESC');
      res.json(rows);
    } catch (err) {
      logger.error({ err }, 'Errore GET /api/sessions');
      res.status(500).json({ error: 'Errore caricamento sessioni' });
    }
  });

  router.get('/latest', authenticate, tenantScope, async (req, res) => {
    try {
      const { rows } = await req.db.query('SELECT * FROM sessions ORDER BY start_time DESC LIMIT 1');
      res.json(rows[0] || null);
    } catch (err) {
      logger.error({ err }, 'Errore GET /api/sessions/latest');
      res.status(500).json({ error: 'Errore caricamento sessione' });
    }
  });

  // GET /expected-cash — totale atteso (solo contanti) della sessione aperta, con gli ordini ancora aperti
  // (non contano nel totale: alla chiusura l'admin decide se completarli)
  router.get('/expected-cash', authenticate, tenantScope, async (req, res) => {
    try {
      const { rows } = await req.db.query('SELECT id FROM sessions WHERE end_time IS NULL');
      if (!rows.length) return res.json({ expected: 0, openOrders: 0, openOrdersTotal: 0, openChecks: 0, openChecksTotal: 0 });
      const open = await countOpenOrders(req.db, rows[0].id);
      const checks = await countOpenChecks(req.db, rows[0].id);
      res.json({ expected: await computeExpectedCash(req.db, rows[0].id), openOrders: open.count, openOrdersTotal: open.total, openChecks: checks.count, openChecksTotal: checks.total });
    } catch (err) {
      logger.error({ err }, 'Errore GET /api/sessions/expected-cash');
      res.status(500).json({ error: 'Errore calcolo del totale atteso' });
    }
  });

  // POST /start — apre la sessione e riparte con disponibilità illimitata:
  // si presume che i prodotti siano stati riforniti, lo stock va reimpostato se serve.
  router.post('/start', authenticate, authorizeAdmin, validate({ body: startSessionSchema }), tenantScope, async (req, res) => {
    try {
      const session = await inTransaction(req.db, async (db) => {
        const { rows } = await db.query(
          'INSERT INTO sessions (name, start_time) VALUES ($1, NOW()) RETURNING *',
          [req.body.name]
        );
        // Le porzioni dei piatti ripartono secondo la loro regola (utils/inventory/portions.js): di norma tornano illimitate.
        // I piatti nascosti perché esauriti tornano visibili; quelli nascosti a mano dall'admin restano nascosti.
        const tenant = await getTenantModules(req.user.tenantId);
        await applyServiceStartPortions(db, { rulesEnabled: !!tenant?.inventory });
        return rows[0];
      });

      await logAudit(req.db, req.user.id, 'START_SESSION', { sessionId: session.id, sessionName: session.name });

      if (broadcast) broadcast(req.user.tenantId, { type: 'session_started', session });
      // Gli asporti accettati nei giorni scorsi con ritiro per oggi nascono adesso in cucina (e scalano lo stock appena ripartito)
      try {
        const fired = await fireDueTakeaway(req.db, { tenantId: req.user.tenantId, userId: req.user.id });
        fired.forEach(({ created, row }) => announceKitchenOrder(broadcast, req.user.tenantId, created, row, row.pickup_at));
      } catch (err) {
        logger.error({ err }, 'Errore avvio asporti di oggi (la serata è comunque aperta)');
      }
      res.json(session);
    } catch (err) {
      // uniq_sessions_open_per_tenant: esiste già una sessione aperta
      if (err.code === '23505') return res.status(409).json({ error: 'Esiste già una sessione attiva' });
      logger.error({ err }, 'Errore POST /api/sessions/start');
      res.status(500).json({ error: "Errore durante l'apertura della sessione" });
    }
  });

  // POST /end — chiude la sessione con il conto cassa.
  // Il lock sulla sessione mette in attesa gli ordini in arrivo: o entrano nel
  // totale atteso, o trovano la sessione chiusa e vengono rifiutati.
  router.post('/end', authenticate, authorizeAdmin, validate({ body: endSessionSchema }), tenantScope, async (req, res) => {
    const declared = req.body.declaredCash ?? null;
    const { openOrders } = req.body;

    try {
      const result = await inTransaction(req.db, async (db) => {
        const { rows: active } = await db.query('SELECT id FROM sessions WHERE end_time IS NULL FOR UPDATE');
        if (!active.length) return null;

        // I conti dei tavoli aperti bloccano la chiusura: i soldi non sono stati incassati e non c'è una scelta "lascia fuori".
        const openChecks = await countOpenChecks(db, active[0].id);
        if (openChecks.count > 0)
          throw new HttpError(409, `Ci sono ${openChecks.count} conti aperti: incassali o annullali prima di chiudere il servizio`, 'OPEN_CHECKS');

        // Gli ordini ancora aperti non entrano nei conti: o l'admin li completa, o restano fuori.
        const open = await countOpenOrders(db, active[0].id);
        if (open.count > 0 && !openOrders)
          throw new HttpError(409, `Ci sono ${open.count} ordini non completati: scegli se completarli o lasciarli fuori`, 'OPEN_ORDERS');
        let completedOrders = 0;
        if (open.count > 0 && openOrders === 'complete') {
          const { rowCount } = await db.query(
            `UPDATE orders SET status = 'completed', completed_at = COALESCE(completed_at, now())
             WHERE session_id = $1 AND check_id IS NULL AND status IN ('pending', 'preparing')`,
            [active[0].id]
          );
          completedOrders = rowCount;
        }

        const expectedCash = await computeExpectedCash(db, active[0].id);
        const { rows } = await db.query(
          `UPDATE sessions SET end_time = NOW(), expected_cash = $1, declared_cash = $2
           WHERE id = $3 RETURNING *`,
          [expectedCash, declared, active[0].id]
        );
        return { session: rows[0], expectedCash, completedOrders, leftOpen: openOrders === 'leave' ? open.count : 0 };
      });
      if (!result) return res.json(null);

      const { session, expectedCash, completedOrders, leftOpen } = result;
      await logAudit(req.db, req.user.id, 'END_SESSION', {
        sessionId: session.id,
        sessionName: session.name,
        expectedCash,
        ...(completedOrders && { completedOrders }),
        ...(leftOpen && { ordersLeftOpen: leftOpen }),
        declaredCash: declared,
        difference: declared !== null ? +(declared - expectedCash).toFixed(2) : null
      });

      if (broadcast) broadcast(req.user.tenantId, { type: 'session_ended', session });
      res.json(session);
    } catch (err) {
      if (sendHttpError(res, err)) return;
      logger.error({ err }, 'Errore POST /api/sessions/end');
      res.status(500).json({ error: 'Errore durante la chiusura della sessione' });
    }
  });

  return router;
}
