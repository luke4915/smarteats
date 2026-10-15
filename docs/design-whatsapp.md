# WhatsApp: disegno

Stato: **approvato nelle linee generali** (nessun codice scritto). Decisioni di Luca, 15 ottobre 2026: avvisi **automatici** da un **numero unico** della piattaforma (nessuna burocrazia a carico dei locali); il numero del singolo locale è un'evoluzione; niente funzione «manuale» a sé (resta solo come rete di sicurezza).
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

## 4. Messaggi: eventi e modelli

I messaggi a clienti che non ci hanno scritto devono usare **modelli (template) approvati da Meta**. Li scriviamo noi, in
italiano, **uguali per tutti i locali**, versionati (`se_reservation_confirmed_v1`), e li sottoponiamo a Meta per ogni
account in automatico all'attivazione. Restano rigorosamente transazionali (niente promozioni: Meta li riclassificherebbe
come marketing, più costosi e con più vincoli).

| Evento | Quando parte | Variabili | Bottone |
|---|---|---|---|
| **Prenotazione ricevuta** | arriva una richiesta dal portale | nome, giorno, ora, persone, locale | «Vedi richiesta» (link alla pagina di stato) |
| **Prenotazione confermata** | il personale conferma | nome, giorno, ora, persone, locale | «Vedi prenotazione» |
| **Prenotazione rifiutata** | il personale rifiuta | nome, giorno, ora, locale | «Chiama» (telefono del locale) |
| **Prenotazione annullata** | il locale conferma l'annullo chiesto dal cliente, o annulla lui | nome, giorno, ora, locale | — |
| **Asporto inviato (in attesa)** | arriva l'ordine dal sito | nome, ritiro, totale, locale | «Vedi ordine» |
| **Asporto confermato** | il locale accetta | nome, ritiro (anche se cambiato), totale, locale | «Vedi ordine» |
| **Asporto pronto** | la cucina ha finito | nome, locale | — |
| **Asporto ritirato** | consegnato | nome, locale | — |
| **Asporto annullato** | annullato dal locale | nome, locale | «Chiama» |
| **Asporto rifiutato** | non accettato | nome, motivo, locale | «Chiama» |

Proposte mie, da confermare:
- **«Asporto rifiutato»** aggiunto: un ordine non accettato non può restare muto. Se preferisci puoi usare lo stesso
  testo di «annullato».
- **«Ritirato» spento di partenza:** costa come gli altri e dice poco («grazie, buon appetito»). Ogni evento si
  accende/spegne per locale; quelli utili (ricevuta, confermata, pronto, annullata, rifiutata) sono accesi.
- **Prenotazioni inserite dal personale** (telefono, di persona): nessun messaggio automatico, a meno che il personale
  spunti «Invia conferma su WhatsApp» nel modulo (il consenso c'è, l'ha dato a voce al telefono).

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

**Consenso.** Nelle pagine `/book` e `/order` la casella già presente diventa due frasi distinte: trattamento dei dati per
la prenotazione/ordine (obbligatoria) e **«Voglio ricevere aggiornamenti su WhatsApp»** (facoltativa, salvata con data).
Senza consenso non si invia.

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

- **Impostazioni → WhatsApp** (admin): interruttori per evento con **anteprima del testo**, telefono del locale mostrato
  nelle risposte, **messaggio di prova** al proprio numero, elenco degli ultimi invii con esito e contatore del mese.
- **Prenotazione / ordine**: riga di stato dell'ultimo messaggio («consegnato alle 19:02») e «Invia di nuovo» /
  «Invia a mano» se fallito.
- **Master**: accensione del modulo per locale e, per assistenza, lo stato degli ultimi invii.

## 8. Fasi

| Fase | Contenuto |
|---|---|
| **W0** | Tu: account Meta, app, numero e nome, metodo di pagamento. Io: `/privacy` e `/terms`, e la guida passo passo con le schermate da seguire. |
| **W1** | Modulo, outbox, driver (con uno **finto** per sviluppo e test), modelli, eventi di prenotazione e asporto, log. Si prova tutto senza Meta. |
| **W2** | Webhook (stati, STOP, risposta automatica), consenso nelle pagine pubbliche, riga di stato nei pannelli. |
| **W3** | Impostazioni e Master, invio dei modelli a Meta e prova reale con il numero di prova (5 destinatari) e poi col numero vero. |

W1-W2 non dipendono da Meta: li costruiamo e proviamo mentre fai W0.

## 9. Da decidere

1. **Eventi** (§4): tabella confermata? In particolare «asporto rifiutato» aggiunto e «ritirato» spento di partenza.
2. **Prenotazioni inserite dal personale**: nessun messaggio, salvo una spunta esplicita «Invia conferma su WhatsApp»?
3. **Tetto di messaggi per locale** nel canone: lo decidi tu; il sistema lo conta e lo mostra.
4. **Nome visualizzato** del numero: «SmartEats» o un altro nome di prodotto?
