# WhatsApp: disegno

Stato: **W1 e W2 realizzate** (15 ottobre 2026, migrazioni 053-054): coda, driver finto e `meta`, eventi di prenotazione e asporto, scadenze, tetto, Master e stato nella pratica; webhook (stato di consegna, STOP/RIPRENDI, risposta automatica), fidelizzazione con consenso separato, pagine `/privacy` e `/terms`, link breve `/s/…`, script dei modelli (`npm run whatsapp:templates`). **Da fare:** W0 (tu, con `docs/guida-whatsapp-meta.md`) e la prova reale col numero; la registrazione dei modelli è nello script.

**STOP vale per tutti i locali** (il numero è unico): chi lo scrive non riceve più nulla da questo numero finché non scrive RIPRENDI. Decisioni di Luca, 15 ottobre 2026: avvisi **automatici** da un **numero unico** della piattaforma (nessuna burocrazia a carico dei locali); il numero del singolo locale è un'evoluzione; niente funzione «manuale» a sé (resta solo come rete di sicurezza).
Corrisponde al modulo `whatsapp`, a pagamento come gli altri. Per le regole di sviluppo vale `CLAUDE.md`
(RLS, validazione zod, audit, nomenclatura inglese, endpoint pubblici).

## 1. Cosa vogliamo

Quando una prenotazione o un ordine da asporto cambia stato, il cliente riceve **in automatico** un messaggio WhatsApp,
senza che il personale faccia nulla. Il messaggio parte da **un solo numero della piattaforma** («SmartEats») e dice per
conto di chi scrive: *«Pizzeria Rossi: la tua prenotazione per venerdì alle 20:00 è confermata.»* È un modulo acceso dal
Master, venduto a parte. Il numero **del singolo locale** è un'evoluzione prevista (§3, «driver»).

## 2. Il numero unico

- Un solo numero, tuo, registrato sulla **WhatsApp Business Platform** (API ufficiale di Meta). Vive nel cloud di Meta: si
  verifica una volta con un codice via SMS o chiamata, poi nessuna SIM da tenere accesa. Può essere un numero virtuale.
- **Non deve essere già su WhatsApp** (app normale o Business): va usato un numero nuovo dedicato agli avvisi.
- Il cliente vede «SmartEats» (nome visualizzato approvato da Meta) e il testo nomina il locale.
- **Risposte dei clienti:** a questo numero non risponde nessuno. Si risponde in automatico (la risposta libera è
  ammessa dentro la finestra di 24 ore aperta dal cliente) con «Per parlare con *Pizzeria Rossi* chiama il 0123…»,
  usando il telefono che il locale ha già impostato per prenotazioni e asporto. Se risponde STOP non gli scriviamo più.
- **Il locale non fa nulla**: nessun account Meta, nessun numero, nessuna verifica. Accende il modulo (lo fa il Master),
  sceglie gli eventi e basta.

## 3. Cosa serve a te, una volta (e cosa no)

**Serve:**
1. un **Meta Business Portfolio** (account Meta Business) e un'**app** su Meta for Developers con il prodotto WhatsApp;
2. il **numero** verificato e il **nome visualizzato** approvato;
3. una **pagina privacy e termini pubblica** (la preparo io: `/privacy` e `/terms`);
4. un **metodo di pagamento** sull'account WhatsApp, perché Meta fattura qui i messaggi.

**Non serve** (per partire): Tech Provider, Embedded Signup, review dei permessi avanzati, verifica azienda dei locali.
Senza verifica azienda Meta fissa un **limite di partenza** di qualche centinaio di clienti diversi al giorno: per i primi
locali basta; si alza con la verifica quando i volumi lo richiederanno. I requisiti di Meta cambiano spesso: al momento di
collegare il numero ti dirò esattamente cosa chiede il pannello.

**Costi (onestà).** Meta addebita ogni messaggio in base alla categoria (un avviso su una prenotazione è «utility»: pochi
centesimi). Con un numero unico **i messaggi li paghi tu**: conviene includerli nel canone del modulo con un **tetto
mensile** per locale (es. «fino a 300 avvisi, oltre a consumo»); il contatore per locale c'è già nel registro degli invii.

**Driver intercambiabile.** Il motore parla con un «driver» (`meta_cloud` oggi). In futuro un locale che vuole il proprio
numero ha un driver con le **sue** credenziali (via intermediario o Embedded Signup) senza cambiare coda, eventi, consenso
e log. È la stessa idea dei driver di stampa.

**Rete di sicurezza.** Se un invio fallisce, il pannello della prenotazione/ordine mostra «WhatsApp non inviato: motivo» e
il pulsante col messaggio già pronto per mandarlo a mano (i link esistono già).

## 4. Messaggi: eventi, tempi, modelli

Ogni messaggio ha l'intestazione **«SmartEats × NomeLocale»** (variabile) e il nome del locale nel testo. Uno solo per
evento e per pratica; rispetta il «STOP». Gli interruttori per evento li gestisce **solo il Master**, mai il locale.

