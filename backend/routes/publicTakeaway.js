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
import { loadSettings, loadHours, loadUsedByTime, loadWorkMinutes, smallestPrepMinutes, snapshotItems } from '../utils/takeawayDb.js';
import { verifyOrderItems } from '../utils/orderLines.js';
import { expireTakeaway } from '../utils/caseExpiry.js';
import { enqueue } from '../utils/whatsapp/outbox.js';
import { paymentFor, tenantPayments, startOnlinePayment, releasePayment } from '../utils/takeawayPayments.js';

// Ordini da asporto dal sito pubblico (modulo `takeaway`, impostazione `takeaway_portal_enabled`). Senza login: il
// locale arriva dal sottodominio, ogni colonna restituita è scelta a mano. Mai carichi o capienze nelle risposte, mai
// dati di altri clienti. Una richiesta nasce `requested`: il locale la approva. Disegno: docs/design-asporto.md.
// Il sito da cui è arrivato il cliente (i pagamenti tornano lì): l'origine della richiesta, già controllata da CORS, oppure l'indirizzo del locale.
const originOf = (req) => req.get('origin') ?? `${req.protocol}://${req.get('host')}`;
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
  router.get('/info', ...guard, inPortal(async (db, { req, settings, restaurant }) => {
    const { rows } = await db.query(
      `SELECT id, name, price, category, color FROM products WHERE visible AND (NOT stock_enabled OR stock IS NULL OR stock > 0) ORDER BY category NULLS LAST, name`);
    const categories = [...new Set(rows.map(r => r.category || 'Altro'))];
    return {
      name: restaurant.name, phone: restaurant.phone, welcome: settings.welcome, max_days: MAX_DAYS_AHEAD, today: localNow().date,
      max_items: MAX_ITEMS_PER_ORDER, categories,
      // Come si può pagare: spento, facoltativo o obbligatorio (spento se i pagamenti online non sono pronti per questo locale)
      // (se il locale pretende il pagamento online ma non è pronto, `unavailable`: il sito avvisa e non fa ordinare)
      payments: { mode: (await tenantPayments(req.tenantId)).available ? settings.paymentMode : settings.paymentMode === 'required' ? 'unavailable' : 'off' },
      products: rows.map(r => ({ id: r.id, name: r.name, price: Number(r.price), category: r.category || 'Altro' })),
    };
  }));

  // GET /slots?date=&cart=id:qtà,… — le fasce del giorno: ciascuna richiedibile o no (mai numeri). Con il carrello si controlla che
  // l'ordine ci stia; senza, che ci stia almeno un pezzo.
  router.get('/slots', ...guard, validate({ query: slotsQuerySchema }), inPortal(async (db, { req, settings }) => {
    const { date, cart } = req.validQuery;
    await expireTakeaway(db);
    const [hours, usedByTime, minutes] = await Promise.all([loadHours(db), loadUsedByTime(db, date), cart?.length ? loadWorkMinutes(db, cart) : smallestPrepMinutes(db)]);
    const slots = slotStates({ date, hours, slotMinutes: settings.slotMinutes, capacity: settings.capacity, usedByTime, now: localNow(), minLeadMinutes: settings.minLeadMinutes, minutes });
    return { date, slots: slots.map(s => ({ time: s.time, available: s.available })) };
  }));

  // GET /days — i prossimi giorni, con almeno una fascia ancora richiedibile oppure no
  router.get('/days', ...guard, inPortal(async (db, { settings }) => {
    await expireTakeaway(db);
    const hours = await loadHours(db);
    const today = localNow().date;
    const now = localNow();
    const out = [];
    for (let i = 0; i <= MAX_DAYS_AHEAD; i += 1) {
      const date = addDays(today, i);
      const usedByTime = await loadUsedByTime(db, date);
      const slots = slotStates({ date, hours, slotMinutes: settings.slotMinutes, capacity: settings.capacity, usedByTime, now, minLeadMinutes: settings.minLeadMinutes, minutes: await smallestPrepMinutes(db) });
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

    const { available } = await tenantPayments(req.tenantId);
    const how = paymentFor({ setting: settings.paymentMode, available, requested: b.pay_online });
    if (how === null) throw new HttpError(409, 'Al momento il pagamento online non è disponibile: riprova più tardi o telefona al locale', 'PAYMENTS_UNAVAILABLE');
    const online = how === 'online';

    const token = crypto.randomBytes(24).toString('base64url');
    const created = await inTransaction(db, async (tx) => {
      // Si serializzano gli ordini dello stesso locale mentre si conta il carico (una fascia non si supera in due insieme)
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`takeaway:${req.tenantId}`]);
      const { rows: [{ n }] } = await tx.query(
        `SELECT COUNT(*)::int AS n FROM takeaway_orders WHERE status = 'requested' AND right(regexp_replace(phone, '\\D', '', 'g'), 10) = $1`, [phoneDigits(b.phone)]);
      if (n >= MAX_PENDING_PER_PHONE)
        throw new HttpError(429, `Hai già ${MAX_PENDING_PER_PHONE} ordini in attesa di conferma: aspetta l'esito oppure chiama il locale`, 'TOO_MANY_PENDING');
      const { items, total } = await verifyOrderItems(tx, b.items.map(i => ({ id: i.id, quantity: i.quantity, note: i.note })), 'customer');
      const minutes = await loadWorkMinutes(tx, items);
      const taken = (await loadUsedByTime(tx, b.date)).get(b.time) ?? 0;
      if (taken + minutes > settings.capacity) throw new HttpError(409, 'Questa fascia non ha più posto per il vostro ordine: scegli un altro orario', 'SLOT_FULL');
      const at = (await tx.query(`SELECT (($1::date + $2::time) AT TIME ZONE $3) AS at`, [b.date, b.time, PORTAL_TZ])).rows[0].at;
      const { rows: [row] } = await tx.query(
        `INSERT INTO takeaway_orders (status, source, pickup_at, work_minutes, customer_name, phone, email, notes, items, total, public_token, consent_at, payment_mode)
         VALUES ('requested', 'portal', $1, $2, $3, $4, $5, $6, $7, $8, $9, now(), $10) RETURNING id`,
        [at, minutes, b.customer_name, b.phone, b.email, b.notes, JSON.stringify(snapshotItems(items)), total, token, how]);
      // Pagando online la richiesta esiste per il locale solo dopo l'autorizzazione della carta (webhook): niente avviso prima
      if (!online) await enqueue(tx, 'takeaway', row.id, 'received');
      return { id: row.id, total, summary: items.map(i => `${i.quantity}× ${i.name}`).join(', ').slice(0, 300) };
    });
    const id = created.id;
    await logAudit(db, null, 'TAKEAWAY_PORTAL_REQUEST', { takeawayId: id, itemCount: b.items.length, online });
    if (!online) {
      broadcast?.(req.tenantId, { type: 'takeaway_updated', order: { id, status: 'requested' } });
      return { httpStatus: 201, body: { token, restaurant: { name: restaurant.name, phone: restaurant.phone } } };
    }
    try {
      const checkoutUrl = await startOnlinePayment(db, { tenantId: req.tenantId, tenantName: restaurant.name, order: { ...created, email: b.email }, token, origin: originOf(req) });
      return { httpStatus: 201, body: { token, restaurant: { name: restaurant.name, phone: restaurant.phone }, checkout_url: checkoutUrl } };
    } catch (err) {
      logger.error({ err, takeawayId: id }, 'Asporto: pagina di pagamento non creata');
      await db.query(`UPDATE takeaway_orders SET status = 'cancelled', payment_status = 'canceled', decided_at = now() WHERE id = $1`, [id]);
      throw new HttpError(502, 'Il pagamento online non è partito: riprova tra poco o scegli di pagare al ritiro', 'PAYMENT_START_FAILED');
    }
  }));

  // L'ordine di chi ha il link: solo il suo, solo i campi che servono a mostrarlo
  const loadMine = async (db, token) => {
    await expireTakeaway(db);
    const { rows } = await db.query(
      `SELECT id, status, items, total, customer_name, notes, reject_reason, paid_method, pickup_code, payment_mode, payment_status,
              to_char(pickup_at AT TIME ZONE $2, 'YYYY-MM-DD') AS date, to_char(pickup_at AT TIME ZONE $2, 'HH24:MI') AS time
       FROM takeaway_orders WHERE public_token = $1`, [token, PORTAL_TZ]);
    if (!rows.length) throw new HttpError(404, 'Ordine non trovato', 'NOT_FOUND');
    return rows[0];
  };
  const present = (r, restaurant) => ({
    status: r.status, date: r.date, time: r.time, customer_name: r.customer_name, notes: r.notes, total: Number(r.total),
    // il codice che il cliente dice al ritiro: c'è da quando il locale accetta
    pickup_code: r.status === 'accepted' ? r.pickup_code : null,
    // Pagato online: carta autorizzata o incassata; `can_pay` = il cliente non ha ancora finito di pagare
    payment: { online: r.payment_mode === 'online', status: r.payment_status },
    can_pay: r.status === 'requested' && r.payment_status === 'awaiting',
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
      const { rows: [locked] } = await tx.query('SELECT status, payment_status FROM takeaway_orders WHERE id = $1 FOR UPDATE', [r.id]);
      if (locked.status !== 'requested')
        throw new HttpError(409, 'Il locale ha già preso in carico l\'ordine: per cambiarlo o annullarlo chiama il locale', 'CANCEL_BY_PHONE');
      await tx.query(`UPDATE takeaway_orders SET status = 'cancelled' WHERE id = $1`, [r.id]);
      await releasePayment(tx, { id: r.id, payment_status: locked.payment_status });      // la carta autorizzata torna libera
      return { ...r, status: 'cancelled' };
    });
    await logAudit(db, null, 'TAKEAWAY_PORTAL_CANCEL', { takeawayId: mine.id });
    broadcast?.(req.tenantId, { type: 'takeaway_updated', order: { id: mine.id, status: 'cancelled' } });
    return present(mine, { name: restaurant.name, phone: restaurant.phone });
  }));

  // POST /orders/:token/pay — il cliente non ha finito di pagare (ha chiuso la pagina): gli si dà una pagina nuova
  router.post('/orders/:token/pay', ...guard, validate({ params: tokenParamsSchema }), inPortal(async (db, { req, restaurant }) => {
    const r = await loadMine(db, req.params.token);
    if (r.status !== 'requested' || r.payment_status !== 'awaiting') throw new HttpError(409, 'Questo ordine non ha pagamenti da completare', 'NOTHING_TO_PAY');
    const { rows: [mail] } = await db.query('SELECT email FROM takeaway_orders WHERE id = $1', [r.id]);
    const summary = r.items.map(i => `${i.quantity}× ${i.name}`).join(', ').slice(0, 300);
    try {
      return { checkout_url: await startOnlinePayment(db, { tenantId: req.tenantId, tenantName: restaurant.name, order: { id: r.id, total: r.total, summary, email: mail?.email }, token: req.params.token, origin: originOf(req) }) };
    } catch (err) {
      logger.error({ err, takeawayId: r.id }, 'Asporto: pagina di pagamento non ricreata');
      throw new HttpError(502, 'Il pagamento online non è partito: riprova tra poco', 'PAYMENT_START_FAILED');
    }
  }));

  return router;
}
