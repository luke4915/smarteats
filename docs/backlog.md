# Backlog: insidie note e lavoro previsto

Elenco verificato sul codice. Quando ne risolvi una, toglila da qui nello stesso commit.


**Stampa**
- La ristampa offline copre solo gli ordini battuti da questa cassa nella sessione aperta (non quelli di altre casse).
- Gli indirizzi stampante si salvano ancora come `printer_address` con `printer_type` `'network'`; il valore `'usb'` della colonna non si usa più.
- `config.js`, `printOrder.js` e `usePrintQueue.js` (che dipendono da `apiClient` e React) non hanno test automatici; coda, archivio locale e driver sì (`offline.test.js`).
- La scritta "COPIA INTERNA ASSOCIAZIONE" e i nomi delle copie sono fissi nei template.

**Frontend e offline**
- Gli ordini rimasti in coda da prima dell'aggiornamento non hanno `client_order_id` né `session_id`, quindi vanno nella sessione aperta al momento della sincronizzazione.

**Evoluzione (priorità 2)**

**Dalla revisione del 4 ottobre 2026 (fase 4)**
- Sicurezza: `/api/assets` serve solo `.mp3` (i loghi di altri marchi sono stati tolti dal repository ma restano nella cronologia git); gli ordini offline sincronizzati dopo la chiusura aggiornano il totale atteso ma non sono segnalati nel report di sessione.
- Dati: `audit_logs` senza retention. Cassa e cucina scaricano ancora tutti gli ordini della sessione aperta (fino a 2000): se serve, filtrare per stato.
- Frontend: file ancora troppo grandi: `PrintProfiles.jsx` (stampa, si rifà con il test di stampa), `FloorEditor.jsx`.
- Operatività: i log vanno su stdout, manca un raccoglitore (dipende dall'hosting); il backup è su disco locale, la copia fuori dal server è da configurare; nessun monitoraggio esterno dell'health check.
- Asporto, ordini vecchi mai gestiti («Da chiudere»): un ritiro passato da più di due ore non va più in cucina da solo (`pickupIsStale`) e resta «accettato» nell'elenco del suo giorno, dove oggi si trova solo aprendo quella data. Manca una sezione **Da chiudere** in cima all'Asporto con questi ordini (giorni passati compresi) e due gesti: «Consegnato» o «Non ritirato» (annulla e, se c'era, rimette in dispensa). Caso raro (servizio lasciato aperto la notte, pranzo accettato e mai servito), per questo è rimandato.
- Asporto: accettare un ordine dal sito con un ingrediente finito (409 `INGREDIENT_SHORTAGE`) mostra solo l'errore: manca il «Vendi comunque» per admin e responsabile, che in cassa e in sala c'è già.
- Test nel browser dell'asporto (`frontend/e2e/takeaway.spec.js`): dopo le 23:15 oggi non ha più fasce, l'ordine va a domani e la cucina non lo vede ancora: in quel caso il test salta cucina e consegna e prova solo il giro del sito e l'ordine al banco (il giro completo gira di giorno; la regola «domani non è in cucina» è provata nei test col database).
- Qualità: i test nel browser (`frontend/e2e`) coprono solo il giro principale di ristorante e sagra; il frontend ha test unitari solo sulla logica pura; TypeScript non adottato.

**Magazzino (rimandato, vedi `docs/design-magazzino.md`, sezione 7)**
- Lotti e scadenze degli ingredienti (tracciabilità HACCP).
- Produzione di una preparazione con scorta propria («ho fatto 40 panetti oggi»): oggi le preparazioni si espandono nelle ricette al momento della vendita; un semilavorato comprato da un fornitore si gestisce già come ingrediente.
- Lettura automatica della bolla dalla foto (OCR) e importazione della fattura elettronica.
- Matrice popolarità/margine dei piatti e suggerimento di riordino dai consumi; più sedi con magazzino condiviso.

**Dal giro di fine ottobre 2026 (versione 0.4.0): da decidere e da fare**
- **Licenza offline:** fatto in 0.4.0 con una tolleranza di 10 ore dopo la scadenza (`utils/license.js`, `offline/licenseLock.js`). Resta da fare l'avviso per chi lavora senza rete quando mancano poche ore allo stop (`minutesLeft` c'è già, manca la scritta) e un conteggio per il master degli ordini accettati dopo la scadenza (oggi sono nell'audit `LATE_SYNC_AFTER_EXPIRY`). Limite noto: la sincronizzazione dopo la scadenza funziona finché dura il token di sessione (8 ore).
- **Pagamento dell'asporto con carta (Stripe Connect, prima in modalità test).** Il locale lo configura da sé tra: spento, facoltativo, obbligatorio (per tutti gli ordini o sopra una soglia). Ogni locale collega il suo conto Stripe (Connect), le chiavi stanno nelle variabili d'ambiente, un webhook firmato conferma il pagamento (come WhatsApp), l'importo lo ricalcola sempre il server. Modulo `payments` acceso dal master. Il pagamento online non sostituisce lo scontrino fiscale (registratore telematico): da chiarire prima di venderlo.
- **Partenza della cucina per l'asporto.** Pagato online → l'ordine parte da solo in tempo per il ritiro (`pickup_at` meno i minuti di lavoro); da pagare al ritiro → parte quando il cliente arriva («È arrivato» al banco o «Sono qui» sul link). Oggi gli asporti di oggi arrivano in cucina tutti insieme e la cucina li ordina per orario.
- **Stampa nel ristorante, passi rimasti:** stampa automatica della ricevuta all'incasso (scelta per dispositivo), «postazione cucina» che stampa da sola le comande che arrivano dal server (asporto accettato in anticipo), stampa della comanda di asporto all'accettazione. La prova sul campo con una stampante vera resta da fare.
- **WhatsApp:** il codice di ritiro è nella pagina del cliente ma non ancora nel messaggio «accettato» (serve un modello nuovo `v2` registrato su Meta). Canale SMS come alternativa: costa a messaggio, va dopo.
- **Riordino delle cartelle del frontend:** tipi di locale (`restaurant`, `stand`, `takeaway`) separati dalle funzioni opzionali (magazzino, WhatsApp, KDS, statistiche, menu QR); PR a parte, solo spostamenti, dopo questo rilascio.
- **Prove su dispositivi veri:** iPhone e iPad (margini dello schermo, carrello, tasti rapidi dei contanti), cassa offline con due casse e rete spenta, report PDF su carta.
- **Esportazioni:** invio automatico del report di chiusura al commercialista (email), e il PDF di più serate insieme.
