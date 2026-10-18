import { addDays } from './rules.js';

// Logica pura del calendario del mese. Le settimane iniziano di lunedì; le date sono `AAAA-MM-GG` senza fuso.
const pad = (n) => String(n).padStart(2, '0');
export const monthOf = (date) => date.slice(0, 7);                                   // 'AAAA-MM'
export const addMonths = (month, n) => { const [y, m] = month.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1 + n, 1)); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}`; };
export const formatMonth = (month) => { const [y, m] = month.split('-').map(Number); return new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1))); };

// Le settimane (da 4 a 6) che coprono il mese, ognuna con 7 giorni; i giorni fuori dal mese hanno `inMonth: false`.
export function monthGrid(month) {
  const first = `${month}-01`;
  const weekday = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;             // 0 = lunedì
  const start = addDays(first, -weekday);
  const weeks = [];
  for (let day = start; ; day = addDays(day, 7)) {
    const week = Array.from({ length: 7 }, (_, i) => { const date = addDays(day, i); return { date, inMonth: monthOf(date) === month, day: Number(date.slice(8)) }; });
    if (!week.some(d => d.inMonth)) break;
    weeks.push(week);
  }
  return weeks;
}

// Il riepilogo del server (una riga per giorno e turno) in una mappa `data → { shiftId → riga }`.
export function summaryByDay(rows) {
  const map = new Map();
  for (const r of rows) map.set(r.date, { ...(map.get(r.date) ?? {}), [r.shift_id]: r });
  return map;
}

// Quanto è carico un giorno: coperti prenotati su capienza dei turni che quel giorno sono aperti. `shifts` = turni del
// locale ({ id, capacity, weekdays, active }); `rows` = il riepilogo del giorno per turno ({ [shiftId]: { covers, reservations, requested } }).
export function dayLoad(date, shifts, rows = {}) {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const open = shifts.filter(s => s.active && s.weekdays.includes(weekday));
  const perShift = open.map(s => ({ shift: s, covers: rows[s.id]?.covers ?? 0, reservations: rows[s.id]?.reservations ?? 0, requested: rows[s.id]?.requested ?? 0, pct: Math.round(((rows[s.id]?.covers ?? 0) / s.capacity) * 100) }));
  const covers = perShift.reduce((n, p) => n + p.covers, 0);
  const capacity = open.reduce((n, s) => n + s.capacity, 0);
  return { perShift, covers, capacity, pct: capacity ? Math.round((covers / capacity) * 100) : null, requested: perShift.reduce((n, p) => n + p.requested, 0) };
}

// Il giorno più carico e il più libero fra quelli che hanno già prenotazioni (a parità, il primo): un giorno vuoto non è
// «il più libero», è solo ancora da riempire. Il più libero c'è solo se è diverso dal più carico. Serve al riepilogo del mese.
export function busiestAndQuietest(days) {
  const booked = days.filter(d => d.load.pct > 0);
  if (booked.length === 0) return { busiest: null, quietest: null };
  const busiest = booked.reduce((best, d) => (d.load.pct > best.load.pct ? d : best));
  const quietest = booked.reduce((best, d) => (d.load.pct < best.load.pct ? d : best));
  return { busiest, quietest: quietest.load.pct < busiest.load.pct ? quietest : null };
}

// Quanto colorare un giorno (0–0.6): più è pieno più è intenso. Sopra il 100% resta al massimo.
export const heat = (pct) => (pct === null ? 0 : Math.min(pct, 100) * 0.006);
