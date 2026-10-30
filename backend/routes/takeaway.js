import express from 'express';
import crypto from 'crypto';
import { authenticate, authorizeAdmin, authorizeWaiter } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { tenantScope } from '../middleware/tenantScope.js';
import { inTransaction } from '../db.js';
import logger from '../logger.js';
import { logAudit } from '../utils/auditLogger.js';
import { requireModule } from '../utils/tenantModules.js';
import { HttpError, sendHttpError } from '../utils/httpError.js';
import { idParamsSchema } from '../schemas/common.js';
import { staffOrderSchema, acceptSchema, rejectSchema, pickedUpSchema, ordersQuerySchema, slotsQuerySchema, hoursSchema } from '../schemas/takeawaySchema.js';
import { localNow, PORTAL_TZ } from '../utils/bookingPortal.js';
import { slotStates, slotWithinWindow, pickupIsDue, isSlot } from '../utils/takeaway.js';
import { tenantPayments, captureForAccept, releasePayment } from '../utils/takeawayPayments.js';
import { loadSettings, loadHours, loadUsedByTime, loadWorkMinutes, assignPickupCode, createKitchenOrder, announceKitchenOrder, cancelKitchenOrder } from '../utils/takeawayDb.js';
import { verifyOrderItems } from '../utils/orderLines.js';
import { expireTakeaway } from '../utils/caseExpiry.js';
import { enqueue } from '../utils/whatsapp/outbox.js';
import { snapshotItems } from '../utils/takeawayDb.js';

// Asporto (modulo `takeaway`): gli ordini con orario di ritiro. Si leggono e si gestiscono con i ruoli di sala e cassa;
// orari e impostazioni li scrive l'admin. Disegno e regole: docs/design-asporto.md.
// Eventi: `takeaway_updated` al personale; l'accettazione manda `order_created` alla cucina come ogni altra comanda.
const router = express.Router();
const guard = [authenticate, requireModule('takeaway'), authorizeWaiter];

const ORDER_SQL = `
  SELECT t.id, t.status, t.source, t.pickup_at, to_char(t.pickup_at AT TIME ZONE $1, 'YYYY-MM-DD') AS date,
         to_char(t.pickup_at AT TIME ZONE $1, 'HH24:MI') AS time, t.work_minutes, t.pickup_code, t.customer_name, t.phone, t.email, t.notes, t.items, t.total,
         t.order_id, t.payment_mode, t.payment_status, t.paid_method, t.reject_reason, t.requested_at, t.decided_at, t.picked_up_at,
         o.display_code, o.status AS kitchen_status
  FROM takeaway_orders t LEFT JOIN orders o ON o.id = t.order_id`;

const DONE = 'completed';   // stato finale dell'ordine di cucina (la regola dell'incasso resta in utils/revenue.js)
const present = (r) => ({ ...r, total: Number(r.total), ready: r.status === 'accepted' && r.kitchen_status === 'completed' });

