// Quali novità mostrare dopo un aggiornamento. Logica pura, senza browser: la finestra è in components/shell/WhatsNew.jsx.

// Confronta due numeri di versione «1.2.3»: negativo se a < b, 0 se uguali, positivo se a > b.
export function compareVersions(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

// Le voci uscite dopo l'ultima versione che questo dispositivo ha mostrato, fino alla versione in uso.
// Senza una versione già vista (primo accesso su questo dispositivo) non c'è nulla da annunciare: non è un aggiornamento.
export function entriesToShow(changelog, lastSeen, current) {
  if (!lastSeen) return [];
  return changelog.filter(e => compareVersions(e.version, lastSeen) > 0 && compareVersions(e.version, current) <= 0);
}
