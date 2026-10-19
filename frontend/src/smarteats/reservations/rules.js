// Logica pura della vista Prenotazioni (date, gruppi dell'agenda, tavoli occupati, collegamenti per il messaggio).
// Le regole vere (posti, tavoli, stati) le applica il server (backend/utils/bookings.js): qui servono solo a mostrare.

import { minOf, effectiveMin, fitOf, fitCost } from '../floor/seats.js';

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

// ─── Tavoli da unire: vicini, non solo «a sufficienza» ─────────────────────────────────────────────────────────────
// Due tavoli si possono unire se, sulla pianta, il vuoto tra i loro bordi è al massimo di MAX_GAP celle (in
// orizzontale più in verticale). Un insieme è unibile se è «connesso»: ogni tavolo è vicino ad almeno un altro e,
// seguendo i vicini, si arriva da uno qualsiasi a tutti. Un tavolo non piazzato sulla pianta non si unisce a nessuno.
const MAX_GAP = 2;

const placed = (t) => [t.x, t.y, t.w, t.h].every(v => Number.isFinite(v));
export function gapBetween(a, b) {
  if (!placed(a) || !placed(b)) return Infinity;
  const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w));
  const dy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
  return dx + dy;
}

// `tables` con x, y, w, h (in celle). Un solo tavolo è sempre «connesso».
export function tablesConnected(tables, maxGap = MAX_GAP) {
  if (tables.length <= 1) return true;
  const seen = new Set([0]);
  const queue = [0];
  while (queue.length) {
    const i = queue.shift();
    tables.forEach((t, j) => { if (!seen.has(j) && gapBetween(tables[i], t) <= maxGap) { seen.add(j); queue.push(j); } });
  }
  return seen.size === tables.length;
}

// Il tavolo (o i tavoli) migliori per un gruppo: quello che riempie meglio il locale. Ogni tavolo ha un intervallo di posti
// (`seatsMin`…`seats`): il gruppo non deve superare il massimo, mentre sotto il minimo si siede comunque (il modo si trova
// sempre) ma con un costo. Vince la scelta di costo più basso (vedi floor/seats.js): pochi posti vuoti, il tavolo giusto
// e non uno più grande del necessario, pochi tavoli uniti. A parità contano la sala indicata (`preferRoomId`) e la
// distanza fra i tavoli. I tavoli uniti devono essere vicini e della stessa sala. Si provano fino a 3 tavoli e, se non
// basta, fino a 5: un gruppo grande una soluzione la trova se i tavoli liberi ci sono.
// `candidates` = [{ id, seats, seatsMin?, roomId, x, y, w, h }] già liberi per quel turno.
// Ritorna { ids, seats (massimo totale), seatsMin (minimo totale), waste (posti vuoti), under (gruppo sotto il minimo) }
// oppure null se nemmeno tutti i tavoli liberi insieme bastano (allora si sceglie a mano).
export function suggestTables(party, candidates, { preferRoomId = null, maxTables = 3 } = {}) {
  const byRoom = new Map();
  for (const c of candidates.filter(c => c.seats > 0)) byRoom.set(c.roomId, [...(byRoom.get(c.roomId) ?? []), c]);

  const search = (limit) => {
    let best = null;
    const consider = (combo) => {
      const maxSum = combo.reduce((n, c) => n + c.seats, 0);
      const minSum = combo.reduce((n, c) => n + effectiveMin(c), 0);
      const fit = fitOf(party, minSum, maxSum);
      if (!fit || !tablesConnected(combo)) return;
      let spread = 0;
      for (let i = 0; i < combo.length; i++) for (let j = i + 1; j < combo.length; j++) spread += gapBetween(combo[i], combo[j]);
      const candidate = { combo, maxSum, minSum: combo.reduce((n, c) => n + minOf(c), 0), fit, cost: fitCost(fit, combo.length), room: combo[0].roomId === preferRoomId ? 0 : 1, spread };
      const keys = ['cost', 'room', 'spread'];
      if (!best || keys.some((k, n) => candidate[k] !== best[k] && keys.slice(0, n).every(p => candidate[p] === best[p]) && candidate[k] < best[k])) best = candidate;
    };
    // tutte le combinazioni di 1…limit tavoli della stessa sala
    const grow = (list, start, combo) => {
      if (combo.length) consider(combo);
      if (combo.length === limit) return;
      for (let i = start; i < list.length; i++) grow(list, i + 1, [...combo, list[i]]);
    };
    for (const list of byRoom.values()) grow(list, 0, []);
    return best;
  };

  const best = search(maxTables) ?? (maxTables < 5 ? search(5) : null);
  return best ? { ids: best.combo.map(c => c.id), seats: best.maxSum, seatsMin: best.minSum, waste: best.fit.waste, under: best.fit.shortfall > 0 } : null;
}