### Prenotazione ristorante
```
richiesta ──► confermata ──► (arrivato, concluso)             nessun messaggio
    │             ├──► annullata dal locale ─────────────────► «annullata»
    │             └──► il cliente chiede l'annullo ──► il locale decide
    ├──► rifiutata ──────────────────────────────────────────► «rifiutata»
    └──► scaduta ────────────────────────────────────────────► «scaduta»
```
| Evento | Quando | Testo (sintesi) |
|---|---|---|
| **Ricevuta** | 2 minuti dopo la richiesta dal sito, **saltata** se nel frattempo è già gestita | abbiamo ricevuto la richiesta, ti confermiamo a breve |
| **Confermata** | il personale conferma, o la inserisce già confermata | giorno, ora, persone, link alla pagina di stato |
| **Promemoria** | **3 ore prima** dell'inizio del turno (solo se la prenotazione è ancora confermata e mancano più di 3 ore alla conferma) | ti aspettiamo oggi alle … |
| **Rifiutata** | il personale rifiuta | non possiamo accettare: invia una nuova richiesta o chiamaci |
| **Annullata** | annullata dal locale, o annullo chiesto dal cliente e confermato | la prenotazione è annullata |
| **Annullo non accettato** | il locale mantiene una prenotazione di cui il cliente aveva chiesto l'annullo | la prenotazione resta valida: per cambiare chiamaci |
| **Scaduta** | richiesta non gestita per 24 ore **o arrivato l'inizio del turno** | non siamo riusciti a confermare: **invia una nuova richiesta o chiamaci** |
| **Grazie** (fidelizzazione, W2) | **2 ore dopo la fine del turno**, mai dopo le 22:30 (allora la mattina dopo alle 10:00) | grazie della visita, tornaci a trovare presto; link per una recensione se il locale lo imposta |

Una richiesta **scaduta libera subito i posti**: già oggi una richiesta non decisa smette di tenerli, e da ora scade al
più tardi all'inizio del turno.

### Asporto
```
inviato ──► accettato ──► pronto ──► ritirato
   │            └──► annullato dal locale ───────────────────► «annullato»
   ├──► rifiutato ──────────────────────────────────────────► «rifiutato»
   └──► scaduto (non gestito entro 10 minuti dal ritiro) ───► «scaduto»
```
| Evento | Quando | Testo (sintesi) |
|---|---|---|
| **Inviato** | 2 minuti dopo, saltato se già gestito | ordine ricevuto, ritiro alle …, totale, ti confermiamo a breve |
| **Accettato** | il locale accetta (orario **attuale**, anche se cambiato) | confermato, ritiro alle …, paghi al ritiro |
| **Pronto** | la cucina ha finito | è pronto, ti aspettiamo |
| **Ritirato** | consegnato | grazie, buon appetito — **spento** di partenza |
| **Rifiutato** | il locale non accetta | non abbiamo potuto accettare: ordina per un altro orario o chiamaci |
| **Annullato** | annullato dal locale | il tuo ordine è annullato, ci scusiamo: chiamaci |
| **Scaduto** | nessuna risposta entro 10 minuti dal ritiro | non siamo riusciti a confermare: invia una nuova richiesta o chiamaci |
Il cliente che ritira la richiesta da solo non riceve nulla. Un ordine **veloce** al banco, senza telefono, non genera
messaggi: è come un registratore di cassa.

### Regole comuni
- **Chi riceve:** chi ha lasciato un **cellulare** (dal sito, al banco o al telefono). Non c'è nessuna spunta: se il
  modulo è acceso dal Master e c'è un cellulare valido, gli avvisi partono. Un fisso o un numero non valido si salta.
- **Pratiche, non messaggi:** il tetto mensile del locale conta le **pratiche** (prenotazioni o ordini con almeno un
  avviso); una pratica manda al massimo 6 messaggi. Superato il tetto gli avvisi si fermano e il Master lo vede.
- **Marketing a parte:** il «Grazie» è un messaggio di fidelizzazione (per Meta e per la legge è *marketing*, costa di più
  e vuole un **consenso separato**): parte solo per chi lo ha dato con una casella dedicata nelle pagine pubbliche. Gli
  avvisi sull'ordine invece sono transazionali.
- **Testi:** uguali per tutti i locali (modelli approvati da Meta), versionati; nessuna modifica dal locale.

## 5. Come funziona dentro (flusso e best practice)

**Outbox transazionale.** L'invio non avviene dentro la richiesta del personale:
1. nella **stessa transazione** che cambia lo stato (conferma, accettazione…) si scrive una riga in `whatsapp_messages`
   (`queued`) con la chiave di idempotenza `(riferimento, evento)`: un evento non parte mai due volte, anche se il personale
   preme due volte o c'è un retry;
2. un **lavoro in background** (come la pulizia dei dati) preleva le righe con `FOR UPDATE SKIP LOCKED`, le invia, registra
   l'id del messaggio e lo stato;
