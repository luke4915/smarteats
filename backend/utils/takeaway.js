// Regole pure dell'asporto (migrazione 050, docs/design-asporto.md): fasce di ritiro, carico sul forno e anticipo.
// Niente database: funzioni con test (tests/takeaway.test.js). Date `YYYY-MM-DD`, ore `HH:MM`, nel fuso del locale.
import { minutesOf, weekdayOf } from './bookings.js';
import { addDays, daysBetween } from './bookingPortal.js';

export const MAX_DAYS_AHEAD = 7;           // dal portale si ordina fino a una settimana prima
export const MAX_ITEMS_PER_ORDER = 40;     // pezzi in un ordine dal portale (oltre: telefonare)
export const MAX_PENDING_PER_PHONE = 3;    // richieste in attesa dello stesso telefono
export const DEFAULTS = { slotMinutes: 15, capacity: 12, minLeadMinutes: 30 };

const pad = (n) => String(n).padStart(2, '0');
export const clock = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

// Le fasce di un giorno: dall'apertura (compresa) alla chiusura (esclusa), una ogni `slotMinutes`, per ogni finestra
// d'orario di quel giorno della settimana. `hours` = [{ weekday, open_time, close_time }] (HH:MM o HH:MM:SS).
export function slotsOn(date, hours, slotMinutes = DEFAULTS.slotMinutes) {
  const weekday = weekdayOf(date);
  const times = new Set();
  for (const h of hours.filter(h => Number(h.weekday) === weekday)) {
    for (let m = minutesOf(h.open_time); m < minutesOf(h.close_time); m += slotMinutes) times.add(m);
  }
  return [...times].sort((a, b) => a - b).map(clock);
}

// Una fascia si può ancora scegliere: abbastanza in anticipo e non oltre MAX_DAYS_AHEAD. `now` è localNow().
export function slotWithinWindow(date, time, now, minLeadMinutes = DEFAULTS.minLeadMinutes) {
  const ahead = daysBetween(now.date, date);
  if (ahead < 0) return { ok: false, code: 'PAST', reason: 'Questa data è già passata' };
  if (ahead > MAX_DAYS_AHEAD) return { ok: false, code: 'TOO_FAR', reason: `Si ordina fino a ${MAX_DAYS_AHEAD} giorni prima` };
  const minutesFromNow = ahead * 1440 + minutesOf(time) - now.minutes;
  if (minutesFromNow < minLeadMinutes) return { ok: false, code: 'TOO_SOON', reason: 'Serve un po\' più di tempo: scegli un orario più avanti o telefona' };
  return { ok: true };
}

// Carico di un insieme di righe: somma di quantità × `takeaway_load` del prodotto. `loadOf(productId)` → intero.
export const orderLoad = (items, loadOf) => items.reduce((sum, i) => sum + Number(i.quantity) * (loadOf(i.id) ?? 1), 0);

// Stato di ogni fascia di un giorno. `loadByTime` = Map «HH:MM» → carico già preso (ordini vivi); `capacity` per fascia.
// `available` dice se un nuovo ordine di `load` unità ci sta ancora (e la fascia è nella finestra);
// `status`: 'open' (c'è posto), 'full' (carico al limite), 'closed' (già passata o troppo vicina).
export function slotStates({ date, hours, slotMinutes, capacity, loadByTime, now, minLeadMinutes, load = 1 }) {
  return slotsOn(date, hours, slotMinutes).map(time => {
    const taken = loadByTime.get(time) ?? 0;
    const within = slotWithinWindow(date, time, now, minLeadMinutes).ok;
    const fits = taken + load <= capacity;
    return { time, load: taken, capacity, available: within && fits, status: !within ? 'closed' : fits ? 'open' : 'full' };
  });
}

// Un orario `HH:MM` del giorno `date` è una fascia valida di quel giorno?
export const isSlot = (date, time, hours, slotMinutes) => slotsOn(date, hours, slotMinutes).includes(time);

export { addDays };
