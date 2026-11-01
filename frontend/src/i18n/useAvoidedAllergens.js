import { useSyncExternalStore } from 'react';
import { parseAvoid, toggleAvoid } from '../utils/allergens';

// Gli allergeni che il cliente vuole evitare, ricordati su questo telefono: li vede segnalati in ogni menu del locale (e di altri locali) senza
// doverli rimettere. Stessa idea di `useLanguage`: un piccolo archivio condiviso. Nessun dato lascia il telefono.
const KEY = 'avoid-allergens';
const listeners = new Set();
let current = null;

function get() {
  if (current === null) { try { current = parseAvoid(localStorage.getItem(KEY)); } catch { current = []; } }
  return current;
}
function set(next) {
  current = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* senza archivio locale vale solo per questa visita */ }
  listeners.forEach(fn => fn());
}
const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

// [da evitare, aggiungi/togli un allergene, azzera]
export const useAvoidedAllergens = () => [useSyncExternalStore(subscribe, get), (id) => set(toggleAvoid(get(), id)), () => set([])];
