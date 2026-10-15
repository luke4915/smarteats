# WhatsApp: disegno

Stato: **da approvare** (nessun codice scritto). Proposta del 15 ottobre 2026, su richiesta di Luca.
Corrisponde al modulo `whatsapp`, a pagamento come gli altri. Per le regole di sviluppo vale `CLAUDE.md`
(RLS, validazione zod, audit, nomenclatura inglese, endpoint pubblici).

## 1. Cosa vogliamo

Quando una prenotazione o un ordine da asporto cambia stato, il cliente riceve **in automatico** un messaggio WhatsApp
dal **numero del locale**, senza che il personale faccia nulla. Ogni locale usa il proprio numero. È un modulo
acceso dal Master, venduto a parte.

## 2. Il numero: dove sta, che cos'è

Con la **WhatsApp Business Platform** (l'API ufficiale di Meta) il numero **non sta in un telefono**: vive nel cloud di Meta.
- Va **verificato una volta** con un codice ricevuto per SMS o chiamata vocale. Dopo, la SIM non serve più per far
  funzionare l'invio.
- Può essere un cellulare, un **fisso** (si verifica con la chiamata) o un numero virtuale.
- **Attenzione:** un numero già registrato sull'app WhatsApp normale non può essere anche sull'API. Strade: usare un numero
  nuovo dedicato agli avvisi (il più semplice), oppure la modalità **«coexistence»** di Meta, che permette di usare lo stesso
  numero sia nell'app WhatsApp Business sia con l'API (ha condizioni: da verificare al momento dell'attivazione).
- Il cliente vede il **nome del locale** (nome visualizzato approvato da Meta) e il numero.

## 3. La burocrazia con Meta (diretto)

**Una volta, per te (il fornitore del software).** Per gestire molti locali ognuno col suo numero, il percorso di Meta è
quello del **Tech Provider** con **Embedded Signup**: il locale collega il suo numero da una finestra dentro la nostra app.
1. **Meta Business Portfolio** della tua società, con **verifica dell'azienda** (documenti: visura camerale, partita IVA).
2. **App su Meta for Developers** (tipo Business) con il prodotto WhatsApp.
3. **App Review** dei permessi `whatsapp_business_messaging` e `whatsapp_business_management`: servono una pagina
   **privacy** e **termini** pubblici, un video dimostrativo del flusso, e il completamento della verifica d'accesso.
4. Configurazione di **Embedded Signup** e di un utente di sistema con token.
Tempi realistici: da pochi giorni a 2-3 settimane, soprattutto per la verifica azienda e la review.

**Per ogni locale (guidato dalla finestra Embedded Signup).**
1. Accedere o creare il proprio account Meta Business; si crea il suo **WhatsApp Business Account**.
2. Scegliere il numero e **verificarlo** (SMS o chiamata).
3. Scegliere il **nome visualizzato** (deve richiamare il nome dell'attività; Meta lo approva).
4. Inserire un **metodo di pagamento** su Meta: i messaggi li fattura Meta **direttamente al locale**.
La verifica azienda del locale non è obbligatoria all'inizio: serve per alzare i limiti di invio (un locale nuovo parte da
poche centinaia di conversazioni al giorno, più che sufficiente per una pizzeria).

**Privacy.** Siamo responsabili del trattamento per il locale; Meta è sub-responsabile. Serve aggiornare l'informativa
(«i tuoi dati sono usati per inviarti aggiornamenti su WhatsApp») e raccogliere il **consenso** (vedi §6).

**Costi e margine (onestà).** Meta addebita ogni messaggio in base alla categoria (per un avviso su una prenotazione è
«utility»: pochi centesimi per messaggio; tariffe per Paese da verificare sul sito di Meta al momento). Andando
diretti **Meta fattura il locale** e noi non possiamo rivendere i messaggi con un ricarico (servirebbe lo status di Solution
Partner con linea di credito, un percorso più lungo). **Il tuo margine è il canone del modulo**: la scelta giusta è prezzarlo
come servizio («avvisi automatici ai clienti») e dire al locale che i messaggi li paga a Meta, a consumo.

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

- `whatsapp_accounts`: `tenant_id` (unico), `waba_id`, `phone_number_id`, `display_phone`, `display_name`, `token_enc`,
  `status` (`pending`, `connected`, `error`), `quality`, `connected_at`.
- `whatsapp_settings`: eventi accesi per locale (in `settings` come `whatsapp_event_*` = '1'/'0').
- `whatsapp_messages`: `event`, `ref_type` (`reservation`|`takeaway`), `ref_id`, `to_phone`, `template`, `params` (JSONB),
  `status` (`queued`, `sent`, `delivered`, `read`, `failed`, `skipped`), `error`, `wa_message_id`, `attempts`,
  `next_attempt_at`, indice unico `(tenant_id, ref_type, ref_id, event)`.
- Su `reservations` e `takeaway_orders`: `whatsapp_consent_at`.
- Modulo `whatsapp` in `utils/modules.js` (tipi: restaurant, takeaway_shop, street_food) + voce nel Master.

## 7. Interfaccia

- **Impostazioni → WhatsApp** (admin): stato del collegamento («Collegato · +39 …»), pulsante **Collega WhatsApp**
  (Embedded Signup), interruttori per evento con anteprima del testo, **Invia un messaggio di prova** al proprio numero,
  elenco degli ultimi invii con esito.
- **Prenotazione / ordine**: riga di stato dell'ultimo messaggio e «Invia di nuovo» se fallito.
- **Master**: accensione del modulo per locale e stato del collegamento (per assistenza).

## 8. Fasi

| Fase | Contenuto |
|---|---|
| **W0** | Tu: verifica azienda Meta, app, pagina privacy e termini pubblici, review. Io: pagina `/privacy` e `/terms`. In parallelo si può sviluppare con il **numero di prova** che Meta fornisce (5 destinatari). |
| **W1** | Outbox, invio, modelli, log, eventi di prenotazione e asporto, credenziali inserite a mano per **un locale pilota**. Test con Meta simulato. |
| **W2** | Webhook (stati, STOP), consenso nelle pagine pubbliche, riga di stato nei pannelli. |
| **W3** | Embedded Signup e invio automatico dei modelli a Meta, interfaccia di Impostazioni, Master. |

W1-W2 si costruiscono e si provano **prima** che la review sia approvata; W3 dipende dall'approvazione.

## 9. Da decidere

1. **Eventi**: confermi la tabella di §4 (aggiunta «asporto rifiutato», «ritirato» spento di partenza)?
2. **Prenotazioni del personale**: messaggio solo con la spunta esplicita, o mai?
3. **Numero**: consigli ai locali un numero dedicato agli avvisi (semplice) o puntiamo sulla coexistence?
4. **Dati azienda** per Meta: ragione sociale, P.IVA, sito/URL privacy: quelli che userai (il nome della società fornitrice).
5. **Prezzo del modulo**: lo decidi tu; nel Master mostreremo solo se è acceso.
