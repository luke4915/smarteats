// La licenza vista dalla cassa senza rete. Il server dice a ogni accesso e rinnovo quando scade la licenza e fino a quando si può lavorare
// offline (10 ore dopo la scadenza, backend/utils/license.js); qui si decide se la cassa deve bloccarsi. Il blocco non si aggira
// riportando indietro l'orologio: si tiene l'istante più avanzato mai visto (dal server e dal dispositivo) e si conta da lì.
// Il vero controllo resta sul server: un ordine battuto oltre le ore consentite viene rifiutato quando la cassa torna in rete.
// Logica pura (provata in licenseLock.test.js); il salvataggio in `lastKnown` sta in `hooks/useLicenseLock.js`.

// Il più avanzato tra l'ora del dispositivo, l'ultima già vista e (se c'è) quella del server.
export function latestSeen({ now, lastSeen = 0, serverTime = null }) {
  return Math.max(now, lastSeen ?? 0, serverTime ? Date.parse(serverTime) || 0 : 0);
}

// La cassa deve bloccarsi? Solo se la licenza ha una scadenza e le ore di tolleranza sono finite.
export function isLocked(license, seen) {
  if (!license?.offlineUntil) return false;
  const until = Date.parse(license.offlineUntil);
  return Number.isFinite(until) && seen > until;
}

// Quanto manca allo stop, in minuti (per avvisare chi lavora senza rete); `null` se non c'è scadenza.
export function minutesLeft(license, seen) {
  if (!license?.offlineUntil) return null;
  return Math.max(0, Math.ceil((Date.parse(license.offlineUntil) - seen) / 60000));
}

// L'orologio del dispositivo è indietro rispetto a ciò che si è già visto? (per segnalarlo, non per bloccare)
export const clockWentBack = (now, lastSeen) => !!lastSeen && now < lastSeen - 5 * 60000;
