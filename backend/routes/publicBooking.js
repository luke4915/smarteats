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
import { expireReservations } from '../utils/caseExpiry.js';
import { enqueue } from '../utils/whatsapp/outbox.js';
import { canTransition, freeSeats, shiftOpenOn } from '../utils/bookings.js';
import { SHIFT_COLUMNS, CLOSURE_COLUMNS, lockShift, assertBookable } from '../utils/bookingDb.js';
import {
  MAX_PARTY, MAX_DAYS_AHEAD, MIN_CANCEL_NOTICE_HOURS, MIN_NOTICE_HOURS, MAX_PENDING_PER_PHONE, MIN_FILL_MS, localNow, addDays, withinWindow, phoneDigits, cancelOption,
} from '../utils/bookingPortal.js';
import { availabilityQuerySchema, portalRequestSchema, tokenParamsSchema } from '../schemas/publicBookingSchema.js';

// Portale pubblico di prenotazione (modulo `bookings`, impostazione `booking_portal_enabled`). Senza login: il locale
// arriva dal sottodominio e ogni colonna restituita è scelta a mano. Mai capienze o numeri di posti nelle risposte, mai
// dati di altri clienti. Disegno e regole: docs/design-prenotazione-pubblica.md.
const router = express.Router();
const guard = [resolveTenantFromHost, requireModule('bookings')];
const PORTAL_KEYS = ['booking_portal_enabled', 'booking_portal_phone', 'booking_portal_welcome'];

