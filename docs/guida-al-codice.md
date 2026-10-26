# Guida al codice (per chi non è uno sviluppatore)

Questa guida serve a ritrovarti nel progetto e a fare modifiche piccole **senza paura di rompere qualcosa**. Non devi leggerla tutta: cerca la ricetta che ti serve (sezione 4). Le regole di sviluppo vere e proprie stanno in [`CLAUDE.md`](../CLAUDE.md).

## 1. L'app in cinque righe

- **Frontend** (`frontend/`): ciò che si vede nel browser. React + Tailwind (lo stile è scritto nelle classi, es. `text-sm` = testo piccolo).
- **Backend** (`backend/`): il server. Riceve le richieste del frontend, controlla chi sei e cosa puoi fare, parla col database.
- **Database** (PostgreSQL): dove stanno i dati. Ogni locale (tenant) vede **solo i suoi** dati: lo garantisce il database stesso (RLS), non il codice del frontend.
- **Tre tipi di locale:** ristorante (`restaurant`), sagra/street food (`street_food`), solo asporto (`takeaway_shop`). Il ristorante e il solo-asporto usano l'app **SmartEats** (`frontend/src/smarteats/`); la sagra usa la cassa classica (`frontend/src/festival/`).
- **I prezzi li calcola sempre il server.** Il frontend manda solo «quali prodotti e quante unità».

## 2. Dove sta cosa

```
smarteats/
├── scripts/check.sh        ← i controlli: lancialo prima di salvare (vedi sezione 3)
├── docs/                   ← documenti: questa guida, deploy, prenotazioni, asporto, WhatsApp…
├── backend/
│   ├── server.js           ← avvio del server
│   ├── app.js              ← collega tutte le route (gli «indirizzi» /api/…)
│   ├── routes/             ← UN file per argomento: orders.js, checks.js, bookings.js, products.js…
│   ├── schemas/            ← le regole sui dati in ingresso (cosa si può mandare a ogni route)
│   ├── utils/              ← la logica vera: prezzi, stock, pagamenti, prenotazioni, WhatsApp…
│   ├── migrations/         ← le modifiche al database, numerate (001, 002…). Non si modificano mai.
│   ├── tests/              ← i test (unitari e con il database)
│   └── scripts/            ← strumenti: demo (seed-demo.js), backup, avvio dei test nel browser
└── frontend/src/
    ├── smarteats/          ← l'app del ristorante, UNA CARTELLA PER ARGOMENTO:
    │   ├── app/            ← il guscio: menu laterale (SideNav), testata (AppHeader), elenco pagine (views.js)
    │   ├── floor/          ← la Sala e il conto del tavolo  (ui.js = stili comuni, Segmented.jsx = interruttore)
    │   ├── floorplan/      ← disegno e editor della pianta
    │   ├── reservations/   ← prenotazioni: Timeline, Elenco, Mensile, walk-in
    │   ├── takeaway/       ← asporto
    │   ├── kitchen/        ← schermo cucina
    │   ├── catalog/        ← la carta (piatti e opzioni)
    │   ├── settings/       ← Impostazioni (sections.js = elenco delle sezioni)
    │   └── stats/          ← statistiche
    ├── festival/           ← la cassa delle sagre: guscio (FestivalApp), pagine, dati vivi
    ├── components/         ← pezzi condivisi con la cassa della sagra (Modal, PageHeader, prodotti…)
    ├── pages/              ← pagine pubbliche: prenotazione clienti (/book), ordina asporto (/order), master
    ├── utils/apiClient.js  ← l'UNICO modo di parlare col server dal frontend
    └── print/ offline/     ← stampa e funzionamento senza rete
```

**Una regola che aiuta a orientarsi:** dentro una cartella di `smarteats/` i file con la `P` maiuscola (`ReservationsPage.jsx`) sono **schermate/componenti**; quelli in minuscolo (`rules.js`, `timeline.js`, `calendar.js`) sono **logica pura** (calcoli senza grafica) e hanno quasi sempre accanto un file `.test.js` che ne spiega il comportamento con degli esempi: leggi i test per capire cosa fa una funzione.

