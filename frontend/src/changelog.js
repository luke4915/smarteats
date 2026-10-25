// Le novità mostrate a chi gestisce il locale dopo un aggiornamento (admin e responsabile), dalla più recente.
// Si scrive per chi usa l'app, non per chi la sviluppa: poche righe, in italiano, solo ciò che cambia il lavoro.
// La prima voce deve avere lo stesso numero di `version` in frontend/package.json (lo controlla changelog.test.js).
export const CHANGELOG = [
  {
    version: '0.3.0',
    date: '2026-10-25',
    items: [
      'Nuovo nome: l\'app è SmartEats, con due versioni: SmartEats Stand per sagre e food truck, SmartEats Restaurant per ristoranti, pizzerie e solo asporto.',
      'Marchio aggiornato sulla schermata di accesso, sugli scontrini e nei report PDF.',
      'Impostazioni riorganizzate: sezioni in alto, Account (profilo e utenti) e Suggerimenti in schede separate, riservati ad amministratore e responsabile.',
      'Password dimenticata: cassa, cameriere e cucina non la cambiano da soli, la reimposta l\'amministratore con una password temporanea.',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-10-24',
    items: [
      'Ora l\'app si aggiorna da sola: quando esce una versione nuova la prende al primo momento sicuro, senza perdere ordini.',
      'I tavoli hanno un minimo e un massimo di posti: i gruppi piccoli non occupano più i tavoli grandi.',
      'Gli ordini da asporto per i giorni dopo compaiono in cucina solo il giorno del ritiro.',
      'Sala, Prenotazioni e Impostazioni ridisegnate, con movimenti più fluidi e migliori su iPhone e iPad.',
      'Bug fix generali su funzionalità e UI/UX.'
    ],
  },
];
