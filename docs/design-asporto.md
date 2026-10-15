# Asporto: disegno

Stato: **realizzato** (15 ottobre 2026, migrazione 050). Decisioni prese con Luca il 15 ottobre 2026.

## 1. Cosa risolve

Una pizzeria (o un ristorante, o una sagra) prende ordini da portare via: dal telefono, al banco, dal sito. Oggi finiscono
su un foglietto. Qui diventano ordini veri: con un **orario di ritiro a fasce**, un **limite di pizze per fascia** (il forno
ha una capacità), l'**approvazione** del locale, la coda in cucina ordinata per ritiro, la consegna con l'incasso.

È un **modulo** (`takeaway`) che vale per tutti i tipi di locale: stessa pagina, stessi dati, stessa cucina. Chi fa **solo asporto** (pizzeria da taglio, forno, rosticceria) ha un tipo di locale suo, `takeaway_shop`: l'app SmartEats mostra solo Asporto, Cucina, Carta, Statistiche e Impostazioni, senza sala, tavoli né prenotazioni; la carta è semplice (niente portate né opzioni) e le statistiche sono quelle della cassa.

## 2. Come funziona

**Il cliente** (`nome-locale.dominio/order`, da telefono):
1. sceglie i prodotti (categorie, un tocco per aggiungere);
2. sceglie il giorno e la fascia di ritiro (vede solo quelle libere);
3. lascia nome e telefono, accetta l'informativa, invia;
4. ha un **link personale** con lo stato: «Ordine ricevuto» → «Ordine confermato» → «Ordine ritirato». Può ritirare la
   richiesta finché il locale non l'ha accettata; dopo, telefona.

**Il locale** (voce «Asporto», o campanella):
1. la richiesta compare nella **campanella** (con suono) e in cima alla lista, «Da approvare». **Accetta** (anche cambiando
   l'orario) o **Rifiuta** (motivo facoltativo);
2. accettata, l'ordine **va in cucina** (un ordine come gli altri): la cucina lo vede con **orario di ritiro e nome**, in coda
   per orario;
3. la cucina segna «Pronta»: in lista compare «Pronto»;
4. **Consegna e incassa** (contanti, carta, altro): l'ordine è concluso e conta nell'incasso;
5. **Al banco o al telefono**: «Nuovo ordine» con la carta a sinistra e il riepilogo a destra; nasce già accettato, con la
   prima fascia libera già scelta.

## 3. Regole

- **Fasce:** dagli orari impostati (per giorno della settimana, anche più finestre), ogni N minuti (10-60).
- **Carico:** ogni prodotto occupa il forno per `takeaway_load` porzioni (pizza 1, bibita 0, teglia 2…). La fascia accetta
  fino alla capienza impostata. Gli ordini **vivi** (da approvare o accettati) contano; gli altri no. Il personale può
  superare la capienza di proposito.
- **Anticipo:** minimo impostabile (30 minuti di partenza), massimo 7 giorni.
- **Tetti:** al massimo 3 richieste in attesa per telefono; oltre 40 pezzi si telefona.
- **Pagamento:** al ritiro. Il modello è pronto per il pagamento online (`payment_mode = 'online'`, non attivo).
- **Sessione:** accettare richiede il servizio aperto (409 `NO_ACTIVE_SESSION`): l'ordine di cucina nasce nella sessione
  in corso. Le richieste dal sito possono arrivare anche a servizio chiuso.
- **Prima dell'approvazione** l'ordine non è una comanda: vive in `takeaway_orders` con le righe in `items`; non scala lo
  stock né compare in cucina. All'accettazione si **ricalcolano** prezzi e stock dal catalogo.

## 4. Modello (migrazione 050)

- `takeaway_hours` (finestre per giorno), `takeaway_orders` (richiesta e suo stato: `requested → accepted → picked_up`;
  `rejected`, `cancelled`), `products.takeaway_load`. Tutte con RLS e in `TENANT_SCOPED_TABLES`.
- Impostazioni (`settings`): `takeaway_portal_enabled`, `takeaway_slot_minutes`, `takeaway_slot_capacity`,
  `takeaway_min_lead_minutes`, `takeaway_phone`, `takeaway_welcome`.
- Endpoint: staff `/api/takeaway/*` (settings, hours, slots, orders, accept/reject/picked-up/cancel, inbox); pubblici
  `/api/public/takeaway/*` (info, days, slots, orders, orders/:token, cancel). Limitatori per IP, campo trappola,
  consenso, tetti.
- Eventi: `takeaway_updated` al personale; l'accettazione manda `order_created` alla cucina come ogni comanda.

## 5. Fuori da questa versione

Pagamento online, scelta delle opzioni dei prodotti dal sito (modificatori), stampa automatica dell'orario sul foglio di
cucina oltre a quella già esistente, consegna a domicilio, email di conferma.
