// Testi dei dati riservati, senza grafica (provati in reservedLabels.test.js).

// «fino alle 22:10» dall'istante in cui lo sblocco finisce.
export function unlockedUntilLabel(unlockedUntil) {
  if (!unlockedUntil) return '';
  return `fino alle ${new Date(unlockedUntil).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
}
