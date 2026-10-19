import { minutesOf, isActive } from './rules.js';
import { effectiveMin, fitOf, fitCost } from '../floor/seats.js';

// Logica pura della vista Timeline (tavoli in riga, ore in colonna) e dei walk-in. Tutti gli orari sono minuti dalla mezzanotte.
export const STEP = 15;                  // una colonna = 15 minuti
const WALK_IN_MINUTES = 75;       // quanto si considera occupato un tavolo dato a chi arriva senza prenotazione
const DEFAULT_WINDOW = { start: 12 * 60, end: 24 * 60 };

export const minutesNow = (now = new Date()) => now.getHours() * 60 + now.getMinutes();
export const clockOf = (minutes) => `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

// L'intervallo di ore da disegnare: dal primo turno (mezz'ora prima) all'ultima fine (mezz'ora dopo), a mezz'ore intere;
// `openedAt` = minuti di apertura dei conti aperti.
export function timelineWindow(shifts, reservations = [], openedAt = []) {
  const spans = [
    ...shifts.filter(s => s.active !== false).map(s => ({ start: minutesOf(s.start_time), end: minutesOf(s.start_time) + Number(s.duration_minutes) })),
    ...reservations.filter(r => isActive(r.status)).map(r => ({ start: minutesOf(r.start_time), end: minutesOf(r.start_time) + Number(r.duration_minutes) })),
    ...openedAt.map(m => ({ start: m, end: m + WALK_IN_MINUTES })),   // un conto aperto fuori dai turni deve restare visibile
  ];
  if (!spans.length) return DEFAULT_WINDOW;
  const start = Math.max(0, Math.floor((Math.min(...spans.map(s => s.start)) - 30) / 30) * 30);
  const end = Math.min(24 * 60, Math.ceil((Math.max(...spans.map(s => s.end)) + 30) / 30) * 30);
  return { start, end: Math.max(end, start + 120) };
}

// I blocchi di un tavolo: le prenotazioni attive che lo hanno assegnato e il conto aperto (chi è arrivato senza
// prenotazione, o è già seduto). Una prenotazione «al tavolo» non si duplica col suo conto.
export function blocksForTable(tableId, reservations, checks, { isToday, nowMin }) {
  const blocks = [];
  const seatedChecks = new Set(reservations.filter(r => r.check_id).map(r => r.check_id));
  for (const r of reservations.filter(r => isActive(r.status) && r.table_ids.includes(tableId))) {
    const start = minutesOf(r.start_time);
    blocks.push({ kind: 'reservation', id: r.id, status: r.status, start, end: start + Number(r.duration_minutes), title: r.customer_name, party: r.party_size, time: r.start_time });
  }
  if (isToday) {
    for (const c of checks.filter(c => c.table_id === tableId && !seatedChecks.has(c.id))) {
      const opened = new Date(c.opened_at);
      const start = opened.getHours() * 60 + opened.getMinutes();
      blocks.push({ kind: 'check', id: c.id, status: 'walkin', start, end: Math.max(start + WALK_IN_MINUTES, nowMin + 15), title: 'Senza prenotazione', party: c.covers, time: clockOf(start) });
    }
  }
  return blocks.sort((a, b) => a.start - b.start);
}

// Prenotazioni attive che aspettano un tavolo.
export const unassigned = (reservations) => reservations.filter(r => ['requested', 'confirmed'].includes(r.status) && r.table_ids.length === 0);

// Tavoli dove far sedere ora chi arriva senza prenotazione: attivi, senza conto aperto e senza una prenotazione che si
// sovrappone nei prossimi `WALK_IN_MINUTES`. Dal migliore: pochi posti sprecati, poi nella sala indicata. Un gruppo che
// non sta in nessun tavolo libero vede comunque i tavoli, dal più capiente.
export function walkInTables(party, rooms, reservations, checks, { nowMin, horizon = WALK_IN_MINUTES }) {
  const busy = new Set(checks.map(c => c.table_id));
  const window = { start: nowMin, end: nowMin + horizon };
  const reserved = new Set();
  for (const r of reservations.filter(r => ['requested', 'confirmed'].includes(r.status))) {
    const start = minutesOf(r.start_time);
    if (start < window.end && window.start < start + Number(r.duration_minutes)) r.table_ids.forEach(id => reserved.add(id));
  }
  const free = rooms.flatMap(room => room.tables.filter(t => t.active && !busy.has(t.id) && !reserved.has(t.id)).map(t => ({ ...t, roomName: room.name })));
  // Dal tavolo dove il gruppo sta meglio (floor/seats.js): nell'intervallo di posti e senza spreco; sotto il minimo ci si siede
  // comunque, ma dopo. `under` dice che il tavolo è più grande di ciò che il gruppo richiederebbe.
  const withFit = free.filter(t => t.seats >= party).map(t => {
    const fit = fitOf(party, effectiveMin(t), t.seats);
    return { ...t, under: fit.shortfall > 0, cost: fitCost(fit) };
  });
  const fits = withFit.sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name, 'it', { numeric: true }));
  const rest = free.filter(t => t.seats < party).sort((a, b) => b.seats - a.seats || a.name.localeCompare(b.name, 'it', { numeric: true }));
  return { fits, rest };
}

// Dove far scorrere la Timeline perché i punti importanti (l'ora di adesso, l'inizio della prenotazione aperta) restino in vista
// quando lo spazio si restringe (si apre il pannello a destra). `points` sono posizioni in pixel sul contenuto (colonna dei tavoli
// compresa), il primo ha la precedenza; `labelW` è la colonna fissa dei tavoli, che copre i primi pixel. Se i punti già si vedono
// non si muove nulla (ritorna `scrollLeft`).
export function scrollToShow(scrollLeft, viewW, labelW, points, margin = 28) {
  const visible = viewW - labelW;
  const fit = (list) => {
    const lo = Math.min(...list), hi = Math.max(...list);
    const min = hi + margin - viewW;               // non oltre: l'ultimo punto uscirebbe a destra
    const max = lo - labelW - margin;              // non prima: il primo punto finirebbe sotto i tavoli
    if (min > max) return null;
    if (scrollLeft >= min && scrollLeft <= max) return scrollLeft;
    const preferred = (lo + hi) / 2 - labelW - visible * (list.length > 1 ? 0.5 : 0.4);   // quando si scorre, il punto va verso il centro
    return Math.min(Math.max(preferred, min), max);
  };
  const next = points.length > 1 ? fit(points) ?? fit(points.slice(0, 1)) : fit(points);
  return Math.max(0, Math.round(next ?? scrollLeft));
}
