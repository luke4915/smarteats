import express from 'express';
import crypto from 'crypto';
import { resolveTenantFromHost } from '../middleware/resolveTenantFromHost.js';
import { withTenantClient } from '../middleware/tenantScope.js';
import { validate } from '../middleware/validate.js';
import { inTransaction } from '../db.js';
import logger from '../logger.js';
import { logAudit } from '../utils/auditLogger.js';
import { requireModule } from '../utils/tenantModules.js';
import { HttpError, sendHttpError } from '../utils/httpError.js';
import { portalOrderSchema, slotsQuerySchema, tokenParamsSchema } from '../schemas/takeawaySchema.js';
import { localNow, addDays, phoneDigits, MIN_FILL_MS, PORTAL_TZ } from '../utils/bookingPortal.js';
import { MAX_DAYS_AHEAD, MAX_ITEMS_PER_ORDER, MAX_PENDING_PER_PHONE, slotStates, slotWithinWindow, isSlot } from '../utils/takeaway.js';
import { loadSettings, loadHours, loadByTime, loadOfItems, snapshotItems } from '../utils/takeawayDb.js';
import { verifyOrderItems } from '../utils/orderLines.js';

// Ordini da asporto dal sito pubblico (modulo `takeaway`, impostazione `takeaway_portal_enabled`). Senza login: il
// locale arriva dal sottodominio, ogni colonna restituita è scelta a mano. Mai carichi o capienze nelle risposte, mai
// dati di altri clienti. Una richiesta nasce `requested`: il locale la approva. Disegno: docs/design-asporto.md.
const router = express.Router();
const guard = [resolveTenantFromHost, requireModule('takeaway')];

