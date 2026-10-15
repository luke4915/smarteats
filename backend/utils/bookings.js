// Regole pure delle prenotazioni (migrazione 044, docs/design-prenotazioni.md): stati, posti, orari e sovrapposizioni.
// Niente database: sono funzioni con test (tests/bookings.test.js). Le date sono stringhe `YYYY-MM-DD` nel locale,
// le ore sono `HH:MM` o `HH:MM:SS`.

export const STATUSES = ['requested', 'confirmed', 'declined', 'cancelled', 'seated', 'no_show', 'expired'];

// Da quali stati si può passare a quali. Gli stati finali non hanno uscite.
const TRANSITIONS = {
  requested: ['confirmed', 'declined', 'cancelled', 'expired'],
  confirmed: ['seated', 'no_show', 'cancelled'],
  seated: [],
  declined: [],
  cancelled: [],
  no_show: [],
  expired: [],
};
export const canTransition = (from, to) => (TRANSITIONS[from] ?? []).includes(to);

// Stati che occupano posti nel turno e tavoli: una richiesta in attesa tiene il posto finché non si decide.
export const HOLDS_SEATS = ['requested', 'confirmed', 'seated'];
export const holdsSeats = (status) => HOLDS_SEATS.includes(status);

// Dopo quante ore una richiesta non decisa decade da sola e il posto torna libero.
export const REQUEST_TTL_HOURS = 24;
export const isExpired = (requestedAt, now = Date.now(), ttlHours = REQUEST_TTL_HOURS) =>
  now - new Date(requestedAt).getTime() >= ttlHours * 3600 * 1000;

// Minuti dalla mezzanotte di «HH:MM[:SS]».
export function minutesOf(time) {
  const [h, m] = String(time).split(':').map(Number);
  return h * 60 + (m || 0);
}

// L'intervallo (in minuti dalla mezzanotte del giorno) in cui il tavolo è impegnato da un turno.
export const shiftInterval = (shift) => {
  const start = minutesOf(shift.start_time);
  return { start, end: start + Number(shift.duration_minutes) };
};

// Due intervalli si sovrappongono se uno inizia prima che l'altro finisca; toccarsi non conta (finisce 21:00, inizia 21:00).
export const overlaps = (a, b) => a.start < b.end && b.start < a.end;

// Giorno della settimana (0 = domenica) di una data `YYYY-MM-DD`, senza fusi orari.
export function weekdayOf(date) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// Il turno si fa in quella data? (attivo, giorno della settimana giusto, nessuna chiusura che lo copre)
export function shiftOpenOn(shift, date, closures = []) {
  if (!shift.active) return { open: false, reason: 'Turno non attivo' };
  if (!(shift.weekdays ?? []).includes(weekdayOf(date))) return { open: false, reason: 'Turno non previsto in questo giorno' };
  const closure = closures.find(c => date >= c.date_from && date <= c.date_to && (c.shift_id === null || c.shift_id === shift.id));
  if (closure) return { open: false, reason: closure.reason || 'Chiuso' };
  return { open: true };
}

// Posti ancora liberi nel turno: capienza meno i coperti che tengono il posto. `reservations` della stessa data e turno.
export function freeSeats(capacity, reservations, { now = Date.now() } = {}) {
  const held = reservations
    .filter(r => holdsSeats(r.status) && !(r.status === 'requested' && isExpired(r.requested_at, now)))
    .reduce((sum, r) => sum + r.party_size, 0);
  return { held, free: capacity - held };
}

// Prenotazioni attive che occupano uno stesso tavolo in un orario che si sovrappone a quello dato. `others` hanno già
// `table_ids`, `shift` e `date`.
export function tableConflicts({ date, shift, tableIds }, others) {
  const mine = shiftInterval(shift);
  return others.filter(o =>
    o.date === date && holdsSeats(o.status) && o.table_ids.some(id => tableIds.includes(id)) && overlaps(mine, shiftInterval(o.shift)));
}

// Il testo del messaggio di conferma per il cliente (il personale lo invia con il proprio telefono).
export function confirmationMessage({ restaurant, date, shift, party_size, customer_name }) {
  const [y, m, d] = date.split('-').map(Number);
  const day = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
  const time = String(shift.start_time).slice(0, 5);
  return `Buongiorno ${customer_name}, la prenotazione è confermata: ${day} alle ${time}, ${party_size} ${party_size === 1 ? 'persona' : 'persone'}${restaurant ? ` da ${restaurant}` : ''}. A presto!`;
}