## 3. Prima di salvare: il controllo

```bash
./scripts/check.sh            # 1-2 minuti: logica, lint, costruzione dell'app
./scripts/check.sh --all    # in più i test col database e quelli nel browser (5 minuti)
```

Se compare un errore rosso, **non salvare**: il messaggio dice quale file e quale riga. Se non lo capisci, copia le ultime righe e chiedi aiuto. Verde = non hai rotto nulla di ciò che è provato.

Per cercare codice che non serve più: `node scripts/find-dead-code.mjs` (elenca, non cancella).

Per vedere l'app con dati realistici: `cd backend && npm run demo:seed` (poi apri `https://demo.smarteats.local:5173`). Per la versione sagra (SmartEats Stand): `npm run demo:festival` (poi `https://sagra.smarteats.local:5173`).

## 4. Ricette: «voglio cambiare…»

### Un testo che vedo nella schermata
Cerca il testo con la ricerca di tutto il progetto (in VS Code: `Cmd+Shift+F`), per esempio `Nuovo piatto`. Il testo sta tra virgolette in un file `.jsx`: cambialo e salva. Se il testo compare in più file, cambia quello giusto guardando il nome del file (es. `catalog/…`). **Non cambiare** i valori tecnici in inglese (`confirmed`, `cashier`…): quelli viaggiano tra server e database.

### Il nome di una voce del menu laterale o l'ordine delle voci
`frontend/src/smarteats/app/views.js`: ogni riga è una pagina (`label` = nome mostrato, `roles` = chi la vede, `module` = serve quel modulo acceso). L'ordine delle righe è l'ordine del menu.

### Un colore o lo stile generale
I colori di tutta l'app sono in `frontend/src/index.css`, in cima (`--accent` è il blu principale, `--bg-card` lo sfondo delle schede; c'è la versione chiara e quella scura). Cambiando lì cambia ovunque. Per gli stili dei pulsanti e dei campi: `frontend/src/smarteats/floor/ui.js`.

### La durata o la capienza di qualcosa (turni, fasce)
Non è nel codice: si cambia dall'app (Impostazioni → Prenotazioni / Asporto). Le soglie fisse del portale clienti (massimo 10 persone, anticipo da 1 ora…) sono in `backend/utils/bookingPortal.js` e `backend/utils/takeaway.js`, in cima al file, con un commento ciascuna.

### Un messaggio di errore o di avviso
- Mostrato dal server (es. «Il conto non è più aperto»): cerca la frase in `backend/utils/` o `backend/routes/`.
- Mostrato dal frontend (toast): cerca la frase in `frontend/src/`.

### Aggiungere una voce alle Impostazioni
Le sezioni sono in `frontend/src/smarteats/settings/sections.js` (nome, chi la vede) e il loro contenuto in `SettingsPage.jsx` (tabella `CONTENT`). Per aggiungerne una: una riga in `sections.js`, un componente nuovo nella cartella giusta, una riga in `CONTENT`.