export default function (broadcast) {
  const inPortal = (fn) => async (req, res) => {
    try {
      const out = await withTenantClient(req.tenantId, async (db) => {
        const settings = await loadSettings(db);
        if (!settings.enabled) throw new HttpError(404, 'Gli ordini online non sono attivi', 'PORTAL_OFF');
        const { rows: [t] } = await db.query('SELECT name FROM tenants WHERE id = $1', [req.tenantId]);
        return fn(db, { req, settings, restaurant: { name: t?.name ?? '', phone: settings.phone } });
      });
      res.status(out?.httpStatus ?? 200).json(out?.httpStatus ? out.body : out);
    } catch (err) {
      if (sendHttpError(res, err)) return;
      logger.error({ err }, `Errore asporto pubblico ${req.method} ${req.path}`);
      res.status(500).json({ error: 'Non siamo riusciti a completare l\'operazione, riprova tra poco' });
    }
  };

  // GET /info — il necessario per disegnare la pagina: locale, messaggio, prodotti ordinabili
  router.get('/info', ...guard, inPortal(async (db, { settings, restaurant }) => {
    const { rows } = await db.query(
      `SELECT id, name, price, category, color FROM products WHERE visible AND (NOT stock_enabled OR stock IS NULL OR stock > 0) ORDER BY category NULLS LAST, name`);
    const categories = [...new Set(rows.map(r => r.category || 'Altro'))];
    return {
      name: restaurant.name, phone: restaurant.phone, welcome: settings.welcome, max_days: MAX_DAYS_AHEAD, today: localNow().date,
      max_items: MAX_ITEMS_PER_ORDER, categories,
      products: rows.map(r => ({ id: r.id, name: r.name, price: Number(r.price), category: r.category || 'Altro' })),
    };
  }));

  // GET /slots?date=&load= — le fasce del giorno: ciascuna richiedibile o no (mai numeri)
  router.get('/slots', ...guard, validate({ query: slotsQuerySchema }), inPortal(async (db, { req, settings }) => {
    const { date, load } = req.validQuery;
    const [hours, byTime] = await Promise.all([loadHours(db), loadByTime(db, date)]);
    const slots = slotStates({ date, hours, slotMinutes: settings.slotMinutes, capacity: settings.capacity, loadByTime: byTime, now: localNow(), minLeadMinutes: settings.minLeadMinutes, load });
    return { date, slots: slots.map(s => ({ time: s.time, available: s.available })) };
  }));

  // GET /days — i prossimi giorni, con almeno una fascia ancora richiedibile oppure no
  router.get('/days', ...guard, inPortal(async (db, { settings }) => {
    const hours = await loadHours(db);
    const today = localNow().date;
    const now = localNow();
    const out = [];
    for (let i = 0; i <= MAX_DAYS_AHEAD; i += 1) {
      const date = addDays(today, i);
      const byTime = await loadByTime(db, date);
      const slots = slotStates({ date, hours, slotMinutes: settings.slotMinutes, capacity: settings.capacity, loadByTime: byTime, now, minLeadMinutes: settings.minLeadMinutes, load: 1 });
      out.push({ date, available: slots.some(s => s.available) });
    }
    return { days: out };
  }));

  // POST /orders — nasce una richiesta: il locale la approva
  router.post('/orders', ...guard, validate({ body: portalOrderSchema }), inPortal(async (db, { req, settings, restaurant }) => {
    const b = req.body;
    // Un programma automatico compila il campo nascosto o invia in un lampo: si rifiuta senza spiegare
    if (b.website !== '' || (b.opened_at !== undefined && Date.now() - b.opened_at < MIN_FILL_MS)) throw new HttpError(400, 'Richiesta non valida');
    if (b.items.reduce((n, i) => n + i.quantity, 0) > MAX_ITEMS_PER_ORDER)
      throw new HttpError(409, `Per ordini così grandi (oltre ${MAX_ITEMS_PER_ORDER} pezzi) telefona al locale`, 'TOO_BIG');

    const hours = await loadHours(db);
    if (!isSlot(b.date, b.time, hours, settings.slotMinutes)) throw new HttpError(409, 'Questo orario non è disponibile', 'NOT_A_SLOT');
    const window = slotWithinWindow(b.date, b.time, localNow(), settings.minLeadMinutes);
    if (!window.ok) throw new HttpError(409, window.reason, window.code);

    const token = crypto.randomBytes(24).toString('base64url');
    const id = await inTransaction(db, async (tx) => {
      // Si serializzano gli ordini dello stesso locale mentre si conta il carico (una fascia non si supera in due insieme)
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`takeaway:${req.tenantId}`]);
      const { rows: [{ n }] } = await tx.query(
        `SELECT COUNT(*)::int AS n FROM takeaway_orders WHERE status = 'requested' AND right(regexp_replace(phone, '\\D', '', 'g'), 10) = $1`, [phoneDigits(b.phone)]);
      if (n >= MAX_PENDING_PER_PHONE)
        throw new HttpError(429, `Hai già ${MAX_PENDING_PER_PHONE} ordini in attesa di conferma: aspetta l'esito oppure chiama il locale`, 'TOO_MANY_PENDING');
      const { items, total } = await verifyOrderItems(tx, b.items.map(i => ({ id: i.id, quantity: i.quantity, note: i.note })), 'customer');
      const load = await loadOfItems(tx, items);
      const taken = (await loadByTime(tx, b.date)).get(b.time) ?? 0;
      if (taken + load > settings.capacity) throw new HttpError(409, 'Questa fascia non ha più posto per il vostro ordine: scegli un altro orario', 'SLOT_FULL');
      const at = (await tx.query(`SELECT (($1::date + $2::time) AT TIME ZONE $3) AS at`, [b.date, b.time, PORTAL_TZ])).rows[0].at;
      const { rows: [row] } = await tx.query(
        `INSERT INTO takeaway_orders (status, source, pickup_at, load, customer_name, phone, email, notes, items, total, public_token, consent_at)
         VALUES ('requested', 'portal', $1, $2, $3, $4, $5, $6, $7, $8, $9, now()) RETURNING id`,
        [at, load, b.customer_name, b.phone, b.email, b.notes, JSON.stringify(snapshotItems(items)), total, token]);
      return row.id;
    });
    await logAudit(db, null, 'TAKEAWAY_PORTAL_REQUEST', { takeawayId: id, itemCount: b.items.length });
    broadcast?.(req.tenantId, { type: 'takeaway_updated', order: { id, status: 'requested' } });
    return { httpStatus: 201, body: { token, restaurant: { name: restaurant.name, phone: restaurant.phone } } };
  }));

  // L'ordine di chi ha il link: solo il suo, solo i campi che servono a mostrarlo
  const loadMine = async (db, token) => {
    const { rows } = await db.query(
      `SELECT id, status, items, total, customer_name, notes, reject_reason, paid_method,
              to_char(pickup_at AT TIME ZONE $2, 'YYYY-MM-DD') AS date, to_char(pickup_at AT TIME ZONE $2, 'HH24:MI') AS time
       FROM takeaway_orders WHERE public_token = $1`, [token, PORTAL_TZ]);
    if (!rows.length) throw new HttpError(404, 'Ordine non trovato', 'NOT_FOUND');
    return rows[0];
  };
  const present = (r, restaurant) => ({
    status: r.status, date: r.date, time: r.time, customer_name: r.customer_name, notes: r.notes, total: Number(r.total),
    items: r.items.map(i => ({ name: i.name, quantity: i.quantity, note: i.note || '' })),
    reject_reason: r.status === 'rejected' ? r.reject_reason : '',
    // Prima dell'approvazione il cliente può ritirare l'ordine; dopo, il locale ci ha già lavorato: si telefona
    can_cancel: r.status === 'requested', restaurant,
  });

  router.get('/orders/:token', ...guard, validate({ params: tokenParamsSchema }), inPortal(async (db, { req, restaurant }) =>
    present(await loadMine(db, req.params.token), { name: restaurant.name, phone: restaurant.phone })));

  router.post('/orders/:token/cancel', ...guard, validate({ params: tokenParamsSchema }), inPortal(async (db, { req, restaurant }) => {
    const mine = await inTransaction(db, async (tx) => {
      const r = await loadMine(tx, req.params.token);
      const { rows: [locked] } = await tx.query('SELECT status FROM takeaway_orders WHERE id = $1 FOR UPDATE', [r.id]);
      if (locked.status !== 'requested')
        throw new HttpError(409, 'Il locale ha già preso in carico l\'ordine: per cambiarlo o annullarlo chiama il locale', 'CANCEL_BY_PHONE');
      await tx.query(`UPDATE takeaway_orders SET status = 'cancelled' WHERE id = $1`, [r.id]);
      return { ...r, status: 'cancelled' };
    });
    await logAudit(db, null, 'TAKEAWAY_PORTAL_CANCEL', { takeawayId: mine.id });
    broadcast?.(req.tenantId, { type: 'takeaway_updated', order: { id: mine.id, status: 'cancelled' } });
    return present(mine, { name: restaurant.name, phone: restaurant.phone });
  }));

  return router;
}
