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
import {
  shiftSchema, closureSchema, closuresQuerySchema, createReservationSchema, updateReservationSchema, declineSchema,
  reservationTablesSchema, arrivedSchema, reservationsQuerySchema, availabilityQuerySchema,
} from '../schemas/bookingSchema.js';
import { canTransition, freeSeats, shiftOpenOn, tableConflicts, confirmationMessage, REQUEST_TTL_HOURS } from '../utils/bookings.js';
import { SHIFT_COLUMNS, CLOSURE_COLUMNS, lockShift, closuresOn, assertBookable } from '../utils/bookingDb.js';
import { openCheckOnTable } from '../utils/openCheck.js';
import { getCheckSummary } from '../utils/checks.js';

// Prenotazioni (modulo `bookings`, solo ristoranti). Si leggono e si gestiscono con i ruoli di sala; turni e chiusure
// li scrive solo l'admin. Disegno e regole: docs/design-prenotazioni.md. Evento: `reservation_updated` al personale.
const router = express.Router();
const guard = [authenticate, requireModule('bookings')];
const RESERVATION_SQL = `
  SELECT r.id, to_char(r.date, 'YYYY-MM-DD') AS date, r.shift_id, r.party_size, r.status, r.customer_name, r.phone, r.email,
         r.notes, r.source, r.external_id, r.public_token, r.requested_at, r.decided_by, r.decided_at, r.decline_reason, r.check_id,
         s.name AS shift_name, to_char(s.start_time, 'HH24:MI') AS start_time, s.duration_minutes,
         COALESCE((SELECT array_agg(rt.table_id ORDER BY rt.table_id) FROM reservation_tables rt WHERE rt.reservation_id = r.id), '{}') AS table_ids
  FROM reservations r JOIN booking_shifts s ON s.id = r.shift_id`;

const withShift = (r) => ({ ...r, shift: { id: r.shift_id, name: r.shift_name, start_time: r.start_time, duration_minutes: r.duration_minutes } });

