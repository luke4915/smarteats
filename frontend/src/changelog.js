// Le novità mostrate a chi gestisce il locale dopo un aggiornamento (admin e responsabile), dalla più recente.
// Si scrive per chi usa l'app, non per chi la sviluppa: poche righe, in italiano, solo ciò che cambia il lavoro.
// La prima voce deve avere lo stesso numero di `version` in frontend/package.json (lo controlla changelog.test.js).
export const CHANGELOG = [
  {
    version: '0.2.0',
    date: '2026-10-24',
    items: [
      'Ora l\'app si aggiorna da sola: quando esce una versione nuova la prende al primo momento sicuro, senza perdere ordini.',
      'I tavoli hanno un minimo e un massimo di posti: i gruppi piccoli non occupano più i tavoli grandi, ma possono sempre sedersi.',
      'Gli ordini da asporto per i giorni dopo compaiono in cucina solo il giorno del ritiro.',
      'Sala, Prenotazioni e Impostazioni ridisegnate, con movimenti più fluidi e migliori su iPhone e iPad.',
    ],
  },
];
