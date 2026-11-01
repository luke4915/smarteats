# Fiscale italiano: registratore telematico e corrispettivi (studio)

Stato: **solo ricerca, nessun codice**. La pagina separa ciò che è stato letto nella **fonte ufficiale** da ciò che viene da fonti secondarie o resta da verificare. Non si implementa nulla finché i punti aperti (§5) non sono chiusi con un consulente fiscale e con il fornitore del registratore.

## 1. Fonte letta per intero nelle parti citate

«Specifiche tecniche per la memorizzazione elettronica e la trasmissione telematica dei dati dei corrispettivi giornalieri di cui all'art. 2, comma 1, del D.Lgs. 5 agosto 2015, n. 127», **versione 11.2** (62 pagine), Agenzia delle Entrate. Elenco dei documenti e degli allegati:
<https://www.agenziaentrate.gov.it/portale/schede/comunicazioni/fatture-e-corrispettivi/fatture-e-corrispettivi-st/st-invio-corrispettivi-registratori-telematici-temp>
(le citazioni sotto rimandano ai paragrafi del PDF). Sono stati letti i paragrafi 1, 2.7, 2.7.1, 2.8.1, 2.9 e 3, le definizioni e la parte sulle operazioni con pagamento elettronico; **il resto del documento e gli allegati (API REST, layout del documento commerciale) non sono ancora stati letti.**

### Cosa dice (verificato)