3. se Meta risponde con un errore temporaneo si riprova con attesa crescente (max 5 tentativi); se è definitivo
   (numero non su WhatsApp, modello non approvato) la riga va `failed` con il motivo.
Un invio fallito **non blocca mai** il lavoro: la conferma resta valida, e il personale vede «WhatsApp non inviato» e può
usare il messaggio pronto già esistente (WhatsApp/telefono manuale).

**Stati e webhook.** Meta chiama un nostro endpoint pubblico (`/api/webhooks/whatsapp`, firma `X-Hub-Signature-256`
verificata con il segreto dell'app) con `sent → delivered → read` o `failed`. Dal `phone_number_id` risaliamo al locale.
Il pannello della prenotazione/ordine mostra una riga: «WhatsApp: consegnato alle 19:02».

**Disiscrizione.** Se il cliente risponde STOP (o simile) lo segniamo e **non gli scriviamo più** da quel locale.

**Numeri.** Si normalizzano in formato internazionale (`+39…`); un fisso o un numero non valido si salta con motivo
«numero non raggiungibile» (nessun costo, nessun errore).

**Consenso.** Chi inserisce il proprio cellulare in `/book` o `/order` vede nella casella di consenso esistente che
riceverà **aggiornamenti su WhatsApp** su quella prenotazione/ordine. Al banco o al telefono il personale scrive il
cellulare perché il cliente vuole essere avvisato (il modulo lo dice sotto il campo). La **fidelizzazione** ha una casella
a parte, facoltativa, sulle pagine pubbliche.

**Sicurezza.** Token di accesso **cifrati a riposo** (AES-GCM, chiave in variabile d'ambiente, mai restituiti dalle API né
scritti nei log); tabelle con RLS e in `TENANT_SCOPED_TABLES`; log degli invii con numero **svuotato dopo 90 giorni**
(stessa pulizia delle prenotazioni); azioni dell'admin nell'audit.

## 6. Modello dati (migrazione 053, indicativo)

- **Credenziali della piattaforma** in variabili d'ambiente (`WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`,
  `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`), non nel database. Una tabella `whatsapp_accounts` per locale
  (credenziali proprie, cifrate) arriverà con il driver per-locale.
- `whatsapp_settings`: eventi accesi per locale (in `settings` come `whatsapp_event_*` = '1'/'0').
- `whatsapp_messages`: `event`, `ref_type` (`reservation`|`takeaway`), `ref_id`, `to_phone`, `template`, `params` (JSONB),
  `status` (`queued`, `sent`, `delivered`, `read`, `failed`, `skipped`), `error`, `wa_message_id`, `attempts`,
  `next_attempt_at`, indice unico `(tenant_id, ref_type, ref_id, event)`.
- Su `reservations` e `takeaway_orders`: `whatsapp_consent_at`.
- Modulo `whatsapp` in `utils/modules.js` (tipi: restaurant, takeaway_shop, street_food) + voce nel Master.

## 7. Interfaccia

- **Master → locale → WhatsApp** (solo qui si configura): modulo acceso/spento, interruttore per evento con **anteprima
  del testo**, tetto mensile di pratiche, contatore del mese, **messaggio di prova**, elenco degli ultimi invii con esito.
- **Locale** (sola lettura): nella prenotazione e nell'ordine una riga «WhatsApp: consegnato alle 19:02», e «Invia a mano»
  se è fallito. Nessuna impostazione.
- **Pagine pubbliche**: testo del consenso aggiornato; casella facoltativa per la fidelizzazione (W2).

## 8. Fasi

| Fase | Contenuto |
|---|---|
| **W0** | Tu: account Meta, app, numero e nome, metodo di pagamento. Io: `/privacy` e `/terms`, e la guida passo passo con le schermate da seguire. |
| **W1** | Modulo, outbox, driver (con uno **finto** per sviluppo e test), modelli, eventi di prenotazione e asporto, log. Si prova tutto senza Meta. |
| **W2** | Webhook (stati, STOP, risposta automatica), consenso nelle pagine pubbliche, riga di stato nei pannelli. |
| **W3** | Impostazioni e Master, invio dei modelli a Meta e prova reale con il numero di prova (5 destinatari) e poi col numero vero. |

W1-W2 non dipendono da Meta: li costruiamo e proviamo mentre fai W0.

## 9. Decisioni prese (15 ottobre 2026)

1. Eventi e flussi come in §4, con promemoria a 3 ore, ritardo di 2 minuti sulla «ricevuta», scaduta con invito a una
   nuova richiesta, annullo non accettato, messaggio di fidelizzazione dopo il turno.
2. Nessuna spunta: il cellulare inserito implica gli avvisi; l'ordine veloce senza cellulare non manda nulla.
3. Tetto in **pratiche** al mese, per locale.
4. Intestazione dei messaggi «SmartEats × NomeLocale»; nome visualizzato del numero «SmartEats».
5. Tutta la gestione è del **Master**, non del locale.
