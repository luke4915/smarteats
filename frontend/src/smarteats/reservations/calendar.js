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
