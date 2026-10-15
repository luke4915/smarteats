// Regole pure del portale pubblico di prenotazione (docs/design-prenotazione-pubblica.md). Niente database.
// Le soglie sono decise con il titolare e non sono impostazioni: cambiarle è una modifica di codice, con test.

export const MAX_PARTY = 10;              // oltre: «telefona»
export const MIN_NOTICE_HOURS = 1;        // anticipo minimo
export const MAX_DAYS_AHEAD = 30;         // anticipo massimo
export const MAX_PENDING_PER_PHONE = 2;   // richieste in attesa con lo stesso numero
export const RETENTION_DAYS = 90;         // dopo, i dati personali si svuotano
export const MIN_FILL_MS = 3000;          // un modulo compilato in meno di così non l'ha scritto una persona
export const PORTAL_TZ = 'Europe/Rome';

const pad = (n) => String(n).padStart(2, '0');

// Data (YYYY-MM-DD) e minuti dalla mezzanotte «adesso» nel fuso del locale.
export function localNow(now = Date.now(), tz = PORTAL_TZ) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(now)).map(p => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

// Giorni tra due date YYYY-MM-DD (b - a).
export function daysBetween(a, b) {
  const [ya, ma, da] = a.split('-').map(Number), [yb, mb, db] = b.split('-').map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000);
}

export function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

// Il turno di quel giorno si può ancora richiedere dal portale? `now` è localNow().
export function withinWindow(date, startTime, now) {
  const [h, m] = String(startTime).split(':').map(Number);
  const ahead = daysBetween(now.date, date);
  if (ahead > MAX_DAYS_AHEAD) return { ok: false, code: 'TOO_FAR', reason: `Si prenota fino a ${MAX_DAYS_AHEAD} giorni prima` };
  const minutesFromNow = ahead * 1440 + (h * 60 + (m || 0)) - now.minutes;
  if (minutesFromNow < MIN_NOTICE_HOURS * 60)
    return { ok: false, code: 'TOO_SOON', reason: MIN_NOTICE_HOURS === 1 ? 'Serve almeno un\'ora di anticipo: chiamaci' : `Servono almeno ${MIN_NOTICE_HOURS} ore di anticipo: chiamaci` };
  return { ok: true };
}

// Le ultime 10 cifre: «333 123-4567», «+39 333 1234567» e «3331234567» sono lo stesso numero.
export const phoneDigits = (phone) => String(phone ?? '').replace(/\D/g, '').slice(-10);

// Prima di questa data (esclusa) i dati personali di una prenotazione si svuotano.
export const retentionCutoff = (today, days = RETENTION_DAYS) => addDays(today, -days);

// ─── Annullo da parte del cliente ───────────────────────────────────────────────────────────────────────────────
// Una richiesta non ancora confermata il cliente la ritira da solo. Una prenotazione confermata no: chiede
// l'annullo e il locale lo conferma, e solo fino a un'ora prima dell'inizio del turno; dopo, deve telefonare.
export const MIN_CANCEL_NOTICE_HOURS = 1;

// Minuti dall'adesso all'inizio del turno (negativo se è già iniziato). `now` è localNow().
export function minutesUntilStart(date, startTime, now) {
  const [h, m] = String(startTime).split(':').map(Number);
  return daysBetween(now.date, date) * 1440 + (h * 60 + (m || 0)) - now.minutes;
}

// Cosa può fare il cliente con la sua richiesta: 'withdraw' (ritira, è ancora una richiesta), 'request' (chiede
// l'annullo di una prenotazione confermata), 'requested' (l'ha già chiesto), 'call' (troppo tardi: telefona), null.
export function cancelOption({ status, cancel_requested }, date, startTime, now) {
  if (status === 'requested') return 'withdraw';
  if (status !== 'confirmed') return null;
  if (cancel_requested) return 'requested';
  return minutesUntilStart(date, startTime, now) >= MIN_CANCEL_NOTICE_HOURS * 60 ? 'request' : 'call';
}