export default function (broadcast) {
  // Dentro il locale, col portale acceso; altrimenti 404 (come se non esistesse).
  const inPortal = (fn) => async (req, res) => {
    try {
      const out = await withTenantClient(req.tenantId, async (db) => {
        const { rows } = await db.query('SELECT key, value FROM settings WHERE key = ANY($1)', [PORTAL_KEYS]);
        const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
        if (settings.booking_portal_enabled !== '1') throw new HttpError(404, 'Le prenotazioni online non sono attive', 'PORTAL_OFF');
        const { rows: [t] } = await db.query('SELECT name FROM tenants WHERE id = $1', [req.tenantId]);
        return fn(db, { req, res, settings, restaurant: { name: t?.name ?? '', phone: settings.booking_portal_phone ?? '' } });
      });
      if (!res.headersSent) res.status(out?.httpStatus ?? 200).json(out?.httpStatus ? out.body : out);
    } catch (err) {
      if (sendHttpError(res, err)) return;
      logger.error({ err }, `Errore portale ${req.method} ${req.path}`);
      res.status(500).json({ error: 'Non siamo riusciti a completare l\'operazione, riprova tra poco' });
    }
  };

  const expireStale = expireReservations;

  // Per un insieme di date: per ogni turno, si può richiedere? (finestra, giorno, chiusure, posti per `party`).
  async function availableShifts(db, dates, party) {
    const now = localNow();
    const { rows: shifts } = await db.query(`SELECT ${SHIFT_COLUMNS} FROM booking_shifts WHERE active ORDER BY position, start_time, id`);
    const first = dates[0], last = dates[dates.length - 1];
    const { rows: closures } = await db.query(
      `SELECT ${CLOSURE_COLUMNS} FROM booking_closures WHERE date_to >= $1 AND date_from <= $2`, [first, last]);
    const { rows: taken } = await db.query(
      `SELECT to_char(date, 'YYYY-MM-DD') AS date, shift_id, status, party_size, requested_at FROM reservations
       WHERE date BETWEEN $1 AND $2 AND status IN ('requested', 'confirmed', 'seated')`, [first, last]);
    return dates.map(date => ({
      date,
      shifts: shifts.map(s => {
        const closuresToday = closures.filter(c => date >= c.date_from && date <= c.date_to);
        const open = shiftOpenOn(s, date, closuresToday).open && withinWindow(date, s.start_time, now).ok;
        const { free } = freeSeats(s.capacity, taken.filter(r => r.date === date && r.shift_id === s.id));
        return { id: s.id, name: s.name, start_time: s.start_time, available: open && free >= party };
      }),
    }));
  }

  // GET /info — il necessario per disegnare la pagina
  router.get('/info', ...guard, inPortal(async (db, { restaurant, settings }) => ({
    name: restaurant.name,
    phone: restaurant.phone,
    welcome: settings.booking_portal_welcome ?? '',
    max_party: MAX_PARTY,
    max_days: MAX_DAYS_AHEAD,
    min_notice_hours: MIN_NOTICE_HOURS,
    today: localNow().date,
  })));

  // GET /calendar?party= — i prossimi giorni: ognuno con almeno un turno richiedibile, oppure no
  router.get('/calendar', ...guard, validate({ query: availabilityQuerySchema.omit({ date: true }) }), inPortal(async (db, { req }) => {
    await expireStale(db);
    const today = localNow().date;
    const dates = Array.from({ length: MAX_DAYS_AHEAD + 1 }, (_, i) => addDays(today, i));
    const days = await availableShifts(db, dates, req.validQuery.party);
    return { days: days.map(d => ({ date: d.date, available: d.shifts.some(s => s.available) })) };
  }));

  // GET /availability?date=&party= — i turni di un giorno, ognuno richiedibile o no (mai numeri di posti)
  router.get('/availability', ...guard, validate({ query: availabilityQuerySchema }), inPortal(async (db, { req }) => {
    await expireStale(db);
    const { date, party } = req.validQuery;
    const [day] = await availableShifts(db, [date], party);
    return { date, shifts: day.shifts };
  }));

  // POST /requests — nasce una richiesta (`requested`): tiene il posto 24 ore, il personale la conferma
  router.post('/requests', ...guard, validate({ body: portalRequestSchema }), inPortal(async (db, { req, restaurant }) => {
    const b = req.body;
    // Un programma automatico compila il campo nascosto o invia in un lampo: si rifiuta senza spiegare
    if (b.website !== '' || (b.opened_at !== undefined && Date.now() - b.opened_at < MIN_FILL_MS))
      throw new HttpError(400, 'Richiesta non valida');

    const token = crypto.randomBytes(24).toString('base64url');
    const created = await inTransaction(db, async (tx) => {
      const shift = await lockShift(tx, b.shift_id);
      if (!shift.active) throw new HttpError(409, 'Questo turno non è prenotabile', 'SHIFT_CLOSED');
      const window = withinWindow(b.date, shift.start_time, localNow());
      if (!window.ok) throw new HttpError(409, window.reason, window.code);
      await expireStale(tx);
      const { rows: [{ n }] } = await tx.query(
        `SELECT COUNT(*)::int AS n FROM reservations WHERE status = 'requested' AND right(regexp_replace(phone, '\\D', '', 'g'), 10) = $1`, [phoneDigits(b.phone)]);
      if (n >= MAX_PENDING_PER_PHONE)
        throw new HttpError(429, `Hai già ${MAX_PENDING_PER_PHONE} richieste in attesa: aspetta la conferma oppure chiamaci`, 'TOO_MANY_PENDING');
      try {
        await assertBookable(tx, shift, b.date, b.party_size);
      } catch (err) {
        // Al cliente non si dice quanti posti restano: o c'è posto o non c'è
        if (err.code === 'NO_CAPACITY') throw new HttpError(409, 'Questo turno non ha più posto per il vostro gruppo: prova un altro orario', 'NO_CAPACITY');
        if (err.code === 'SHIFT_CLOSED') throw new HttpError(409, 'Questo turno non è prenotabile in quel giorno', 'SHIFT_CLOSED');
        throw err;
      }
      const { rows: [r] } = await tx.query(
        `INSERT INTO reservations (date, shift_id, party_size, status, customer_name, phone, email, notes, source, public_token, consent_at, marketing_consent_at)
         VALUES ($1, $2, $3, 'requested', $4, $5, $6, $7, 'portal', $8, now(), CASE WHEN $9::boolean THEN now() END) RETURNING id`,
        [b.date, b.shift_id, b.party_size, b.customer_name, b.phone, b.email, b.notes, token, b.marketing]);
      await enqueue(tx, 'reservation', r.id, 'received');
      return r.id;
    });
    await logAudit(db, null, 'BOOKING_PORTAL_REQUEST', { reservationId: created, date: b.date, shiftId: b.shift_id, partySize: b.party_size });
    broadcast?.(req.tenantId, { type: 'reservation_updated', reservation: { id: created, status: 'requested' } });
    return { httpStatus: 201, body: { token, restaurant: { name: restaurant.name, phone: restaurant.phone } } };
  }));

  // La richiesta di chi ha il link: solo la sua, solo i campi che servono a mostrarla
  const loadMine = async (db, token) => {
    await expireStale(db);
    const { rows } = await db.query(
      `SELECT r.id, to_char(r.date, 'YYYY-MM-DD') AS date, r.status, r.party_size, r.customer_name, r.decline_reason,
              (r.cancel_requested_at IS NOT NULL) AS cancel_requested, s.name AS shift_name, to_char(s.start_time, 'HH24:MI') AS start_time
       FROM reservations r JOIN booking_shifts s ON s.id = r.shift_id WHERE r.public_token = $1`, [token]);
    if (!rows.length) throw new HttpError(404, 'Richiesta non trovata', 'NOT_FOUND');
    return rows[0];
  };
  const present = (r, restaurant) => ({
    status: r.status, date: r.date, shift_name: r.shift_name, start_time: r.start_time, party_size: r.party_size,
    customer_name: r.customer_name, decline_reason: r.status === 'declined' ? r.decline_reason : '',
    // 'withdraw' | 'request' | 'requested' | 'call' | null (vedi cancelOption)
    cancel: cancelOption(r, r.date, r.start_time, localNow()), restaurant,
  });

  router.get('/requests/:token', ...guard, validate({ params: tokenParamsSchema }), inPortal(async (db, { req, restaurant }) =>
    present(await loadMine(db, req.params.token), { name: restaurant.name, phone: restaurant.phone })));

  // Annullo: una richiesta non ancora confermata si ritira subito; una prenotazione confermata si *chiede* di annullare
  // (il locale decide) e solo fino a un'ora prima del turno; dopo, il cliente deve telefonare.
  router.post('/requests/:token/cancel', ...guard, validate({ params: tokenParamsSchema }), inPortal(async (db, { req, restaurant }) => {
    const outcome = await inTransaction(db, async (tx) => {
      const r = await loadMine(tx, req.params.token);
      await tx.query('SELECT id FROM reservations WHERE id = $1 FOR UPDATE', [r.id]);
      const option = cancelOption(r, r.date, r.start_time, localNow());
      if (option === 'withdraw') {
        await tx.query(`UPDATE reservations SET status = 'cancelled' WHERE id = $1`, [r.id]);
        return { r: { ...r, status: 'cancelled' }, action: 'BOOKING_PORTAL_CANCEL' };
      }
      if (option === 'request') {
        await tx.query('UPDATE reservations SET cancel_requested_at = now() WHERE id = $1', [r.id]);
        return { r: { ...r, cancel_requested: true }, action: 'BOOKING_PORTAL_CANCEL_REQUEST' };
      }
      if (option === 'requested') return { r, action: null };   // già chiesto: non si ripete
      throw new HttpError(409, option === 'call'
        ? `Mancano meno di ${MIN_CANCEL_NOTICE_HOURS === 1 ? 'un\'ora' : `${MIN_CANCEL_NOTICE_HOURS} ore`} al turno: per annullare chiama il locale`
        : 'Questa richiesta non si può più annullare da qui: chiama il locale', 'CANCEL_BY_PHONE');
    });
    if (outcome.action) {
      await logAudit(db, null, outcome.action, { reservationId: outcome.r.id });
      broadcast?.(req.tenantId, { type: 'reservation_updated', reservation: { id: outcome.r.id, status: outcome.r.status, cancel_requested: !!outcome.r.cancel_requested } });
    }
    return present(outcome.r, { name: restaurant.name, phone: restaurant.phone });
  }));

  return router;
}
