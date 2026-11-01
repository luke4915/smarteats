// Le parole del lavoro cambiano col tipo di locale: una sagra ha le «serate», un ristorante i «servizi» (pranzo, cena).
// La sessione è la stessa cosa lato server; qui cambia solo come si chiama sullo schermo.
const TERMS = {
  evening: {
    unit: 'serata', total: 'Totale serata', filter: 'Filtra per sessione',
    column: 'Sessione', none: 'Nessuna sessione conclusa disponibile.',
    all: 'Tutte le sessioni', endTitle: 'Chiudere la serata?',
    open: 'Apri serata', startTitle: 'Apri la serata', startAction: 'Apri la serata', startHint: 'Senza una serata aperta non si battono ordini',
    opened: (name) => `Serata "${name}" aperta`, closed: 'Serata chiusa.',
  },
  service: {
    unit: 'servizio', total: 'Totale servizio', filter: 'Filtra per servizio',
    column: 'Servizio', none: 'Nessun servizio concluso disponibile.',
    all: 'Tutti i servizi', endTitle: 'Chiudere il servizio?',
    open: 'Apri servizio', startTitle: 'Apri il servizio', startAction: 'Apri il servizio', startHint: 'Senza un servizio aperto non si aprono i tavoli',
    opened: (name) => `Servizio "${name}" aperto`, closed: 'Servizio chiuso.',
  },
};

export const termsFor = (businessType) => (['restaurant', 'takeaway_shop'].includes(businessType) ? TERMS.service : TERMS.evening);
export const TERM_SETS = TERMS;
