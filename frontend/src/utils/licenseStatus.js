// Lo stato della licenza come lo racconta l'interfaccia (Impostazioni → Informazioni e avviso in testata). Logica pura, provata in licenseStatus.test.js.
// `license` è quella che dà il server (backend/utils/license.js): scadenza e fino a quando si può lavorare senza rete. `now` in millisecondi.
const DAY = 86_400_000;
export const SOON_DAYS = 14;   // da quanti giorni prima della scadenza si avvisa

// kind: 'none' (senza scadenza) | 'ok' | 'soon' (scade a breve) | 'grace' (scaduta, ma senza rete si lavora ancora) | 'expired'
export function licenseStatus(license, now = Date.now()) {
  if (!license?.expiresAt) return { kind: 'none' };
  const expires = Date.parse(license.expiresAt);
  const until = Date.parse(license.offlineUntil);
  if (now < expires) {
    const days = Math.ceil((expires - now) / DAY);
    return { kind: days <= SOON_DAYS ? 'soon' : 'ok', days, expiresAt: license.expiresAt };
  }
  const minutesLeft = Number.isFinite(until) ? Math.max(0, Math.ceil((until - now) / 60000)) : 0;
  return { kind: minutesLeft > 0 ? 'grace' : 'expired', minutesLeft, expiresAt: license.expiresAt };
}

// «3 ore e 20 minuti», «45 minuti»
export function formatLeft(minutes) {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  if (!h) return `${m} ${m === 1 ? 'minuto' : 'minuti'}`;
  return m ? `${h} ${h === 1 ? 'ora' : 'ore'} e ${m} ${m === 1 ? 'minuto' : 'minuti'}` : `${h} ${h === 1 ? 'ora' : 'ore'}`;
}

// Il testo per chi legge: titolo e dettaglio. `null` se non c'è nulla da dire.
export function licenseMessage(status) {
  switch (status.kind) {
    case 'none': return { title: 'Licenza senza scadenza', tone: 'ok' };
    case 'ok': return { title: 'Licenza attiva', detail: `Scade tra ${status.days} giorni.`, tone: 'ok' };
    case 'soon': return { title: 'Licenza in scadenza', detail: status.days <= 1 ? 'Scade domani o prima.' : `Scade tra ${status.days} giorni.`, tone: 'warn' };
    case 'grace': return { title: 'Licenza scaduta', detail: `Senza rete puoi lavorare ancora ${formatLeft(status.minutesLeft)}; poi serve internet per rinnovare.`, tone: 'warn' };
    default: return { title: 'Licenza scaduta', detail: 'Per continuare serve collegarsi a internet e rinnovare la licenza.', tone: 'bad' };
  }
}
