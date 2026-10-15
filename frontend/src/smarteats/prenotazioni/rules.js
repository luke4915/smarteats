// Logica pura della vista Prenotazioni (date, gruppi dell'agenda, tavoli occupati, collegamenti per il messaggio).
// Le regole vere (posti, tavoli, stati) le applica il server (backend/utils/bookings.js): qui servono solo a mostrare.

const pad = (n) => String(n).padStart(2, '0');

// La data di oggi sul dispositivo, `AAAA-MM-GG`. Il locale prenota nel proprio giorno, senza fusi orari.
export const todayLocal = (now = new Date()) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

export function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function formatDay(date, { short = false } = {}) {
  const [y, m, d] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('it-IT', short
    ? { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }
    : { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
}

export const STATUS = {
  requested: { label: 'Da confermare', tone: 'amber' },
  confirmed: { label: 'Confermata', tone: 'green' },
  seated: { label: 'Al tavolo', tone: 'accent' },
  completed: { label: 'Conclusa', tone: 'muted' },
  declined: { label: 'Rifiutata', tone: 'muted' },
  cancelled: { label: 'Annullata', tone: 'muted' },
  no_show: { label: 'Non si è presentata', tone: 'muted' },
  expired: { label: 'Scaduta', tone: 'muted' },
};
export const isActive = (status) => ['requested', 'confirmed', 'seated'].includes(status);

// Le prenotazioni della giornata divise per cosa serve fare: prima quelle da decidere.
export function agendaGroups(reservations) {
  const by = (statuses) => reservations.filter(r => statuses.includes(r.status));
  return [
    { key: 'requested', title: 'Da confermare', items: by(['requested']) },
    { key: 'confirmed', title: 'Confermate', items: by(['confirmed']) },
    { key: 'seated', title: 'Al tavolo', items: by(['seated']) },
    { key: 'closed', title: 'Concluse e chiuse', items: by(['completed', 'declined', 'cancelled', 'no_show', 'expired']) },
  ].filter(g => g.items.length);
}

export const minutesOf = (time) => { const [h, m] = String(time).split(':').map(Number); return h * 60 + (m || 0); };
const interval = (r) => ({ start: minutesOf(r.start_time), end: minutesOf(r.start_time) + Number(r.duration_minutes) });
export const overlaps = (a, b) => a.start < b.end && b.start < a.end;

// Chi occupa già quel tavolo in un orario che si sovrappone a quello di `reservation`, tra le altre prenotazioni attive
// dello stesso giorno. Ritorna la prenotazione in conflitto, o null.
export function tableTakenBy(tableId, reservation, others) {
  const mine = interval(reservation);
  return others.find(o => o.id !== reservation.id && o.date === reservation.date && ['requested', 'confirmed', 'seated'].includes(o.status)
    && o.table_ids.includes(tableId) && overlaps(mine, interval(o))) ?? null;
}

// Per la Sala: per ogni tavolo la prossima prenotazione confermata, non ancora al tavolo (la più vicina per orario).
export function nextByTable(reservations) {
  const map = new Map();
  for (const r of [...reservations].filter(x => x.status === 'confirmed').sort((a, b) => minutesOf(a.start_time) - minutesOf(b.start_time)))
    for (const id of r.table_ids) if (!map.has(id)) map.set(id, r);
  return map;
}

// Collegamento WhatsApp: numeri italiani senza prefisso (3xx…) ricevono il +39; «00…» e «+…» si normalizzano.
export function whatsappLink(phone, text) {
  let digits = String(phone ?? '').replace(/[^\d+]/g, '');
  if (!digits) return null;
  if (digits.startsWith('+')) digits = digits.slice(1);
  else if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.startsWith('3') || digits.startsWith('0')) digits = `39${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
export const mailLink = (email, subject, text) => (email ? `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}` : null);
export const telLink = (phone) => (String(phone ?? '').trim() ? `tel:${String(phone).replace(/[^\d+]/g, '')}` : null);
