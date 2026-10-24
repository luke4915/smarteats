// Quando una versione nuova già scaricata può sostituire quella aperta. Logica pura: l'hook è hooks/useAppUpdate.js.
// Ricaricare butta via ciò che sta sullo schermo (una comanda a metà), quindi lo si fa solo in momenti sicuri.
export const AWAY_MS = 5 * 60_000;        // tornata in primo piano dopo almeno 5 minuti: nessuno stava scrivendo
export const IDLE_MS = 5 * 60_000;        // oppure schermo fermo da 5 minuti…
export const MAX_WAIT_MS = 6 * 3_600_000; // …ma solo se la versione nuova aspetta da almeno 6 ore

// `pending`: ordini in coda offline e lavori di stampa non ancora partiti: con quelli in mezzo non si ricarica mai.
export function shouldApplyUpdate({ waiting, pending, awayMs = 0, idleMs = 0, waitingMs = 0 }) {
  if (!waiting || pending > 0) return false;
  if (awayMs >= AWAY_MS) return true;
  return waitingMs >= MAX_WAIT_MS && idleMs >= IDLE_MS;
}
