// Dati riservati: costi, margini, prezzi dei fornitori e statistiche di incasso si possono tenere «bloccati». Il blocco vale sul
// SERVER: finché la sessione non è sbloccata i valori non partono proprio (non basta nasconderli a schermo, il browser li vedrebbe
// negli strumenti per sviluppatori). Lo sblocco dura pochi minuti, è della sola sessione di chi lo chiede e lo dà la password di
// un amministratore (routes/reservedData.js). Disegno in docs/design-magazzino.md, sezione 7.

export const UNLOCK_SECONDS = 10 * 60;
const SETTING_KEY = 'reserved_data_lock';

// I campi delle risposte che portano costi o prezzi d'acquisto: da bloccati valgono sempre `null`, in qualunque punto della risposta.
// Un campo nuovo con un costo va aggiunto qui, altrimenti uscirebbe anche a dati bloccati.
const RESERVED_KEYS = new Set([
  'weighted_average_cost',   // costo medio di un ingrediente
  'unit_cost', 'unit_cost_cents',        // costo nel registro dei movimenti, prezzo di confezione nel listino e nei carichi
  'line_cost_cents', 'total_cost_cents', 'totalCostCents',   // righe e totale di un carico di merce
  'difference_value_cents',  // valore delle differenze di un controllo di magazzino
  'cost_cents_per_portion',  // costo di una porzione (ricette)
]);

// Lo stato del blocco per una richiesta: `enabled` = il locale lo ha acceso, `unlocked` = questa sessione è sbloccata ora,
// `locked` = i dati riservati non si devono mandare. `reservedUntil` e `nowS` sono in secondi (come exp e iat dei token).
export function reservedState({ lockEnabled, reservedUntil }, nowS = Math.floor(Date.now() / 1000)) {
  const unlocked = Number.isFinite(reservedUntil) && reservedUntil > nowS;
  return { enabled: !!lockEnabled, unlocked, locked: !!lockEnabled && !unlocked, unlockedUntil: unlocked ? new Date(reservedUntil * 1000).toISOString() : null };
}

const isPlainObject = (value) => value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;

// Copia della risposta con i campi riservati a `null` (anche dentro elenchi e oggetti annidati).
export function maskReservedKeys(value) {
  if (Array.isArray(value)) return value.map(maskReservedKeys);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, RESERVED_KEYS.has(key) ? null : maskReservedKeys(inner)]));
}

// Legge dal database se il locale ha acceso il blocco e lo combina con lo sblocco della sessione.
export async function loadReservedState(db, user) {
  const { rows } = await db.query('SELECT value FROM settings WHERE key = $1', [SETTING_KEY]);
  return reservedState({ lockEnabled: rows[0]?.value === '1', reservedUntil: user.reservedUntil });
}

// Per le risposte fatte solo di dati riservati (report, statistiche, esportazioni): da bloccati si rifiutano con 403.
// Va messo dopo `tenantScope`.
export async function requireUnlocked(req, res, next) {
  try {
    if ((await loadReservedState(req.db, req.user)).locked)
      return res.status(403).json({ error: 'Dati riservati: sbloccali con la password di un amministratore', code: 'RESERVED_LOCKED' });
    next();
  } catch (err) { next(err); }
}

// Per le risposte miste (ingredienti, fornitori, carichi…): da bloccati i campi dei costi diventano `null`, il resto passa.
// Va messo dopo `tenantScope`.
export async function maskReserved(req, res, next) {
  try {
    if (!(await loadReservedState(req.db, req.user)).locked) return next();
    const send = res.json.bind(res);
    res.json = (body) => send(maskReservedKeys(body));
    next();
  } catch (err) { next(err); }
}