export default function (broadcast) {
  const notify = (tenantId, reservation) => broadcast?.(tenantId, { type: 'reservation_updated', reservation });

  // Le richieste non decise da più di 24 ore decadono: il posto torna libero. Si fa quando si legge o si decide.
  const expireStale = (db) => db.query(
    `UPDATE reservations SET status = 'expired' WHERE status = 'requested' AND requested_at < now() - make_interval(hours => $1)`, [REQUEST_TTL_HOURS]);

  const load = async (db, where, params) => {
    const { rows } = await db.query(`${RESERVATION_SQL} WHERE ${where} ORDER BY s.start_time, r.id`, params);
    return rows.map(withShift);
  };
  const loadOne = async (db, id) => {
    const [row] = await load(db, 'r.id = $1', [id]);
    if (!row) throw new HttpError(404, 'Prenotazione non trovata');
    return row;
  };
  const restaurantName = async (db, tenantId) => (await db.query('SELECT name FROM tenants WHERE id = $1', [tenantId])).rows[0]?.name ?? '';
  const present = async (db, tenantId, id) => {
    const r = await loadOne(db, id);
    return { ...r, confirmation_message: confirmationMessage({ restaurant: await restaurantName(db, tenantId), date: r.date, shift: r.shift, party_size: r.party_size, customer_name: r.customer_name }) };
  };

  // Assegna i tavoli (sostituisce quelli di prima) controllando che esistano, siano attivi e non siano già impegnati da
  // un'altra prenotazione attiva con orario sovrapposto.
  async function assignTables(db, reservation, tableIds) {
    if (tableIds.length) {
      const { rows: tables } = await db.query('SELECT id, name, active FROM dining_tables WHERE id = ANY($1::int[])', [tableIds]);
      if (tables.length !== tableIds.length) throw new HttpError(400, 'Tavolo non valido', 'INVALID_TABLE');
      const inactive = tables.find(t => !t.active);
      if (inactive) throw new HttpError(409, `Il tavolo ${inactive.name} è disattivato`, 'TABLE_INACTIVE');
      const others = (await load(db, `r.date = $1 AND r.id <> $2 AND r.status IN ('requested', 'confirmed', 'seated')`, [reservation.date, reservation.id]));
      const clash = tableConflicts({ date: reservation.date, shift: reservation.shift, tableIds }, others);
      if (clash.length) {
        const name = tables.find(t => clash[0].table_ids.includes(t.id))?.name ?? '';
        throw new HttpError(409, `Il tavolo ${name} è già assegnato a ${clash[0].customer_name} (${clash[0].start_time})`, 'TABLE_TAKEN');
      }
    }
    await db.query('DELETE FROM reservation_tables WHERE reservation_id = $1', [reservation.id]);
    for (const tableId of tableIds) await db.query('INSERT INTO reservation_tables (reservation_id, table_id) VALUES ($1, $2)', [reservation.id, tableId]);
  }

  // Cambia stato rispettando le transizioni; ritorna la prenotazione com'era prima.
  async function transition(db, id, to, { userId, reason } = {}) {
    const { rows } = await db.query('SELECT id, status FROM reservations WHERE id = $1 FOR UPDATE', [id]);
    if (!rows.length) throw new HttpError(404, 'Prenotazione non trovata');
    if (!canTransition(rows[0].status, to))
      throw new HttpError(409, `La prenotazione è già «${rows[0].status}»: non si può passare a «${to}»`, 'INVALID_TRANSITION');
    await db.query(
      `UPDATE reservations SET status = $1, decided_by = $2, decided_at = now(), decline_reason = COALESCE($3, decline_reason) WHERE id = $4`,
      [to, userId ?? null, reason ?? null, id]);
    return rows[0].status;
  }

  // ── Turni ─────────────────────────────────────────────────────────────────
  router.get('/shifts', ...guard, authorizeWaiter, tenantScope, async (req, res) => {
    try {
      res.json((await req.db.query(`SELECT ${SHIFT_COLUMNS} FROM booking_shifts ORDER BY position, start_time, id`)).rows);
    } catch (err) {
      logger.error({ err }, 'Errore GET /api/bookings/shifts');
      res.status(500).json({ error: 'Errore caricamento turni' });
    }
  });

  router.post('/shifts', ...guard, authorizeAdmin, validate({ body: shiftSchema }), tenantScope, async (req, res) => {
    const s = req.body;
    try {
      const { rows } = await req.db.query(
        `INSERT INTO booking_shifts (name, start_time, duration_minutes, weekdays, capacity, active, position)
         VALUES ($1, $2, $3, $4, $5, $6, COALESCE((SELECT MAX(position) + 1 FROM booking_shifts), 0)) RETURNING ${SHIFT_COLUMNS}`,
        [s.name, s.start_time, s.duration_minutes, s.weekdays, s.capacity, s.active]);
      await logAudit(req.db, req.user.id, 'BOOKING_SHIFT_CREATE', { shiftId: rows[0].id, name: s.name });
      res.status(201).json(rows[0]);
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Esiste già un turno con questo nome', code: 'SHIFT_EXISTS' });
      logger.error({ err }, 'Errore POST /api/bookings/shifts');
      res.status(500).json({ error: 'Errore creazione turno' });
    }
  });

  router.put('/shifts/:id', ...guard, authorizeAdmin, validate({ params: idParamsSchema, body: shiftSchema }), tenantScope, async (req, res) => {
    const s = req.body;
    try {
      const { rows } = await req.db.query(
        `UPDATE booking_shifts SET name = $1, start_time = $2, duration_minutes = $3, weekdays = $4, capacity = $5, active = $6
         WHERE id = $7 RETURNING ${SHIFT_COLUMNS}`,
        [s.name, s.start_time, s.duration_minutes, s.weekdays, s.capacity, s.active, req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'Turno non trovato' });
      await logAudit(req.db, req.user.id, 'BOOKING_SHIFT_UPDATE', { shiftId: rows[0].id, name: s.name });
      res.json(rows[0]);
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Esiste già un turno con questo nome', code: 'SHIFT_EXISTS' });
      logger.error({ err }, 'Errore PUT /api/bookings/shifts/:id');
      res.status(500).json({ error: 'Errore aggiornamento turno' });
    }
  });

  // Un turno con prenotazioni non si elimina (409): si disattiva.
  router.delete('/shifts/:id', ...guard, authorizeAdmin, validate({ params: idParamsSchema }), tenantScope, async (req, res) => {
    try {
      const { rows } = await req.db.query('DELETE FROM booking_shifts WHERE id = $1 RETURNING id, name', [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'Turno non trovato' });
      await logAudit(req.db, req.user.id, 'BOOKING_SHIFT_DELETE', { shiftId: rows[0].id, name: rows[0].name });
      res.json({ success: true });
    } catch (err) {
      if (err.code === '23503') return res.status(409).json({ error: 'Il turno ha delle prenotazioni: disattivalo invece di eliminarlo', code: 'SHIFT_IN_USE' });
      logger.error({ err }, 'Errore DELETE /api/bookings/shifts/:id');
      res.status(500).json({ error: 'Errore eliminazione turno' });
    }
  });

  // ── Chiusure ──────────────────────────────────────────────────────────────
  router.get('/closures', ...guard, authorizeWaiter, validate({ query: closuresQuerySchema }), tenantScope, async (req, res) => {
    const { from = null, to = null } = req.validQuery;
    try {
      res.json((await req.db.query(
        `SELECT ${CLOSURE_COLUMNS} FROM booking_closures WHERE ($1::date IS NULL OR date_to >= $1) AND ($2::date IS NULL OR date_from <= $2) ORDER BY date_from, id`,
        [from, to])).rows);
    } catch (err) {
      logger.error({ err }, 'Errore GET /api/bookings/closures');
      res.status(500).json({ error: 'Errore caricamento chiusure' });
    }
  });

  router.post('/closures', ...guard, authorizeAdmin, validate({ body: closureSchema }), tenantScope, async (req, res) => {
    const c = req.body;
    try {
      const { rows } = await req.db.query(
        `INSERT INTO booking_closures (date_from, date_to, shift_id, reason) VALUES ($1, $2, $3, $4) RETURNING ${CLOSURE_COLUMNS}`,
        [c.date_from, c.date_to, c.shift_id, c.reason]);
      await logAudit(req.db, req.user.id, 'BOOKING_CLOSURE_CREATE', { closureId: rows[0].id, from: c.date_from, to: c.date_to });
      res.status(201).json(rows[0]);
    } catch (err) {
      if (err.code === '23503') return res.status(400).json({ error: 'Turno non valido', code: 'INVALID_SHIFT' });
      logger.error({ err }, 'Errore POST /api/bookings/closures');
      res.status(500).json({ error: 'Errore creazione chiusura' });
    }
  });

  router.delete('/closures/:id', ...guard, authorizeAdmin, validate({ params: idParamsSchema }), tenantScope, async (req, res) => {
    try {
      const { rows } = await req.db.query('DELETE FROM booking_closures WHERE id = $1 RETURNING id', [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'Chiusura non trovata' });
      await logAudit(req.db, req.user.id, 'BOOKING_CLOSURE_DELETE', { closureId: rows[0].id });
      res.json({ success: true });
    } catch (err) {
      logger.error({ err }, 'Errore DELETE /api/bookings/closures/:id');
      res.status(500).json({ error: 'Errore eliminazione chiusura' });
    }
  });

  // ── Disponibilità e agenda ─────────────────────────────────────────────────
  // Per ogni turno attivo della data: capienza, posti tenuti, posti liberi, prenotabile o no (e perché).
  router.get('/availability', ...guard, authorizeWaiter, validate({ query: availabilityQuerySchema }), tenantScope, async (req, res) => {
    const { date } = req.validQuery;
    try {
      await expireStale(req.db);
      const shifts = (await req.db.query(`SELECT ${SHIFT_COLUMNS} FROM booking_shifts ORDER BY position, start_time, id`)).rows;
      const closures = await closuresOn(req.db, date);
      const { rows: taken } = await req.db.query('SELECT shift_id, status, party_size, requested_at FROM reservations WHERE date = $1', [date]);
      res.json(shifts.map((s) => {
        const open = shiftOpenOn(s, date, closures);
        const { held, free } = freeSeats(s.capacity, taken.filter(r => r.shift_id === s.id));
        return { shift_id: s.id, name: s.name, start_time: s.start_time, capacity: s.capacity, held, free: Math.max(0, free), over: Math.max(0, -free), bookable: open.open && free > 0, reason: open.open ? (free > 0 ? '' : 'Al completo') : open.reason };
      }));
    } catch (err) {
      logger.error({ err }, 'Errore GET /api/bookings/availability');
      res.status(500).json({ error: 'Errore calcolo disponibilità' });
    }
  });

  router.get('/reservations', ...guard, authorizeWaiter, validate({ query: reservationsQuerySchema }), tenantScope, async (req, res) => {
    const { date, shift_id: shiftId = null } = req.validQuery;
    try {
      await expireStale(req.db);
      res.json(await load(req.db, 'r.date = $1 AND ($2::int IS NULL OR r.shift_id = $2)', [date, shiftId]));
    } catch (err) {
      logger.error({ err }, 'Errore GET /api/bookings/reservations');
      res.status(500).json({ error: 'Errore caricamento prenotazioni' });
    }
  });

  router.get('/reservations/:id', ...guard, authorizeWaiter, validate({ params: idParamsSchema }), tenantScope, async (req, res) => {
    try {
      res.json(await present(req.db, req.user.tenantId, req.params.id));
    } catch (err) {
      if (sendHttpError(res, err)) return;
      logger.error({ err }, 'Errore GET /api/bookings/reservations/:id');
      res.status(500).json({ error: 'Errore caricamento prenotazione' });
    }
  });

  // ── Prenotazioni ──────────────────────────────────────────────────────────
  // Inserimento a mano: nasce confermata. Con `table_ids` assegna subito i tavoli.
  router.post('/reservations', ...guard, authorizeWaiter, validate({ body: createReservationSchema }), tenantScope, async (req, res) => {
    const b = req.body;
    try {
      const id = await inTransaction(req.db, async (db) => {
        const shift = await lockShift(db, b.shift_id);
        await assertBookable(db, shift, b.date, b.party_size, { ignoreCapacity: b.ignore_capacity });
        const { rows: [created] } = await db.query(
          `INSERT INTO reservations (date, shift_id, party_size, status, customer_name, phone, email, notes, source, public_token, decided_by, decided_at, created_by)
           VALUES ($1, $2, $3, 'confirmed', $4, $5, $6, $7, 'staff', $8, $9, now(), $9) RETURNING id`,
          [b.date, b.shift_id, b.party_size, b.customer_name, b.phone, b.email, b.notes, crypto.randomBytes(18).toString('base64url'), req.user.id]);
        if (b.table_ids.length) await assignTables(db, { id: created.id, date: b.date, shift: { ...shift } }, b.table_ids);
        return created.id;
      });
      await logAudit(req.db, req.user.id, 'BOOKING_CREATE', { reservationId: id, date: b.date, shiftId: b.shift_id, partySize: b.party_size });
      const reservation = await present(req.db, req.user.tenantId, id);
      notify(req.user.tenantId, reservation);
      res.status(201).json(reservation);
    } catch (err) {
      if (sendHttpError(res, err)) return;
      logger.error({ err }, 'Errore POST /api/bookings/reservations');
      res.status(500).json({ error: 'Errore creazione prenotazione' });
    }
  });

  router.put('/reservations/:id', ...guard, authorizeWaiter, validate({ params: idParamsSchema, body: updateReservationSchema }), tenantScope, async (req, res) => {
    const b = req.body;
    try {
      await inTransaction(req.db, async (db) => {
        const { rows } = await db.query(`SELECT id, to_char(date, 'YYYY-MM-DD') AS date, shift_id, party_size, status FROM reservations WHERE id = $1 FOR UPDATE`, [req.params.id]);
        if (!rows.length) throw new HttpError(404, 'Prenotazione non trovata');
        const cur = rows[0];
        if (!['requested', 'confirmed'].includes(cur.status)) throw new HttpError(409, 'Si modificano solo richieste e prenotazioni confermate', 'INVALID_TRANSITION');
        const next = { date: b.date ?? cur.date, shift_id: b.shift_id ?? cur.shift_id, party_size: b.party_size ?? cur.party_size };
        if (next.date !== cur.date || next.shift_id !== cur.shift_id || next.party_size !== cur.party_size) {
          const shift = await lockShift(db, next.shift_id);
          await assertBookable(db, shift, next.date, next.party_size, { ignoreCapacity: b.ignore_capacity, excludeId: cur.id });
          // spostata o cambiata di turno: i tavoli assegnati devono ancora andare bene, altrimenti si liberano
          if (next.date !== cur.date || next.shift_id !== cur.shift_id) await db.query('DELETE FROM reservation_tables WHERE reservation_id = $1', [cur.id]);
        }
        await db.query(
          `UPDATE reservations SET date = $1, shift_id = $2, party_size = $3, customer_name = COALESCE($4, customer_name),
             phone = COALESCE($5, phone), email = COALESCE($6, email), notes = COALESCE($7, notes) WHERE id = $8`,
          [next.date, next.shift_id, next.party_size, b.customer_name ?? null, b.phone ?? null, b.email ?? null, b.notes ?? null, cur.id]);
      });
      await logAudit(req.db, req.user.id, 'BOOKING_UPDATE', { reservationId: Number(req.params.id) });
      const reservation = await present(req.db, req.user.tenantId, req.params.id);
      notify(req.user.tenantId, reservation);
      res.json(reservation);
    } catch (err) {
      if (sendHttpError(res, err)) return;
      logger.error({ err }, 'Errore PUT /api/bookings/reservations/:id');
      res.status(500).json({ error: 'Errore aggiornamento prenotazione' });
    }
  });

  // Cambi di stato: stessa forma, cambia l'esito.
  const stateRoute = (path, to, action, { body } = {}) => router.post(`/reservations/:id/${path}`, ...guard, authorizeWaiter,
    validate({ params: idParamsSchema, ...(body && { body }) }), tenantScope, async (req, res) => {
      try {
        await inTransaction(req.db, async (db) => {
          await expireStale(db);
          if (to === 'confirmed') {
            // confermando si ricontrolla che il turno sia ancora prenotabile e ci siano i posti
            const { rows } = await db.query(`SELECT to_char(date, 'YYYY-MM-DD') AS date, shift_id, party_size FROM reservations WHERE id = $1`, [req.params.id]);
            if (rows.length) {
              const shift = await lockShift(db, rows[0].shift_id);
              await assertBookable(db, shift, rows[0].date, rows[0].party_size, { excludeId: Number(req.params.id), ignoreCapacity: req.body?.ignore_capacity });
            }
          }
          await transition(db, req.params.id, to, { userId: req.user.id, reason: req.body?.reason });
        });
        await logAudit(req.db, req.user.id, action, { reservationId: Number(req.params.id) });
        const reservation = await present(req.db, req.user.tenantId, req.params.id);
        notify(req.user.tenantId, reservation);
        res.json(reservation);
      } catch (err) {
        if (sendHttpError(res, err)) return;
        logger.error({ err }, `Errore POST /api/bookings/reservations/:id/${path}`);
        res.status(500).json({ error: 'Errore aggiornamento prenotazione' });
      }
    });
  stateRoute('confirm', 'confirmed', 'BOOKING_CONFIRM');
  stateRoute('decline', 'declined', 'BOOKING_DECLINE', { body: declineSchema });
  stateRoute('cancel', 'cancelled', 'BOOKING_CANCEL');
  stateRoute('no-show', 'no_show', 'BOOKING_NO_SHOW');

  router.put('/reservations/:id/tables', ...guard, authorizeWaiter, validate({ params: idParamsSchema, body: reservationTablesSchema }), tenantScope, async (req, res) => {
    try {
      await inTransaction(req.db, async (db) => {
        const { rows } = await db.query('SELECT id, status FROM reservations WHERE id = $1 FOR UPDATE', [req.params.id]);
        if (!rows.length) throw new HttpError(404, 'Prenotazione non trovata');
        if (!['requested', 'confirmed'].includes(rows[0].status)) throw new HttpError(409, 'I tavoli si assegnano a richieste e prenotazioni confermate', 'INVALID_TRANSITION');
        await assignTables(db, await loadOne(db, req.params.id), req.body.table_ids);
      });
      await logAudit(req.db, req.user.id, 'BOOKING_TABLES', { reservationId: Number(req.params.id), tableIds: req.body.table_ids });
      const reservation = await present(req.db, req.user.tenantId, req.params.id);
      notify(req.user.tenantId, reservation);
      res.json(reservation);
    } catch (err) {
      if (sendHttpError(res, err)) return;
      logger.error({ err }, 'Errore PUT /api/bookings/reservations/:id/tables');
      res.status(500).json({ error: 'Errore assegnazione tavoli' });
    }
  });

  // Il cliente è arrivato: si apre il conto sul tavolo assegnato con i coperti già inseriti e la prenotazione è «seduta».
  router.post('/reservations/:id/arrived', ...guard, authorizeWaiter, validate({ params: idParamsSchema, body: arrivedSchema }), tenantScope, async (req, res) => {
    try {
      const checkId = await inTransaction(req.db, async (db) => {
        const r = await loadOne(db, req.params.id);
        if (r.status !== 'confirmed') throw new HttpError(409, 'Si accoglie solo una prenotazione confermata', 'INVALID_TRANSITION');
        if (!r.table_ids.length) throw new HttpError(400, 'Assegna prima un tavolo', 'NO_TABLE');
        const tableId = req.body.table_id ?? r.table_ids[0];
        if (!r.table_ids.includes(tableId)) throw new HttpError(400, 'Il tavolo non è tra quelli assegnati', 'INVALID_TABLE');
        const id = await openCheckOnTable(db, { tenantId: req.user.tenantId, userId: req.user.id, tableId, covers: r.party_size });
        await transition(db, r.id, 'seated', { userId: req.user.id });
        await db.query('UPDATE reservations SET check_id = $1 WHERE id = $2', [id, r.id]);
        return id;
      });
      await logAudit(req.db, req.user.id, 'BOOKING_ARRIVED', { reservationId: Number(req.params.id), checkId });
      const reservation = await present(req.db, req.user.tenantId, req.params.id);
      const check = await getCheckSummary(req.db, checkId);
      notify(req.user.tenantId, reservation);
      broadcast?.(req.user.tenantId, { type: 'check_updated', check });
      res.json({ reservation, check });
    } catch (err) {
      if (err.code === '23505' && err.constraint === 'uniq_checks_open_table')
        return res.status(409).json({ error: 'Il tavolo ha già un conto aperto', code: 'TABLE_BUSY' });
      if (sendHttpError(res, err)) return;
      logger.error({ err }, 'Errore POST /api/bookings/reservations/:id/arrived');
      res.status(500).json({ error: 'Errore accoglienza' });
    }
  });

  return router;
}
