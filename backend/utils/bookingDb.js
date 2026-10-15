import { HttpError } from './httpError.js';
import { freeSeats, shiftOpenOn } from './bookings.js';

// Accesso ai turni e alla disponibilità, condiviso da chi prenota (personale: routes/bookings.js, clienti: routes/publicBooking.js).
// Le regole pure stanno in utils/bookings.js; qui solo le query. Vanno chiamate con la connessione del locale (RLS).
export const SHIFT_COLUMNS = `id, name, to_char(start_time, 'HH24:MI') AS start_time, duration_minutes, weekdays, capacity, active, position`;
export const CLOSURE_COLUMNS = `id, to_char(date_from, 'YYYY-MM-DD') AS date_from, to_char(date_to, 'YYYY-MM-DD') AS date_to, shift_id, reason`;

// Blocca il turno (serializza chi prenota lo stesso turno) e lo ritorna.
export async function lockShift(db, shiftId) {
  const { rows } = await db.query(`SELECT ${SHIFT_COLUMNS} FROM booking_shifts WHERE id = $1 FOR UPDATE`, [shiftId]);
  if (!rows.length) throw new HttpError(404, 'Turno non trovato');
  return rows[0];
}

export const closuresOn = async (db, date) =>
  (await db.query(`SELECT ${CLOSURE_COLUMNS} FROM booking_closures WHERE date_from <= $1 AND date_to >= $1`, [date])).rows;

// Il turno è prenotabile in quella data e i posti bastano (a meno che il personale non accetti di proposito).
export async function assertBookable(db, shift, date, partySize, { ignoreCapacity = false, excludeId = null } = {}) {
  const open = shiftOpenOn(shift, date, await closuresOn(db, date));
  if (!open.open) throw new HttpError(409, `Il turno non è prenotabile: ${open.reason}`, 'SHIFT_CLOSED');
  const { rows } = await db.query(
    `SELECT status, party_size, requested_at FROM reservations WHERE date = $1 AND shift_id = $2 AND ($3::int IS NULL OR id <> $3)`,
    [date, shift.id, excludeId]);
  const { free } = freeSeats(shift.capacity, rows);
  if (!ignoreCapacity && free < partySize)
    throw new HttpError(409, free > 0 ? `Posti insufficienti: ne restano ${free}` : 'Il turno è al completo', 'NO_CAPACITY');
}
