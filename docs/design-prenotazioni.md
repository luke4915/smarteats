# Prenotazioni: disegno

Stato: **P1 e P2 realizzate** (15 ottobre 2026, migrazioni 044-047). P3 in poi da fare. Decisioni prese con Luca il 14-15 ottobre 2026.

Corrisponde alla Fase 4 di `docs/requirements.md` (4-1 … 4-6). Per le regole di sviluppo vale `CLAUDE.md`
(RLS, validazione zod, audit, endpoint pubblici).

## 1. Il problema da risolvere

I locali che usano una piattaforma di prenotazione (TheFork e simili) ricevono le richieste su uno schermo e poi **ricopiano a
mano** nome, persone e orario sulla mappa dei tavoli disegnata su carta. Le due cose non si parlano: la piattaforma non
conosce i tavoli, e la mappa non conosce le prenotazioni.

Noi abbiamo già la **pianta reale della sala**. Il valore del modulo è questo: *la prenotazione si assegna a un tavolo
sulla pianta, e quando il cliente arriva, il tavolo si apre con i coperti già pronti.* Niente copiatura.

## 2. Decisioni prese

| Tema | Decisione |
|---|---|
| Turni | **Fissi** (es. 19:30 e 21:30). Niente orario libero con durata, almeno in prima versione. |
| Flusso | Il cliente invia una **richiesta** dal portale pubblico; il **personale la conferma** (o rifiuta). La conferma raggiunge il cliente e vale per il locale. |
| Email | **Funzione aggiuntiva, dopo.** Nella prima versione la conferma al cliente la scrive il personale (telefono, WhatsApp, email dal proprio client) con un messaggio già pronto. |
| Piattaforme (TheFork, Google…) | **Dopo**, e solo con un accordo di partnership: non sono integrazioni che si «accendono». Il modello nasce già pronto: ogni prenotazione ha una **provenienza** e un identificativo esterno. |
| Solo ristoranti | Modulo `bookings`, ammesso solo al tipo ristorante (come `tables`). |

## 3. Come funziona, dal punto di vista di chi lo usa

**Il cliente** (dal telefono, sul sito del locale `nome.miodominio.it/prenota`):

1. sceglie la **data** e il **turno** (vede solo quelli con posto), il **numero di persone**;
2. scrive nome, telefono, (email facoltativa), eventuali note (allergie, seggiolone);
3. invia. Vede «Richiesta ricevuta: il ristorante ti confermerà a breve» e un **link personale** per controllare lo stato
   o annullare. Non è ancora una prenotazione: è una richiesta.

**Il personale** (in SmartEats, nuova voce «Prenotazioni»):

1. vede **«Da confermare»** (le richieste), per data e turno;
2. **conferma** o **rifiuta** (con una motivazione breve);
3. alla conferma compare un messaggio già scritto («Prenotazione confermata: venerdì 17 alle 19:30, 4 persone, a nome
   Rossi») con i pulsanti **WhatsApp**, **email** e **chiama**: il personale lo manda con il proprio telefono;
4. **assegna il tavolo sulla pianta**: tocca i tavoli liberi per quel turno; sono evidenziati quelli con posti
   sufficienti. Per i gruppi grandi se ne possono assegnare più di uno;
5. in **Sala**, sulla pianta, i tavoli prenotati per il turno in corso mostrano un segno con l'ora e il nome
   («19:30 · Rossi · 4»): è la «mappa di carta», ma viva;
6. quando il cliente arriva: **«Arrivato»** sulla prenotazione → si apre il **conto** sul tavolo assegnato, con i
   coperti già inseriti, e la prenotazione risulta «seduta».
7. se non si presenta: **«Non si è presentato»**.

Il personale può anche **inserire una prenotazione a mano** (telefonata, di persona): nasce già confermata, senza passare
dalla richiesta.

## 4. Il modello

Tutte le tabelle sono per locale (RLS, `tenant_id`, policy `tenant_isolation`, voce in `TENANT_SCOPED_TABLES`).

**`booking_shifts`**: i turni.

| Colonna | Note |
|---|---|
| `name` | «Cena 19:30» |
| `start_time` | ora d'inizio (ora locale del locale) |
| `weekdays` | giorni in cui vale (0-6) |
| `capacity` | coperti prenotabili per quel turno (di partenza, i posti attivi della sala) |
| `active` | per spegnerlo senza cancellarlo |

**`booking_closures`**: giorni o turni chiusi (ferie, evento privato). `date`, `shift_id` nullo = tutto il giorno, `reason`.

**`reservations`**: le prenotazioni e le richieste.

| Colonna | Note |
|---|---|
| `date`, `shift_id` | quando |
| `party_size` | persone (1-99; il portale ha un tetto più basso, configurabile) |
| `status` | `requested`, `confirmed`, `declined`, `cancelled`, `seated`, `no_show` |
| `customer_name`, `phone`, `email`, `notes` | dati del cliente |
| `source` | `portal`, `staff`, `thefork`, `google`… |
| `external_id` | identificativo nella piattaforma (nullo per le nostre); unico per locale e provenienza |
| `public_token` | stringa casuale lunga per il link del cliente; non si può indovinare |
| `requested_at`, `decided_by`, `decided_at`, `decline_reason` | chi ha deciso e quando |
| `check_id` | il conto aperto all'arrivo (nullo prima); sta sulla prenotazione, non su `checks` |

**`reservation_tables`**: i tavoli assegnati (`reservation_id`, `table_id`), uno o più.

**Impostazioni** (`settings`, solo admin): portale acceso, anticipo minimo (ore), anticipo massimo (giorni), persone
massime dal portale (oltre: «telefona»), testo da mostrare, per quanti giorni si conservano i dati dei clienti.