export default function (broadcast) {
  const notify = (tenantId, order) => broadcast?.(tenantId, { type: 'takeaway_updated', order: { id: order.id, status: order.status } });

  const loadOne = async (db, id, { lock = false } = {}) => {
    const { rows } = await db.query(`${ORDER_SQL} WHERE t.id = $2 ${lock ? 'FOR UPDATE OF t' : ''}`, [PORTAL_TZ, id]);
    if (!rows.length) throw new HttpError(404, 'Ordine non trovato');
    return rows[0];
  };

  // Una richiesta non decisa che nessuno ha accettato in tempo non decade da sola: sul banco serve vederla.

  // GET /settings — impostazioni e orari (per la pagina e per il modulo di inserimento)
  router.get('/settings', ...guard, tenantScope, async (req, res) => {
    try {
      res.json({ ...(await loadSettings(req.db)), paymentsAvailable: (await tenantPayments(req.user.tenantId)).available, hours: await loadHours(req.db) });
    } catch (err) {
      logger.error({ err }, 'Errore GET /api/takeaway/settings');
      res.status(500).json({ error: 'Errore caricamento impostazioni' });
    }
  });

  // PUT /hours — sostituisce gli orari dell'asporto (solo admin)
  router.put('/hours', authenticate, requireModule('takeaway'), authorizeAdmin, validate({ body: hoursSchema }), tenantScope, async (req, res) => {
    try {
      await inTransaction(req.db, async (db) => {
        await db.query('DELETE FROM takeaway_hours');
        for (const h of req.body.hours)
          await db.query('INSERT INTO takeaway_hours (weekday, open_time, close_time) VALUES ($1, $2, $3)', [h.weekday, h.open_time, h.close_time]);
      });
      await logAudit(req.db, req.user.id, 'TAKEAWAY_HOURS_UPDATE', { windows: req.body.hours.length });
      res.json(await loadHours(req.db));
    } catch (err) {
      logger.error({ err }, 'Errore PUT /api/takeaway/hours');
      res.status(500).json({ error: 'Errore salvataggio orari' });
    }
  });

  // GET /slots?date=&cart=id:qtà,… — le fasce del giorno con i minuti di lavoro già presi (per scegliere l'orario al banco).
  // Senza carrello `available` si riferisce a un ordine vuoto: serve solo a vedere quanto è piena ogni fascia.
  router.get('/slots', ...guard, validate({ query: slotsQuerySchema }), tenantScope, async (req, res) => {
    const { date, cart } = req.validQuery;
    try {
      const [settings, hours, usedByTime, minutes] = await Promise.all([loadSettings(req.db), loadHours(req.db), loadUsedByTime(req.db, date), cart?.length ? loadWorkMinutes(req.db, cart) : 0]);
      res.json({
        date, capacity: settings.capacity,
        slots: slotStates({ date, hours, slotMinutes: settings.slotMinutes, capacity: settings.capacity, usedByTime, now: localNow(), minLeadMinutes: 0, minutes }),
      });
    } catch (err) {
      logger.error({ err }, 'Errore GET /api/takeaway/slots');
      res.status(500).json({ error: 'Errore caricamento fasce' });
    }
  });

  // GET /orders?date= — gli ordini di un giorno, per orario di ritiro
  router.get('/orders', ...guard, validate({ query: ordersQuerySchema }), tenantScope, async (req, res) => {
    try {
      await expireTakeaway(req.db);
      const { rows } = await req.db.query(
        `${ORDER_SQL} WHERE (t.pickup_at AT TIME ZONE $1)::date = $2::date AND t.payment_status <> 'awaiting' ORDER BY t.pickup_at, t.id`, [PORTAL_TZ, req.validQuery.date]);
      res.json(rows.map(present));
    } catch (err) {
      logger.error({ err }, 'Errore GET /api/takeaway/orders');
      res.status(500).json({ error: 'Errore caricamento ordini' });
    }
  });

  // GET /inbox — le richieste da approvare (alimenta la campanella)
  router.get('/inbox', ...guard, tenantScope, async (req, res) => {
    try {
      await expireTakeaway(req.db);
      const { rows } = await req.db.query(
        `${ORDER_SQL} WHERE t.status = 'requested' AND t.payment_status <> 'awaiting' AND t.pickup_at > now() - interval '1 day' ORDER BY t.requested_at, t.id`, [PORTAL_TZ]);
      res.json(rows.map(r => ({ id: r.id, kind: 'takeaway_request', customer_name: r.customer_name, party_size: null, date: r.date, start_time: r.time,
        work_minutes: r.work_minutes, total: Number(r.total), at: r.requested_at })));
    } catch (err) {
      logger.error({ err }, 'Errore GET /api/takeaway/inbox');
      res.status(500).json({ error: 'Errore caricamento notifiche' });
    }
  });

  // Passa l'ordine ad «accettato». Se il ritiro è per oggi crea anche l'ordine di cucina (e avvisa la cucina); se è per un
  // altro giorno NO: l'ordine resta accettato senza ordine di cucina (`order_id` vuoto) e nasce all'apertura della serata di
  // quel giorno, così non compare in cucina con un giorno d'anticipo né sporca la serata di oggi (incassi, stock).
  // `date` è il giorno del ritiro. Dentro una transazione già aperta. Ritorna i dati dell'ordine di cucina, o `null` se non
  // è ancora nato.
  async function accept(db, req, row, { time, date } = {}) {
    const stamp = time && date
      ? (await db.query(`SELECT (($1::date + $2::time) AT TIME ZONE $3) AS at`, [date, time, PORTAL_TZ])).rows[0].at
      : row.pickup_at;
    const created = pickupIsDue(date, localNow())
      ? await createKitchenOrder(db, { tenantId: req.user.tenantId, userId: req.user.id, takeaway: row })
      : null;
    await db.query(
      `UPDATE takeaway_orders SET status = 'accepted', order_id = $2, pickup_at = $3, total = $4, decided_by = $5, decided_at = now() WHERE id = $1`,
      [row.id, created?.order.id ?? null, stamp, created?.total ?? row.total, req.user.id]);
    // Il codice di ritiro c'è da subito: il cliente lo vede nella pagina del suo ordine, anche se la cucina lo riceve più tardi
    await assignPickupCode(db, row.id);
    // Pagato online: si incassa quanto autorizzato (per ultimo: se la carta non risponde l'accettazione non avviene e resta tutto com'era)
    try { await captureForAccept(db, row); }
    catch (err) {
      logger.error({ err, takeawayId: row.id }, 'Asporto: incasso della carta non riuscito');
      throw new HttpError(409, 'La carta del cliente non è stata addebitata: l\'ordine non è stato accettato. Chiama il cliente o rifiutalo.', 'PAYMENT_FAILED');
    }
    return created;
  }

  const announce = (req, created, row, pickupAt) => announceKitchenOrder(broadcast, req.user.tenantId, created, row, pickupAt);

  // POST /orders — ordine inserito al banco o al telefono: nasce già accettato (e va in cucina)
  router.post('/orders', ...guard, validate({ body: staffOrderSchema }), tenantScope, async (req, res) => {
    const b = req.body;
    try {
      const settings = await loadSettings(req.db);
      const hours = await loadHours(req.db);
      if (!isSlot(b.date, b.time, hours, settings.slotMinutes))
        throw new HttpError(409, 'A quell\'ora l\'asporto non è attivo: scegli una fascia dall\'elenco', 'NOT_A_SLOT');
      const now = localNow();
      const within = slotWithinWindow(b.date, b.time, now, 0);
      if (!within.ok && within.code === 'PAST') throw new HttpError(409, within.reason, 'PAST');

      const result = await inTransaction(req.db, async (db) => {
        await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`takeaway:${req.user.tenantId}`]);
        const { items, total } = await verifyOrderItems(db, b.items, req.user.role);
        const snapshot = snapshotItems(items);
        const minutes = await loadWorkMinutes(db, items);
        const taken = (await loadUsedByTime(db, b.date)).get(b.time) ?? 0;
        if (!b.ignore_capacity && taken + minutes > settings.capacity)
          throw new HttpError(409, `La fascia delle ${b.time} è piena (${taken} su ${settings.capacity}): scegline un'altra`, 'SLOT_FULL');
        const at = (await db.query(`SELECT (($1::date + $2::time) AT TIME ZONE $3) AS at`, [b.date, b.time, PORTAL_TZ])).rows[0].at;
        const { rows: [row] } = await db.query(
          `INSERT INTO takeaway_orders (status, source, pickup_at, work_minutes, customer_name, phone, notes, items, total, public_token, created_by)
           VALUES ('requested', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
          [b.source, at, minutes, b.customer_name, b.phone, b.notes, JSON.stringify(snapshot), total, crypto.randomBytes(18).toString('base64url'), req.user.id]);
        const full = { id: row.id, items: snapshot, customer_name: b.customer_name, pickup_at: at, total };
        const created = await accept(db, req, full, { date: b.date });
        await enqueue(db, 'takeaway', row.id, 'accepted');
        return { id: row.id, created, full, at };
      });
      await logAudit(req.db, req.user.id, 'TAKEAWAY_CREATE', { takeawayId: result.id, source: b.source, total: result.full.total });
      const order = present(await loadOne(req.db, result.id));
      if (result.created) announce(req, result.created, { ...result.full, pickup_code: order.pickup_code }, result.at);     // senza ordine di cucina non c'è nulla da annunciare
      notify(req.user.tenantId, order);
      res.status(201).json(order);
    } catch (err) {
      if (sendHttpError(res, err)) return;
      logger.error({ err }, 'Errore POST /api/takeaway/orders');
      res.status(500).json({ error: 'Errore creazione ordine' });
    }
  });

  // POST /orders/:id/accept — il locale approva una richiesta: nasce l'ordine di cucina
  router.post('/orders/:id/accept', ...guard, validate({ params: idParamsSchema, body: acceptSchema }), tenantScope, async (req, res) => {
    try {
      const result = await inTransaction(req.db, async (db) => {
        const row = await loadOne(db, req.params.id, { lock: true });
        if (row.status !== 'requested') throw new HttpError(409, 'Questo ordine è già stato gestito', 'INVALID_TRANSITION');
        if (row.payment_status === 'awaiting') throw new HttpError(409, 'Il cliente non ha ancora finito di pagare', 'AWAITING_PAYMENT');
        let { time, date } = row;
        if (req.body.time && req.body.time !== row.time) {
          // Il locale propone un altro orario: deve essere una fascia con posto
          const [settings, hours] = [await loadSettings(db), await loadHours(db)];
          if (!isSlot(row.date, req.body.time, hours, settings.slotMinutes)) throw new HttpError(409, 'Scegli una fascia dall\'elenco', 'NOT_A_SLOT');
          const taken = (await loadUsedByTime(db, row.date, { excludeId: row.id })).get(req.body.time) ?? 0;
          if (!req.body.ignore_capacity && taken + row.work_minutes > settings.capacity) throw new HttpError(409, `La fascia delle ${req.body.time} è piena`, 'SLOT_FULL');
          time = req.body.time;
        }
        const created = await accept(db, req, { ...row, items: row.items }, { time, date });
        await enqueue(db, 'takeaway', row.id, 'accepted');
        return { created, row, time };
      });
      await logAudit(req.db, req.user.id, 'TAKEAWAY_ACCEPT', { takeawayId: Number(req.params.id) });
      const order = present(await loadOne(req.db, req.params.id));
      if (result.created) announce(req, result.created, { ...result.row, pickup_code: order.pickup_code }, order.pickup_at);
      notify(req.user.tenantId, order);
      res.json(order);
    } catch (err) {
      if (sendHttpError(res, err)) return;
      logger.error({ err }, 'Errore POST /api/takeaway/orders/:id/accept');
      res.status(500).json({ error: 'Errore accettazione ordine' });
    }
  });

  // POST /orders/:id/reject — il locale non accetta (motivo facoltativo)
  router.post('/orders/:id/reject', ...guard, validate({ params: idParamsSchema, body: rejectSchema }), tenantScope, async (req, res) => {
    try {
      await inTransaction(req.db, async (db) => {
        const row = await loadOne(db, req.params.id, { lock: true });
        if (row.status !== 'requested') throw new HttpError(409, 'Questo ordine è già stato gestito', 'INVALID_TRANSITION');
        await db.query(`UPDATE takeaway_orders SET status = 'rejected', reject_reason = $2, decided_by = $3, decided_at = now() WHERE id = $1`,
          [row.id, req.body.reason, req.user.id]);
        await releasePayment(db, row);             // carta autorizzata: tornerà libera, nessun addebito
        await enqueue(db, 'takeaway', row.id, 'rejected');
      });
      await logAudit(req.db, req.user.id, 'TAKEAWAY_REJECT', { takeawayId: Number(req.params.id) });
      const order = present(await loadOne(req.db, req.params.id));
      notify(req.user.tenantId, order);
      res.json(order);
    } catch (err) {
      if (sendHttpError(res, err)) return;
      logger.error({ err }, 'Errore POST /api/takeaway/orders/:id/reject');
      res.status(500).json({ error: 'Errore rifiuto ordine' });
    }
  });

  // POST /orders/:id/picked-up — consegnato e pagato al ritiro
  router.post('/orders/:id/picked-up', ...guard, validate({ params: idParamsSchema, body: pickedUpSchema }), tenantScope, async (req, res) => {
    try {
      await inTransaction(req.db, async (db) => {
        const row = await loadOne(db, req.params.id, { lock: true });
        if (row.status !== 'accepted') throw new HttpError(409, 'Si consegna solo un ordine accettato', 'INVALID_TRANSITION');
        // Già pagato online: è carta, non si chiede nulla; altrimenti il metodo lo sceglie chi consegna
        const method = row.payment_status === 'paid' ? 'card' : req.body.method;
        if (!method) throw new HttpError(400, 'Scegli come ha pagato il cliente', 'METHOD_REQUIRED');
        await db.query(`UPDATE takeaway_orders SET status = 'picked_up', paid_method = $2, picked_up_at = now() WHERE id = $1`, [row.id, method]);
        // Consegnato: l'ordine di cucina è concluso (esce dalla coda) e conta nell'incasso
        await db.query(`UPDATE orders SET status = $2, completed_at = COALESCE(completed_at, now()) WHERE id = $1 AND status <> 'canceled'`, [row.order_id, DONE]);
        await db.query(`UPDATE order_items SET prep_status = 'ready', ready_at = COALESCE(ready_at, now()) WHERE order_id = $1 AND prep_status = 'new'`, [row.order_id]);
        await enqueue(db, 'takeaway', row.id, 'picked_up');
      });
      await logAudit(req.db, req.user.id, 'TAKEAWAY_PICKED_UP', { takeawayId: Number(req.params.id), method: req.body.method ?? 'card' });
      const order = present(await loadOne(req.db, req.params.id));
      broadcast?.(req.user.tenantId, { type: 'order_updated', order: { id: order.order_id, status: 'completed' } });
      notify(req.user.tenantId, order);
      res.json(order);
    } catch (err) {
      if (sendHttpError(res, err)) return;
      logger.error({ err }, 'Errore POST /api/takeaway/orders/:id/picked-up');
      res.status(500).json({ error: 'Errore consegna ordine' });
    }
  });

  // POST /orders/:id/cancel — il locale annulla un ordine già accettato (cliente che non viene, errore): lo stock torna
  router.post('/orders/:id/cancel', ...guard, validate({ params: idParamsSchema }), tenantScope, async (req, res) => {
    try {
      const stockUpdates = await inTransaction(req.db, async (db) => {
        const row = await loadOne(db, req.params.id, { lock: true });
        if (!['requested', 'accepted'].includes(row.status)) throw new HttpError(409, 'Questo ordine non si può annullare', 'INVALID_TRANSITION');
        await db.query(`UPDATE takeaway_orders SET status = 'cancelled', decided_by = $2, decided_at = now() WHERE id = $1`, [row.id, req.user.id]);
        await releasePayment(db, row);             // incassato: si restituisce; solo autorizzato: si rilascia
        await enqueue(db, 'takeaway', row.id, 'cancelled');
        return row.order_id ? cancelKitchenOrder(db, row.order_id, { tenantId: req.user.tenantId, userId: req.user.id }) : [];
      });
      await logAudit(req.db, req.user.id, 'TAKEAWAY_CANCEL', { takeawayId: Number(req.params.id) });
      const order = present(await loadOne(req.db, req.params.id));
      stockUpdates.forEach(product => broadcast?.(req.user.tenantId, { type: 'product_stock_updated', product }));
      if (order.order_id) broadcast?.(req.user.tenantId, { type: 'order_updated', order: { id: order.order_id, status: 'canceled' } });
      notify(req.user.tenantId, order);
      res.json(order);
    } catch (err) {
      if (sendHttpError(res, err)) return;
      logger.error({ err }, 'Errore POST /api/takeaway/orders/:id/cancel');
      res.status(500).json({ error: 'Errore annullamento ordine' });
    }
  });

  return router;
}
