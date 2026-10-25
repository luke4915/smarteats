// Ultimi valori noti su questo dispositivo (utente, sessione aperta), usati solo
// quando il server non è raggiungibile. localStorage è separato per origine,
// quindi per sottodominio: ogni tenant ha i suoi valori.
const PREFIX = 'smarteats:';

// Versione del formato dei valori salvati. Va alzata quando cambia il significato di ciò che si conserva (per esempio
// i nomi dei ruoli o dei tipi di locale): i valori di una versione precedente vengono scartati, non interpretati.
// Altrimenti un dispositivo con un utente «vecchio» in cache, se il server non risponde, aprirebbe l'app sbagliata.
// v2: ruoli e tipi di locale in inglese (migrazione 048).
const VERSION = '2';
const VERSION_KEY = `${PREFIX}cache-version`;

function ensureVersion() {
  try {
    if (localStorage.getItem(VERSION_KEY) === VERSION) return;
    Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).forEach(k => localStorage.removeItem(k));
    localStorage.setItem(VERSION_KEY, VERSION);
  } catch { /* storage non disponibile */ }
}

export function remember(key, value) {
  try {
    ensureVersion();
    if (value == null) localStorage.removeItem(PREFIX + key);
    else localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch { /* storage non disponibile: si lavora solo online */ }
}

export function recall(key) {
  try {
    ensureVersion();
    return JSON.parse(localStorage.getItem(PREFIX + key));
  } catch {
    return null;
  }
}