### Stati

```
requested ──conferma──▶ confirmed ──arrivato──▶ seated
   │                       │  └──non si presenta──▶ no_show
   ├──rifiuta──▶ declined  └──annulla──▶ cancelled
   └──annulla (cliente o personale)──▶ cancelled
```

Un cambio di stato si registra nell'audit (`BOOKING_*`) e manda l'evento `reservation_updated` al personale (mai al KDS
pubblico).

## 5. Le regole

- **Disponibilità** di un turno in una data: `capacity − (coperti confermati + coperti in attesa)`. Le richieste in
  attesa **tengono il posto** finché qualcuno decide, così due clienti non prendono lo stesso. Un turno con una chiusura, o fuori
  dall'anticipo consentito, non è prenotabile.
- **Assegnazione tavoli:** un tavolo non può essere assegnato a due prenotazioni attive dello stesso turno e data (409). Se i
  posti sono meno delle persone, il sistema avvisa ma non vieta (decide il personale).
- **Arrivato:** apre il conto sul primo tavolo assegnato (stesso percorso di «Apri tavolo»: sessione aperta, tavolo
  libero, un conto per tavolo); se il tavolo è occupato dice quale. `check_id` lega le due cose.
- **Il server decide sempre:** il portale non manda mai capienze o stati; manda solo i dati del cliente e la scelta di
  data e turno, e il server ricalcola tutto.

## 6. Il portale pubblico: sicurezza e privacy

Sono endpoint **senza accesso**, quindi le regole di `CLAUDE.md` §3.4 valgono in pieno:

- `resolveTenantFromHost` + `withTenantClient`, **colonne selezionate una per una**, mai `SELECT *`;
- un limitatore dedicato (per indirizzo IP), un campo «trappola» invisibile contro i programmi automatici, e un tetto alle
  richieste in attesa per telefono;
- il link del cliente usa un **token lungo e casuale**; la pagina di stato mostra solo la propria richiesta;
- si chiedono **solo** i dati che servono (nome, telefono, email facoltativa, note) con l'informativa sulla privacy
  visibile; l'impostazione di conservazione dice dopo quanti giorni i dati personali di una prenotazione conclusa si
  cancellano (i numeri aggregati restano);
- niente presenza di dati di altri clienti in nessuna risposta pubblica, nemmeno «turno pieno» con numeri.

## 7. Come entrano le piattaforme, dopo

Perché non servano riscritture:

- le prenotazioni hanno già `source` ed `external_id`: una richiesta di TheFork è una `reservation` con `source = thefork`;
- un punto d'ingresso protetto da firma (`POST /integrations/<piattaforma>/…`), idempotente per `external_id`, che
  crea o aggiorna la prenotazione;
- un **feed di disponibilità** in uscita (la stessa regola della sezione 5);
- **prima** serve un accordo con la piattaforma: TheFork e Google rilasciano le credenziali solo ai partner approvati.
  Quindi la strada è: motore nostro funzionante → locali che lo usano → richiesta di partnership.

In mezzo, utile subito e senza accordi: un **calendario iCal** delle prenotazioni confermate, per chi vuole vederle
anche nel calendario del telefono.

## 8. Fasi

| Fase | Contenuto | Stato |
|---|---|---|
| **P1** | Modello (migrazione 044), turni e chiusure, inserimento a mano, **agenda**, conferma/rifiuto, **assegnazione sulla pianta**, **«Arrivato» → conto**, segno nella Sala, messaggio pronto (WhatsApp/chiama/email). Modulo `bookings`. | **fatta** |
| **P2** | **Portale pubblico** con richieste, pagina di stato con link, annullo, anti-spam, informativa. | **fatta** |
| **P3** | Messaggi pronti (WhatsApp/email/chiama), **foglio stampabile** del turno con la pianta, lista d'attesa semplice. | da fare |
| **P4** | **Email automatiche** (conferma, promemoria): funzione aggiuntiva, con servizio di invio e consenso. | dopo |
| **P5** | Piattaforme (TheFork, Google), calendario iCal. | dopo, con accordi |

Ogni fase va in produzione da sola e si prova con la scaletta (`docs/prova-a-mano.md`, sezione da aggiungere).

## 9. Impatto sul codice esistente

- `backend/utils/modules.js`: nuovo modulo `bookings` (solo ristorante); catalogo e master panel lo mostrano.
- Sala (`smarteats/sala/FloorView.jsx`): segno sul tavolo prenotato; `GET /checks` non cambia.
- Nuove route: `routes/bookings.js` (staff), `routes/publicBooking.js` (pubbliche), schemi in `schemas/bookingSchema.js`.
- Nuova vista in SmartEats: `smarteats/prenotazioni/` (agenda, dettaglio, assegnazione sulla pianta, riuso di `floor/FloorCanvas`).
- Rete di sicurezza: un test nel browser per il giro (richiesta dal portale → conferma → assegna tavolo → arrivato → incasso).

## 10. Domande aperte

Decise:

1. **Durata del tavolo:** personalizzabile **per turno** (`duration_minutes`, 90 minuti di partenza). Un tavolo si può
   assegnare a due turni di fila se il secondo comincia quando il primo è finito (19:30 + 90' = 21:00).
2. **Le richieste in attesa tengono il posto 24 ore**, poi decadono da sole.
3. **Chi può confermare:** tutti i ruoli di sala (admin, responsabile, cassa, cameriere).
4. **Gruppi grandi:** oltre 10 persone il portale (P2) dice «telefona».
5. **Capienza:** una sola per turno (i posti della sala).
6. **Lingua:** solo italiano.

Da decidere con la P2: soglia anti-spam delle richieste per telefono, per quanti giorni si conservano i dati dei clienti.
