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
- Asporto: accettare un ordine dal sito con un ingrediente finito (409 `INGREDIENT_SHORTAGE`) mostra solo l'errore: manca il «Vendi comunque» per admin e responsabile, che in cassa e in sala c'è già.
- Test nel browser dell'asporto (`frontend/e2e/takeaway.spec.js`): dipende dall'ora. Sceglie il primo giorno prenotabile e l'ultima fascia; la sera tardi «oggi» non ha più fasce, l'ordine va a domani e la cucina non lo vede, quindi il test fallisce. Va fatto scegliere un giorno e una fascia fissi.
- Qualità: i test nel browser (`frontend/e2e`) coprono solo il giro principale di ristorante e sagra; il frontend ha test unitari solo sulla logica pura; TypeScript non adottato.

**Magazzino (rimandato, vedi `docs/design-magazzino.md`, sezione 7)**
- Lotti e scadenze degli ingredienti (tracciabilità HACCP).
- Produzione di una preparazione con scorta propria («ho fatto 40 panetti oggi»): oggi le preparazioni si espandono nelle ricette al momento della vendita; un semilavorato comprato da un fornitore si gestisce già come ingrediente.
- Lettura automatica della bolla dalla foto (OCR) e importazione della fattura elettronica.
- Matrice popolarità/margine dei piatti e suggerimento di riordino dai consumi; più sedi con magazzino condiviso.
