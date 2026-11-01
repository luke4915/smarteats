import { useSyncExternalStore, useCallback, useContext, createContext } from 'react';
import { pickLanguage, translate, isLanguage } from './languages.js';
import { MESSAGES } from './messages.js';

// La lingua dell'interfaccia di questo dispositivo: si ricorda (come l'aspetto) e di partenza segue il telefono. Un piccolo archivio condiviso, così
// tutti i componenti si aggiornano insieme quando la si cambia, senza passare da un contesto.
const listeners = new Set();
let current;

function load() {
  let stored = null;
  try { stored = localStorage.getItem('lang'); } catch { /* senza archivio locale vale solo per questa visita */ }
  return pickLanguage(stored, navigator.languages ?? [navigator.language]);
}

function get() {
  if (!current) { current = load(); document.documentElement.lang = current; }
  return current;
}

export function setLanguage(id) {
  if (!isLanguage(id) || id === current) return;
  current = id;
  document.documentElement.lang = id;
  try { localStorage.setItem('lang', id); } catch { /* vedi sopra */ }
  listeners.forEach(fn => fn());
}

const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

// [lingua, cambia]
export const useLanguage = () => [useSyncExternalStore(subscribe, get), setLanguage];

// Il nome di un testo nella lingua `lang` senza passare dall'archivio (per l'interfaccia del personale, che resta in italiano)
export const textIn = (lang, key, params) => translate(MESSAGES, lang, key, params);

// Le pagine non ancora tradotte (prenotazioni, ordine da asporto…) fissano l'italiano per tutto ciò che contengono: un pezzo tradotto in una
// pagina italiana sarebbe peggio di niente. `PublicShell` lo imposta con la sua proprietà `translated`.
export const ForcedLanguage = createContext(null);

// La lingua in uso adesso in questa parte della pagina (quella scelta, o l'italiano dove la pagina non è tradotta)
export function useEffectiveLanguage() {
  const chosen = useSyncExternalStore(subscribe, get);
  return useContext(ForcedLanguage) ?? chosen;
}

// La funzione che traduce nella lingua di adesso: `const t = useT(); t('menu.search')`, `t('menu.items', { count: 3 })`.
export function useT() {
  const chosen = useSyncExternalStore(subscribe, get);
  const lang = useContext(ForcedLanguage) ?? chosen;
  return useCallback((key, params) => translate(MESSAGES, lang, key, params), [lang]);
}
