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
      'Porzioni dei piatti (con la funzione Magazzino, attivabile su richiesta): ogni piatto riparte da un numero a ogni servizio, continua dal servizio prima oppure resta illimitato.',
      'Magazzino (su richiesta): ingredienti, preparazioni e ricette dei piatti; ogni vendita scala la dispensa e la cucina può segnare esaurito un piatto o un ingrediente.',
      'Fornitori e carichi di merce: registri la bolla (anche con foto o scansione), la dispensa sale e il costo medio di ogni ingrediente si aggiorna da solo.',
      'Controlli di magazzino: conti ciò che hai davvero in dispensa e la differenza resta scritta; scarti e rettifiche con il motivo; nei locali senza ricette, lo scarico di fine servizio.',
      'Report del magazzino: costo degli ingredienti, margine e food cost per piatto (con IVA per prodotto), scarti e valore della dispensa.',
      'Scorta minima e «Da riordinare»: gli ingredienti sotto soglia compaiono nella campanella e in un filtro dell\'elenco, con i giorni di scorta rimasti.',
      'Report del magazzino: spesa per fornitore e prezzi d\'acquisto cambiati rispetto al carico precedente.',
      'Dati riservati: costi, margini, prezzi dei fornitori e statistiche di incasso si possono bloccare (Impostazioni → Dati riservati) e si vedono per 10 minuti con la password di un amministratore.',
      'Cassa e sala scrivono «Esaurito» sui piatti con un ingrediente finito; amministratore e responsabile possono vendere comunque, dopo una conferma.',
      'Ingredienti: campo di ricerca. La ricerca ha lo stesso aspetto in tutta l\'app.',
      'Carico di merce: scelto il fornitore compaiono i suoi prodotti, con confezione e prezzo dell\'ultimo carico: basta scrivere le quantità arrivate. Con il carico un ingrediente segnato esaurito torna disponibile.',
      'Scarti e correzioni si fanno dalla scheda dell\'ingrediente, che mostra anche gli ultimi movimenti; costi, margini, scarti e acquisti stanno in Statistiche → Magazzino.',
      'Asporto: gli ordini accettati in anticipo arrivano in cucina da soli il giorno del ritiro, anche con il servizio aperto dal giorno prima; il nuovo ordine usa la stessa carta della Sala.',
      'Tablet in orizzontale: menu laterale centrato e a misura di dito.',
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