### Aggiungere un campo a un prodotto (es. «allergeni»)
Sono quattro posti, sempre gli stessi:
1. **Database:** una nuova migrazione `backend/migrations/056_…sql` (il numero è il successivo all'ultimo). Mai modificare una migrazione già esistente. Poi aggiorna `backend/schema.sql` (vedi `CLAUDE.md` §6).
2. **Server:** `backend/schemas/productSchema.js` (il campo è ammesso) e `backend/routes/products.js` (lo salva).
3. **Modulo:** `frontend/src/components/products/productForm.js` (valore iniziale) e `ProductFormModal.jsx` (il campo che si vede).
4. **Test:** una riga in `productForm.test.js`.

### Una nuova pagina in SmartEats
1. Crea la cartella e la pagina in `frontend/src/smarteats/<argomento>/<Nome>Page.jsx`.
2. Aggiungi la voce in `app/views.js` e l'icona in `app/SideNav.jsx`.
3. Aggiungi la `<Route>` in `app/SmartEatsApp.jsx`.
4. Usa gli stessi componenti delle altre pagine (regola di stile in `CLAUDE.md`): `PageHeader`, `Segmented` per le viste, `PanelFrame` per i dettagli.

### Una nuova API (indirizzo del server)
Copia una route simile (es. `backend/routes/courses.js` è la più semplice) e ricorda i tre passaggi che non si saltano: `authenticate` (chi sei) → `validate` (i dati sono giusti) → `tenantScope` (solo i dati del tuo locale). Le query al database usano **sempre** `req.db.query` con `$1, $2` (mai testo incollato dentro la query).

### L'app «SmartEats» per il Dock (come è fatta)
Un'app del Mac non è un file: è una **cartella** con estensione `.app` (tasto destro → «Mostra contenuto pacchetto»). Quella di SmartEats la costruisce `scripts/crea-app.sh`:
- **`Contents/Info.plist`**: la carta d'identità (nome, icona, «resta aperta»).
- **`Contents/Resources/applet.icns`**: l'icona. Parte dal simbolo `frontend/public/pwa-512.png`, ridimensionato in tutte le misure che il Mac vuole (`sips`) e impacchettato (`iconutil`).
- **`Contents/Resources/start.sh`**: prepara l'app (costruisce il frontend se è cambiato), avvia il server, aspetta che risponda e apre il browser.
- **`Contents/Resources/stop.sh`**: ferma il server (si usa con «Esci» dal Dock).
- Il «guscio» è un **applet AppleScript** (`osacompile -s`): un vero programma Mac che resta aperto, per questo l'icona sta ferma nel Dock invece di saltellare. Chiama `start.sh` all'apertura e `stop.sh` all'uscita.
Se cambi la cartella del progetto o la versione di Node, rilancia `./scripts/crea-app.sh`.

## 5. Cose che NON si toccano senza chiedere

- **Migrazioni già esistenti** (`backend/migrations/`): per correggerne una se ne scrive una nuova.
- **Il calcolo dei prezzi** (`backend/utils/pricing.js` e il suo gemello in `frontend/src/utils/pricing.js`): cambiano insieme e hanno un test che li confronta.
- **L'isolamento tra locali** (RLS, `tenantScope`, `req.db`): un errore qui mostrerebbe i dati di un cliente a un altro.
- **Password, token, segreti:** mai nel codice, mai in un commit.

## 6. Come sono scritte le cose (così le ritrovi)

- **Lingua:** testi per le persone, commenti e log in **italiano**; nomi di file, funzioni, tabelle, stati e percorsi in **inglese** (tabella del glossario in `CLAUDE.md`: `reservation`, `check`, `order`, `table`…).
- **Un file, un compito.** Se un file supera le ~300 righe è il segnale che va diviso (vedi come è stato fatto per `components/products/`).
- **Ogni file inizia con un commento** che dice a cosa serve; le funzioni non ovvie hanno un commento sopra che spiega il *perché*, non il *come*.
- **La logica sta fuori dalla grafica:** i calcoli stanno in file `.js` con test, le schermate (`.jsx`) li usano. Così si possono provare senza aprire il browser.

## 7. Quando qualcosa non va

| Sintomo | Dove guardare |
|---|---|
| Schermata bianca | console del browser (tasto destro → Ispeziona → Console): il messaggio rosso dice il file |
| «Server non raggiungibile» | il backend è acceso? (`npm run dev` in `backend/`); log nel terminale |
| Errore 403 «Funzione non attiva» | il modulo è spento per quel locale: si accende dal pannello Master (`/master`) |
| Dati strani in una pagina | apri la pagina `/api/…` corrispondente nel browser da loggato, oppure usa il locale demo |
| Un test fallisce dopo una tua modifica | il test dice cosa si aspettava; di solito la modifica ha cambiato un testo o un comportamento da aggiornare anche nel test |
