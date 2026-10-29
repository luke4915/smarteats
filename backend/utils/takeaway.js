// Regole pure dell'asporto (migrazione 050 e 057, docs/design-asporto.md): fasce di ritiro, minuti di lavoro e anticipo.
// Niente database: funzioni con test (tests/takeaway.test.js). Date `YYYY-MM-DD`, ore `HH:MM`, nel fuso del locale.
import { minutesOf, weekdayOf } from './bookings.js';
import { addDays, daysBetween } from './bookingPortal.js';

export const MAX_DAYS_AHEAD = 7;           // dal portale si ordina fino a una settimana prima
export const MAX_ITEMS_PER_ORDER = 40;     // pezzi in un ordine dal portale (oltre: telefonare)
export const MAX_PENDING_PER_PHONE = 3;    // richieste in attesa dello stesso telefono
// `capacity` = minuti di lavoro disponibili in una fascia; `prepMinutes` = quanto vale un prodotto senza tempo indicato
export const DEFAULTS = { slotMinutes: 15, capacity: 60, minLeadMinutes: 30, prepMinutes: 5 };
export const STALE_PICKUP_MINUTES = 120;   // oltre queste ore di ritardo un asporto accettato non va più in cucina da solo

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

// Il ritiro è per oggi (o già passato)? Allora l'ordine di cucina nasce subito. Se è per un altro giorno l'ordine resta
// «accettato» e nasce all'apertura della serata di quel giorno: così non compare in cucina con un giorno d'anticipo e
// finisce nella serata giusta (incassi, stock). Un ritiro già passato non deve restare bloccato, perciò conta come «oggi».
// `pickupDate` è `YYYY-MM-DD` nel fuso del locale; `now` è localNow().
export function pickupIsDue(pickupDate, now) {
  return daysBetween(now.date, pickupDate) <= 0;
}

// Il ritiro è passato da troppo tempo (per esempio un pranzo accettato e mai gestito, che la sera apre il servizio)? Allora
// non si cucina: sarebbe un ordine fantasma. Resta «accettato» nell'elenco dell'asporto, dove il locale lo consegna o lo annulla.
// `pickupTime` è `HH:MM` nel fuso del locale; `now` è localNow().
export function pickupIsStale(pickupDate, pickupTime, now, graceMinutes = STALE_PICKUP_MINUTES) {
  const minutesLate = now.minutes - minutesOf(pickupTime) - daysBetween(now.date, pickupDate) * 1440;
  return minutesLate > graceMinutes;
}

// Minuti di lavoro di un insieme di righe: somma di quantità × minuti di preparazione del prodotto. `prepOf(productId)` → minuti
// (0 per le bevande e le cose già pronte; un prodotto sconosciuto vale `DEFAULTS.prepMinutes`).
export const orderWorkMinutes = (items, prepOf) => items.reduce((sum, i) => sum + Number(i.quantity) * (prepOf(i.id) ?? DEFAULTS.prepMinutes), 0);

// Stato di ogni fascia di un giorno. `usedByTime` = Map «HH:MM» → minuti di lavoro già presi (ordini vivi); `capacity` = minuti per fascia.
// `available` dice se un nuovo ordine di `minutes` minuti ci sta ancora (e la fascia è nella finestra);
// `status`: 'open' (c'è posto), 'full' (capienza al limite), 'closed' (già passata o troppo vicina).
export function slotStates({ date, hours, slotMinutes, capacity, usedByTime, now, minLeadMinutes, minutes = DEFAULTS.prepMinutes }) {
  return slotsOn(date, hours, slotMinutes).map(time => {
    const used = usedByTime.get(time) ?? 0;
    const within = slotWithinWindow(date, time, now, minLeadMinutes).ok;
    const fits = used + minutes <= capacity;
    return { time, used, capacity, available: within && fits, status: !within ? 'closed' : fits ? 'open' : 'full' };
  });
}

// Codice di ritiro: tre cifre (100-999) che il cliente dice al banco. Non deve ripetersi tra gli ordini vivi dello stesso giorno
// (`taken` = i codici già dati). Si pesca a caso e, se la sorte insiste, si cerca il primo libero; `null` solo se sono finiti tutti.
export function newPickupCode(taken, random = Math.random) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const code = String(100 + Math.floor(random() * 900));
    if (!taken.has(code)) return code;
  }
  for (let n = 100; n <= 999; n += 1) if (!taken.has(String(n))) return String(n);
  return null;
}

// Un orario `HH:MM` del giorno `date` è una fascia valida di quel giorno?
export const isSlot = (date, time, hours, slotMinutes) => slotsOn(date, hours, slotMinutes).includes(time);

export { addDays };