- **Obbligo** (§1): dal 1° gennaio 2020 chi effettua operazioni ex art. 22 DPR 633/1972 memorizza elettronicamente e trasmette telematicamente i corrispettivi giornalieri (art. 2, comma 1, D.Lgs. 127/2015); dal 1° luglio 2019 per chi aveva un volume d'affari superiore a 400.000 €. Gli strumenti devono garantire autenticità e inalterabilità dei dati, **compresi quelli dei pagamenti con carta di debito e di credito** (comma 3). I termini di trasmissione sono definiti nel **Provvedimento del Direttore dell'Agenzia delle Entrate del 28 ottobre 2016** (citato al §2.8.1; il suo testo non è stato letto).
- **Chi sigilla e trasmette** (definizioni, §2.7): il Registratore Telematico (RT) o il **Server RT** firma i file con il «certificato dispositivo» rilasciato dall'Agenzia e li invia al sistema dell'Agenzia con servizi REST. Una **trasmissione non riuscita** va ritentata nella giornata ogni 15/30 minuti fino alla presa in carico; nessuna trasmissione tra le 03:00 e le 05:00.
- **Chiusura giornaliera** (§2.7.1): a fine giornata il dispositivo emette il documento gestionale di chiusura e genera il file XML dei corrispettivi, con totali per aliquota/natura IVA, contanti, elettronico, non riscosso ecc.
- **I «12 giorni»** (§2.7): *non* sono un termine di trasmissione. Riguardano un'**interruzione dell'attività** (ferie, chiusura stagionale, attività stagionale): al ritorno il dispositivo invia un file unico a importo zero; se l'interruzione supera i 12 giorni (o non si sa quanto durerà) si può comunicare un evento «fuori servizio» (codice 608). **Questo è rilevante per le sagre.** (Una frase della prima versione di questa pagina, ripresa da un sommario di ricerca, collegava i 12 giorni alla trasmissione: era imprecisa.)
- **Assenza di rete** (§2.8.1): con problemi di rete si può estrarre il file XML sigillato dal dispositivo e caricarlo dal portale «Fatture e Corrispettivi» (Procedure di emergenza › Assenza di rete).
- **Pagamento elettronico** (pagina 19): nella memoria di dettaglio vanno registrati data/ora della transazione, modalità («on-line» se il sistema di pagamento è collegato direttamente a RT/Server RT; «off-line» negli altri casi, per esempio POS non integrato o collegamento tramite software applicativo), importo e codice autorizzativo (STAN; in modalità off-line può essere sostituito dall'indicazione del canale).
- **Reso e annullo**: si emettono cercando il documento commerciale originario nella memoria di dettaglio del dispositivo che lo ha emesso (§ «Documento commerciale di reso o annullo»).
- **«Documento commerciale online»** (§2.9): procedura dell'Agenzia nel portale «Fatture e Corrispettivi» (area Corrispettivi), **solo per l'operatore** (non delegabile a intermediari), in quattro fasi (I miei dati, Dati documento con codice lotteria, Verifica, Conferma e stampa); gestisce anche reso e annullo. È una compilazione manuale, non un'interfaccia per software esterni.
- **Più punti cassa** (§3): chi ha **almeno tre punti cassa per singolo punto vendita** può usare un unico «punto di raccolta» (**Server RT**), che è il primo punto in cui si raccolgono i corrispettivi e quello che sigilla e invia. Il «punto cassa» è un sistema con hardware e software di gestione vendite in grado di trasmettere i dati dei documenti al Server RT; **può avere una stampante non fiscale** per consegnare il documento commerciale cartaceo. Un server gestionale già esistente può essere reso conforme (diventando Server RT) oppure collegato a un RT con un protocollo interno che garantisca inalterabilità e riservatezza.
- **RTD e «punto di immissione»** (§2.1, definizioni): esiste una categoria di registratori (RTD) senza tastiera né display propri che espongono **API su canale sicuro con mutua autenticazione** a «punti di immissione» (sistemi di vendita come SmartEats). Il punto di immissione **non ha funzionamento autonomo: se perde il collegamento con l'RTD si blocca.** I documenti sono prodotti in formato digitale PAdES firmato.

### Conseguenza per SmartEats

Il principio «la stampa è del client e funziona senza internet» (`docs/stampa.md`) **non è compatibile così com'è** con la via «punto di immissione su RTD»: lì, senza il registratore, la cassa si ferma. Con un registratore fisico a bordo dell'incasso (Via A) il registratore funziona anche senza internet (memorizza e ritenta la trasmissione), ma la cassa deve poter parlare con lui in rete locale.

## 2. Da fonti secondarie, **da verificare**

- **Collegamento POS ↔ registratore telematico**: previsto dalla Legge di Bilancio 2025 (L. 207/2024) e attuato dal provvedimento dell'Agenzia **n. 424470 del 31 ottobre 2025**; l'abbinamento si fa online nel portale «Fatture e Corrispettivi» (matricola del registratore e del POS) dal marzo 2026. **Il provvedimento originale non è stato trovato né letto.** Le sanzioni e le scadenze per i POS nuovi sono riportate in modo discordante dai siti di commento: **non vanno usate** finché non si legge la fonte.
- Registratori Epson (es. **FP-81 II RT**): la documentazione per software house, distribuita anche da scontrinosmart.it, descrive il servizio web `fpmate.cgi` con comandi XML, la libreria ePOS-Print fiscal, il framework UPOS «Epson Fiscal Framework 2.0» e un'interfaccia WebSocket. Da verificare con Epson: firmware, TLS, comandi per documento commerciale, annullo, reso, pagamento misto. Un gestionale terzo (Spiagge.it) riporta che con la stampante fiscale va attivato SSL; da verificare anche questo.

## 3. Come potrebbe entrare in SmartEats (ipotesi, non decisione)

- **Via A, registratore fisico in rete locale** (Epson o altro). Un driver fiscale dentro `frontend/src/print/` (stessa forma `{ id, createBuilder(), send }` dei driver esistenti) manda il documento commerciale al registratore al pagamento dell'ordine o alla chiusura del conto. Pro: il registratore sigilla e trasmette da solo; la rete locale basta. Contro: ogni marca ha il suo protocollo; serve l'hardware per provare; se il registratore non risponde la vendita va decisa (blocco o coda).
- **Via B, Server RT / registratore in cloud** tramite le «API REST gestionali» dell'Agenzia con un partner abilitato. Pro: nessun hardware fiscale in sede. Contro: serve la rete (per la regola del punto di immissione) e un accordo con un partner.
- **Via C, procedura web dell'Agenzia**: non integrabile; solo un'indicazione al cliente che emette pochi documenti.
- **Non** diventare noi un Server RT approvato: richiede approvazione del modello e certificazioni (§2.2-2.3), sproporzionato.

## 4. Sagre e associazioni

Il PDF non dice nulla su quali soggetti siano esonerati: la questione (associazioni, eventi occasionali, regimi speciali) è **fuori da questa fonte** e va chiesta a un consulente. Finché non è chiarita, il fiscale resta un modulo **facoltativo**, acceso dal master solo per i locali che ne hanno bisogno.

## 5. Domande aperte (da chiudere prima di scrivere codice)

1. A chi serve davvero (ristoranti sì; sagre e asporto occasionale: da chiarire con un consulente)?
2. Quale registratore usano i clienti target? Una marca sola per cominciare e un'unità in prova.
3. Quando nasce il documento: al pagamento dell'ordine (stand) o alla chiusura del conto (ristorante, con pagamenti parziali e divisi)? Come si trattano storno, omaggio, sconto, coperto, pagamento misto, e il «non riscosso»?
4. Cosa succede se il registratore è spento o in errore al momento del pagamento (coda, riprova, avviso)?
5. Lettura del provvedimento del 28 ottobre 2016, del provvedimento n. 424470/2025 e degli allegati «API REST» e «Layout documento commerciale V 5».

## 6. Primo passo possibile e sicuro

(1) Leggere le fonti ancora aperte; (2) procurarsi un registratore in prova; (3) un solo scenario («ordine pagato subito, contanti o carta, senza sconti») con un simulatore, come per la stampante (`npm run mock:epos`); (4) solo dopo gli scenari difficili. Il simulatore **non** sostituisce la prova con un registratore vero.
