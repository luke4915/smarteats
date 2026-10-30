# Guida al codice (per chi non è uno sviluppatore)

Questa guida serve a ritrovarti nel progetto e a fare modifiche piccole **senza paura di rompere qualcosa**. Non devi leggerla tutta: cerca la ricetta che ti serve (sezione 2).

**Dove sta cosa, in una frase ciascuno** (ogni argomento è scritto in un solo posto):
- Cos'è l'app, le regole da non rompere, i comandi, la mappa delle cartelle: [`CLAUDE.md`](../CLAUDE.md) (§1, §2, §3-4).
- Installare e avviare in locale: [`README.md`](../README.md).
- Mettere online, rilasciare, gestire il server: [`docs/rilasci.md`](rilasci.md), [`docs/deployment.md`](deployment.md), [`docs/promemoria-operativo.md`](promemoria-operativo.md).
- Imparare React e JavaScript sul codice vero: [`docs/imparare-il-codice.md`](imparare-il-codice.md).

**Un trucco per orientarsi:** dentro una cartella di `smarteats/` i file con la `P` maiuscola (`ReservationsPage.jsx`) sono **schermate/componenti**; quelli in minuscolo (`rules.js`, `timeline.js`, `calendar.js`) sono **logica pura** (calcoli senza grafica) e hanno quasi sempre accanto un file `.test.js` che ne spiega il comportamento con degli esempi: leggi i test per capire cosa fa una funzione.

## 1. Prima di salvare: il controllo

```bash
./scripts/check.sh            # 1-2 minuti: logica, lint, costruzione dell'app
./scripts/check.sh --all    # in più i test col database e quelli nel browser (5 minuti)
```

Se compare un errore rosso, **non salvare**: il messaggio dice quale file e quale riga. Se non lo capisci, copia le ultime righe e chiedi aiuto. Verde = non hai rotto nulla di ciò che è provato.

Per cercare codice che non serve più: `node scripts/find-dead-code.mjs` (elenca, non cancella). Per vedere l'app con dati realistici: `README.md`, «Sviluppo in locale».

## 2. Ricette: «voglio cambiare…»

### Un testo che vedo nella schermata
Cerca il testo in tutto il progetto (il metodo è in `docs/imparare-il-codice.md`, §1), per esempio `Nuovo piatto`: sta tra virgolette in un file `.jsx`. Cambialo e salva. Se il testo compare in più file, cambia quello giusto guardando il nome del file (es. `catalog/…`). **Non cambiare** i valori tecnici in inglese (`confirmed`, `cashier`…): quelli viaggiano tra server e database.

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
1. **Database:** una nuova migrazione in `backend/migrations/` (numero successivo all'ultimo) e poi `backend/schema.sql`: le regole sono in `CLAUDE.md` §6.
2. **Server:** `backend/schemas/productSchema.js` (il campo è ammesso) e `backend/routes/products.js` (lo salva).
3. **Modulo:** `frontend/src/components/products/productForm.js` (valore iniziale) e `ProductFormModal.jsx` (il campo che si vede).
4. **Test:** una riga in `productForm.test.js`.

### Una nuova pagina in SmartEats
1. Crea la cartella e la pagina in `frontend/src/smarteats/<argomento>/<Nome>Page.jsx`.
2. Aggiungi la voce in `app/views.js` e l'icona in `app/SideNav.jsx`.
3. Aggiungi la `<Route>` in `app/SmartEatsApp.jsx`.
4. Usa gli stessi componenti delle altre pagine (regola di stile in `CLAUDE.md`): `PageHeader`, `Segmented` per le viste, `PanelFrame` per i dettagli.

### Una nuova API (indirizzo del server)
Copia una route simile (`backend/routes/courses.js` è la più semplice) e segui le regole di `CLAUDE.md` §3 (isolamento tra locali), §4 (validazione e permessi) e §5 (forma di un handler).

### L'app «SmartEats» per il Dock (come è fatta)
Un'app del Mac non è un file: è una **cartella** con estensione `.app` (tasto destro → «Mostra contenuto pacchetto»). Quella di SmartEats la costruisce `scripts/crea-app.sh`:
- **`Contents/Info.plist`**: la carta d'identità (nome, icona, «resta aperta»).
- **`Contents/Resources/applet.icns`**: l'icona. Parte dal simbolo `frontend/public/pwa-512.png`, ridimensionato in tutte le misure che il Mac vuole (`sips`) e impacchettato (`iconutil`).
- **`Contents/Resources/start.sh`**: prepara l'app (costruisce il frontend se è cambiato), avvia il server, aspetta che risponda e apre il browser.
- **`Contents/Resources/stop.sh`**: ferma il server (si usa con «Esci» dal Dock).
- Il «guscio» è un **applet AppleScript** (`osacompile -s`): un vero programma Mac che resta aperto, per questo l'icona sta ferma nel Dock invece di saltellare. Chiama `start.sh` all'apertura e `stop.sh` all'uscita.
Se cambi la cartella del progetto o la versione di Node, rilancia `./scripts/crea-app.sh`.

## 3. Quando qualcosa non va

| Sintomo | Dove guardare |
|---|---|
| Schermata bianca | console del browser (tasto destro → Ispeziona → Console): il messaggio rosso dice il file |
| «Server non raggiungibile» | il backend è acceso? (`npm run dev` in `backend/`); log nel terminale |
| Errore 403 «Funzione non attiva» | il modulo è spento per quel locale: si accende dal pannello Master (`/master`) |
| Dati strani in una pagina | apri la pagina `/api/…` corrispondente nel browser da loggato, oppure usa il locale demo |
| Un test fallisce dopo una tua modifica | il test dice cosa si aspettava; di solito la modifica ha cambiato un testo o un comportamento da aggiornare anche nel test |
