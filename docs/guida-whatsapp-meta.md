# Guida: collegare il numero WhatsApp (W0)

Per **te**, una volta sola. Alla fine gli avvisi partono da un numero unico, «SmartEats», per conto di ogni locale.
Tempo: circa un'ora, più l'attesa dell'approvazione dei modelli (da minuti ad alcune ore). Meta cambia spesso i nomi
dei pulsanti: se una schermata è diversa, cerca la voce con lo stesso significato. **Non serve** la verifica azienda per
iniziare (il limite di partenza è di qualche centinaio di clienti diversi al giorno).

## Prima di cominciare
- Un **numero nuovo**, mai registrato su WhatsApp (né app normale né Business). Può essere una SIM, un numero fisso (si
  verifica con la chiamata) o un numero virtuale. Deve poter ricevere **un** SMS o una chiamata.
- Un **account Facebook personale** (Meta lo usa per accedere).
- Una **carta** per il metodo di pagamento di Meta (i messaggi si addebitano lì, a consumo).
- Il **dominio** dell'app raggiungibile da Internet con HTTPS (per il webhook). In sviluppo si può provare solo fino al
  passo 4: il webhook richiede un indirizzo pubblico (per esempio con un tunnel).

## 1. Account Meta Business
1. Vai su **business.facebook.com** e crea un **Business Portfolio** (nome: quello del tuo prodotto).
2. Resta in **Impostazioni aziendali** (Business Settings): ti serviranno al passo 5.

## 2. Crea l'app
1. Vai su **developers.facebook.com → Le mie app → Crea app**.
2. Tipo di app: **Business** (o «Altro» → «Business»). Nome: «SmartEats». Collegala al tuo Business Portfolio.
3. Nell'app, **Aggiungi prodotto → WhatsApp → Configura**.
4. Da **Impostazioni app → Di base**: copia il **Segreto dell'app** (App Secret) → `WHATSAPP_APP_SECRET`.
   In **URL dell'informativa sulla privacy** metti `https://<tuo dominio>/privacy` e in **Condizioni d'uso**
   `https://<tuo dominio>/terms` (le pagine esistono già). Imposta la **categoria** (per esempio «Servizi aziendali»).

## 3. Il numero
1. In **WhatsApp → Configurazione API** (API Setup) c'è un numero di prova di Meta: va bene per provare con 5
   destinatari, senza aggiungere il tuo.
2. Per il numero vero: **Aggiungi numero di telefono**. Scegli il **nome visualizzato** («SmartEats»; deve richiamare
   il tuo prodotto e Meta lo approva), la categoria, e verifica il numero con il codice ricevuto.
3. Aggiungi il **metodo di pagamento** quando richiesto (Impostazioni di pagamento dell'account WhatsApp).
4. Annota due identificatori che compaiono in API Setup:
   - **ID numero di telefono** (Phone number ID) → `WHATSAPP_PHONE_NUMBER_ID`
   - **ID account WhatsApp Business** (WABA ID) → `WHATSAPP_WABA_ID`

## 4. Il token permanente
Il token temporaneo dura 24 ore: serve uno **permanente**.
1. **Impostazioni aziendali → Utenti → Utenti di sistema → Aggiungi** (ruolo Admin).
2. **Assegna risorse** → l'**app** (controllo completo) e l'**account WhatsApp** (controllo completo).
3. **Genera token**: scegli l'app e spunta `whatsapp_business_messaging` e `whatsapp_business_management`; durata:
   **mai**. Copialo subito (non si rivede) → `WHATSAPP_TOKEN`. Trattalo come una password.

## 5. Variabili d'ambiente sul server
Nel `.env` del backend (vedi `.env.example`):
```
WHATSAPP_DRIVER=meta
WHATSAPP_TOKEN=…            # passo 4
WHATSAPP_PHONE_NUMBER_ID=…  # passo 3
WHATSAPP_WABA_ID=…          # passo 3
WHATSAPP_APP_SECRET=…       # passo 2
WHATSAPP_VERIFY_TOKEN=…     # una parola lunga a tua scelta (la userai al passo 7)
WHATSAPP_LINK_BASE=https://<tuo dominio>
LEGAL_NAME=…  LEGAL_EMAIL=… # chi compare nelle pagine /privacy e /terms
```
Riavvia il backend.

## 6. Registra i modelli di messaggio
Dal backend:
```
npm run whatsapp:templates -- --dry-run     # mostra cosa verrebbe registrato
npm run whatsapp:templates                  # registra (si può rilanciare: salta quelli già presenti)
```
Sono 15 modelli in italiano (`se_reservation_confirmed_v1`…). In **WhatsApp → Modelli di messaggio** li vedi in stato
«In revisione»; diventano «Approvati» in minuti o poche ore. Un modello **non** si cambia a mano: se vuoi modificare un
testo si cambia in `utils/whatsapp.js` e si registra una **nuova versione** (`_v2`).

## 7. Il webhook (stati di consegna, STOP, risposte)
1. **WhatsApp → Configurazione** → **Webhook → Modifica**.
2. **URL di richiamo**: `https://<tuo dominio>/api/webhooks/whatsapp` · **Token di verifica**: lo stesso di
   `WHATSAPP_VERIFY_TOKEN`. Salva (Meta fa una chiamata di prova: il backend deve essere acceso).
3. **Gestisci** i campi webhook e **sottoscrivi** `messages`.

## 8. Prova
1. Nel Master, per un locale: **Moduli → Avvisi WhatsApp** acceso, poi il pulsante **WhatsApp**.
2. **Messaggio di prova** al tuo cellulare. Se non arriva, guarda l'errore mostrato (token, modello non ancora approvato…).
3. Fai una prenotazione dal sito `/book` con il tuo numero: dopo 2 minuti arriva «ricevuta»; conferma dall'agenda e
   arriva «confermata». In Prenotazioni, nel dettaglio, vedi «consegnato» e poi «letto».
4. Rispondi **STOP** a un avviso: non ne ricevi altri. **RIPRENDI** li riattiva.

## Costi e limiti da ricordare
- Meta addebita **ogni messaggio** (per Paese e categoria: «utility» per gli avvisi, «marketing» per il ringraziamento,
  più caro). Controlla le tariffe aggiornate nella pagina prezzi di WhatsApp Business Platform.
- Nel Master imposti per ogni locale le **pratiche incluse al mese**; il contatore mostra il consumo.
- Senza verifica azienda il limite è di qualche centinaio di clienti diversi in 24 ore per tutti i locali insieme; quando
  si avvicina, si chiede a Meta la **verifica azienda** (richiede i documenti della tua società) e il limite sale.
- La **qualità del numero** conta: se molti clienti segnalano i messaggi, Meta limita l'invio. Per questo gli avvisi sono
  solo transazionali, c'è il STOP e la fidelizzazione parte solo con consenso.

## Privacy: da far rivedere
I testi di `/privacy` e `/terms` sono una base ragionevole, **non** una consulenza legale: fai controllare a un
professionista il testo, il ruolo (locale titolare, tu responsabile) e l'accordo di trattamento con i locali prima di
vendere il servizio.
