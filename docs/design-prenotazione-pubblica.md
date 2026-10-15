# Pagina pubblica di prenotazione (P2): definizione

Stato: **da approvare**. Completa `docs/design-prenotazioni.md` (sezioni 3 e 6) con la pagina vista dal cliente e le sue regole.
Non cambia nulla di quanto il personale usa già (P1): aggiunge un ingresso per le richieste.

## 1. Cosa vede il cliente

Un solo indirizzo, `nome-locale.dominio/prenota`, pensato per il telefono (si apre da un QR sul tavolo, dal sito o da Instagram).
Quattro passi, tutti nella stessa pagina, uno alla volta:

1. **Quando**: scelta del giorno (prossimi N giorni, i chiusi sono grigi) e del turno. Un turno senza posto non compare
   come «pieno» con numeri: è semplicemente non selezionabile, con la scritta «non disponibile».
2. **Quanti siete**: − / + da 1 a 10 persone. Oltre: «Per gruppi più grandi chiamaci» con il telefono del locale (tocco per chiamare).
3. **I tuoi dati**: nome, telefono (obbligatori), email e note (allergie, seggiolone: facoltativi). Una riga di informativa
   con il link alla privacy e una casella da accettare.
4. **Riepilogo e invio**: «Giovedì 22 ottobre · 19:30 · 4 persone · a nome Rossi». Pulsante «Invia richiesta».

Dopo l'invio: **«Richiesta ricevuta»**. Dice chiaramente che *non è ancora una prenotazione*: il locale la conferma a breve
(di solito entro … ore, testo impostabile), e che per ogni cambio basta il link personale.
Il link porta a una pagina di stato con: stato (in attesa / confermata / rifiutata / annullata), dati della richiesta,
pulsante **«Annulla la richiesta»** e il telefono del locale.

Tono: italiano semplice, nessun gergo («richiesta», non «booking»); colore d'accento del locale; il nome del locale in alto.
Accessibile: tutto raggiungibile da tastiera, contrasti da WCAG AA, pulsanti da 48 px.

## 2. Regole (le decide sempre il server)

- Il portale manda **solo** data, turno, persone e dati del cliente. Capienze, stati, durata e disponibilità le ricalcola il server
  con le stesse funzioni di P1 (`utils/bookings.js`).
- Una richiesta nasce `requested` e **tiene il posto 24 ore** (già deciso), poi decade (`expired`).
- Fuori dall'anticipo consentito (minimo ore / massimo giorni) o in un giorno con chiusura: rifiutata con messaggio chiaro.
- Tetto per telefono: **al massimo 2 richieste in attesa** con lo stesso numero; la terza risponde «hai già due richieste
  in attesa, aspetta la conferma o chiamaci».
- Il personale conferma, rifiuta o annulla dall'agenda (già fatto in P1). Il cliente vede l'esito aprendo il suo link.
- Se il cliente annulla dal link: stato `cancelled`, il posto torna libero, il personale vede l'annullo in agenda
  (evento `reservation_updated`).

## 3. Sicurezza e privacy

Sono endpoint pubblici: valgono le regole di `CLAUDE.md` §3.4 e §4.

| Misura | Come |
|---|---|
| Isolamento | `resolveTenantFromHost` + `withTenantClient`; colonne scelte una per una; modulo `bookings` acceso e portale attivo, altrimenti 404. |
| Anti-automatici | limitatore dedicato per IP (es. 10 invii/ora), campo «trappola» nascosto, tempo minimo di compilazione (3 s). |
| Link del cliente | `public_token` casuale lungo (già in 044); la pagina di stato mostra solo la propria richiesta; mai elenchi. |
| Dati richiesti | solo nome, telefono, email e note facoltative; informativa visibile; consenso registrato con data. |
| Conservazione | dopo N giorni dalla fine (impostabile, 90 di partenza) nome, telefono, email e note si svuotano; restano i numeri. |
| Niente fughe | nessuna risposta pubblica contiene dati di altri clienti, né capienze o numeri di posti. |
| Audit | `BOOKING_PORTAL_REQUEST` / `BOOKING_PORTAL_CANCEL` nell'audit del locale, senza dati personali nei dettagli. |

## 4. Cosa serve costruire

**Backend**
- Migrazione 046: `reservations.consent_at` (data del consenso) e, se serve, indice per cercare per telefono tra le richieste in attesa.
  Nessuna tabella nuova.
- `routes/publicBooking.js` (senza login):
  - `GET /public/booking/info`: nome del locale, testo di benvenuto, telefono, persone massime, giorni prenotabili, turni attivi.
  - `GET /public/booking/availability?date=`: per ogni turno solo `available: true|false` (mai numeri).
  - `POST /public/booking/requests`: crea la richiesta (zod, limitatore, trappola, tetto per telefono) e restituisce `token`.
  - `GET /public/booking/requests/:token` e `POST /public/booking/requests/:token/cancel`.
- Impostazioni nuove in `settingsSchema` (solo admin): `booking_portal_enabled`, `booking_portal_welcome`,
  `booking_portal_phone`, `booking_portal_max_party`, `booking_portal_min_notice_hours`, `booking_portal_max_days`,
  `booking_retention_days`. Quelle del portale in `PUBLIC_SETTINGS_KEYS`, **mai** la conservazione.
- Pulizia dei dati personali scaduti (lavoro periodico con `withTenantClient`).
- Test di integrazione: isolamento fra locali, tetto per telefono, anticipo, turno pieno, annullo, token errato, modulo spento,
  nessuna colonna interna nelle risposte.

**Frontend**
- Pagina `/prenota` (route pubblica, stile sobrio come il resto, senza menu né login), con i quattro passi e la pagina di stato.
- In Impostazioni → Prenotazioni: interruttore del portale, testi, limiti, link e **QR da stampare**.
- In agenda: la provenienza «Portale» (già prevista) e un indicatore delle richieste nuove.
- Test nel browser: richiesta dal telefono → conferma in agenda → il cliente vede «Confermata» → annullo.

## 5. Cosa NON entra (volutamente)

Email automatiche (P4), pagamenti o caparra, scelta del tavolo da parte del cliente, lingue diverse dall'italiano,
account del cliente. Le piattaforme (P5) arrivano dopo, con gli accordi.

## 6. Da decidere (con la proposta in grassetto)

1. **Persone massime dal portale:** **10** (oltre: telefona).
2. **Anticipo:** minimo **2 ore**, massimo **60 giorni**.
3. **Conservazione dei dati:** **90 giorni** dalla data della prenotazione.
4. **Tetto per telefono:** **2** richieste in attesa.
5. **Informativa privacy:** testo standard breve scritto da noi, con il link alla pagina del locale se ne ha una; da far
   rivedere a chi cura la privacy del locale (non è consulenza legale).
6. **Conferma automatica** per i turni con molti posti liberi? **No**: il personale conferma sempre (decisione già presa;
   la rivedremmo solo su richiesta dei locali).
