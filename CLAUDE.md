# CLAUDE.md — SmartEats

Guida operativa per lavorare su questo repository. Leggila tutta prima di toccare il codice.
Le regole marcate **MUST** non si negoziano; il resto è la prassi del progetto.

## 1. Cos'è il progetto

SaaS multi-tenant per la gestione di sagre ed eventi: cassa (POS), ordini, stampa comande su stampanti termiche, Kitchen Display System, magazzino, statistiche, menu pubblico con QR.
Il prodotto si chiama **SmartEats** e ha due app sulla stessa API: **SmartEats Stand** (sagre, paninari, food truck: tipo `street_food`) e **SmartEats Restaurant** (ristoranti, pizzerie e solo asporto: tipi `restaurant` e `takeaway_shop`). Nei testi che legge una persona si scrive sempre così; mai «Stand Manager». Installazione e avvio sono descritti nel `README.md`.

Lingua: **UI, messaggi di errore, log e commenti in italiano.** Tutto il resto in inglese, vedi «Nomenclatura» qui sotto.

### Nomenclatura — **MUST** per tutto il codice nuovo

Il prodotto è pensato per un mercato internazionale: i nomi *tecnici* sono in inglese e prendono il **vocabolario del settore** (ristorazione e punti cassa), non traduzioni letterali.

- **In inglese:** percorsi delle API e delle pagine (`/book`, `/reservations`, `/floor`), nomi di file, cartelle, componenti, funzioni, tabelle, colonne, **valori salvati o scambiati** (stati, ruoli, tipi), chiavi delle impostazioni, eventi WebSocket, codici d'errore (`NO_CAPACITY`), nomi dei test e dei file di test.
- **In italiano:** solo ciò che legge una persona: testi dell'interfaccia, messaggi d'errore, log, commenti, documenti.
- **Un solo termine per concetto**, sempre lo stesso in tutto lo stack (DB → API → UI → test). Prima di inventare un nome, controlla il glossario.

| Italiano | Nel codice | Note |
|---|---|---|
| prenotazione | `reservation` | l'atto di prenotare e il modulo si chiamano `booking`; la riga è una `reservation` |
| richiesta (dal cliente) | `request` | stato `requested` finché il personale non conferma |
| turno di prenotazione | `shift` | fascia fissa con ora, durata e capienza (`booking_shifts`) |
| servizio / serata | `service` (nel DB `session`) | l'apertura della giornata di lavoro |
| coperti (persone) | `covers` (`party_size` per una prenotazione) | |
| posti | `seats` | |
| tavolo / sala / pianta | `table` (`dining_table`) / `room` / `floor plan` | «Sala» come vista di lavoro = `floor` |
| conto | `check` | l'insieme delle comande di un tavolo |
| comanda | `order` (a tavola: `order ticket` nei testi) | |
| portata / uscita | `course` / `fire` (mandare in cucina) | |
| coperto (addebito) | `cover charge` | |
| cucina / bar | `kitchen` / `bar` | postazioni (`station`) |
| cassa | `POS` / `register` (ruolo `cashier`) | |
| cameriere / responsabile | `waiter` / `manager` | |
| non si è presentato | `no_show` | |
| lista d'attesa | `waitlist` | |
| asporto | `takeaway` | |
| codice di ritiro / tempo di preparazione | `pickup_code` / `prep_minutes` | il codice a tre cifre dato al cliente all'accettazione; i minuti di lavoro di un pezzo (`work_minutes` per un ordine) |
| omaggio / sconto | `comp` o `gift` / `discount` | nel codice esistente: `gift` |
| scontrino / ricevuta | `receipt` | |
| incasso | `revenue` (`sales` per i totali di cassa) | |
| menu / carta | `menu` per il pubblico, `catalog` per la gestione dei prodotti | |
| sagra | `festival` | evento temporaneo con cassa e cucina |
| magazzino, scorte | `inventory` | disegno in `docs/design-magazzino.md` (stesso glossario) |
| ingrediente / ricetta / preparazione | `ingredient` / `recipe` / `preparation` | |
| fornitore, scarico di merce | `supplier`, `goods_receipt` | «scarico» = la merce che arriva dal fornitore (scheda «Scarichi» del Magazzino); la bolla è il file (`delivery_note`). Il consumo degli ingredienti si chiama «consumo» (`usage`) |
| porzioni, scarto, controllo di magazzino | `portions`, `waste`, `stock_level` | il controllo è il conteggio fisico della dispensa |

**Valori salvati:** ruoli `admin`, `manager`, `cashier`, `waiter`, `kitchen`; tipi di locale `street_food` (sagre, paninari, food truck: un solo tipo) e `restaurant` (migrazione 048). Dati e percorsi nuovi seguono lo stesso criterio.


## 2. Stack e struttura

```
backend/            Node.js (ESM) + Express 5 + pg + ws (WSS) + pino + zod
  server.js         avvio: certificati HTTPS, server, WebSocket
  app.js            createApp(): helmet, CORS, rate limit, route (usata da server.js e dai test)
  ws.js             createWebSocketHub(): WebSocket isolato per tenant, broadcast(tenantId, msg), attach(server)
  db.js             Pool PostgreSQL condiviso
  middleware/       authenticate, tenantScope, resolveTenantFromHost, validate, rateLimiter, authenticateMaster
  routes/           una route per dominio (orders, products, sessions, printSettings, master, …)
  schemas/          schemi zod per body e parametri (common.js: messaggi in italiano, idParamsSchema)
  utils/            pricing (fonte di verità server), stock, displayCode, httpError, auditLogger, modules/tenantModules (moduli per tenant), tenantUsers, sessionToken
  tests/            test unitari node:test (*.test.js) sulla logica pura
  tests/integration/  test di integrazione: app in memoria + PostgreSQL locale con RLS
  migrations/       NNN_descrizione.sql + run.js (tabella _migrations)
frontend/           React 19 + Vite 7 + Tailwind v4 + react-router-dom 7 + PWA (vite-plugin-pwa) + Dexie
  src/App.jsx       punto d'ingresso per ciò che non è SmartEats: pagine pubbliche, accesso, cambio password; poi `festival/FestivalApp.jsx`
  src/festival/     la cassa delle sagre e dei paninari: FestivalApp (guscio), useFestivalData (dati vivi), FestivalRoutes, SetupPage, SyncStatus (rete e stampa), views/icons
  src/components/shell/  guscio comune a SmartEats e sagre: SideNav (da tablet), TabBar (telefono: barra come quella di iOS, oltre cinque voci le ultime vanno sotto «Altro»), AppHeader (titolo, servizio, notifiche, AccountMenu con aspetto Auto/Chiaro/Scuro e uscita), PageCard (la scheda di una pagina: sul telefono niente riquadro), ServiceControl (apre e chiude il servizio o la serata, parole da `utils/terms.js`)
  src/hooks/        useCart, useProducts, useWorkSession (serata), useSound, useLiveUpdates (WebSocket), useBreakpoint
  src/pages/        pagine pubbliche/di livello alto (Login, Menu, KDS, Master)
  src/components/   per dominio: cart/, kitchen/, products/, setup/, shared/, layout/
  src/smarteats/    app dei ristoranti e delle pizzerie, **una cartella per modulo**: app/ (guscio: SmartEatsApp, AppHeader, SideNav, ServiceControl, useService, views.js),
                    floor/ (la Sala: pannello unico a destra come la cassa — SidePanel, CheckView, PayView, AdjustView, DraftOrder; niente modali; anteprime in checkMath.js, lo stesso calcolo del server),
                    floorplan/ (pianta: editor e disegno), kitchen/ (monitor di cucina), reservations/ (agenda e impostazioni delle prenotazioni), notifications/ (campanella, suono),
                    stats/, catalog/ (carta e opzioni), settings/ (coperto, portate); le pagine pubbliche dei clienti stanno in pages/ (BookingPage su `/book`).
                    Una pagina o un componente nuovo va nella cartella del suo modulo, non in app/; app/ non contiene logica di dominio.
  src/context/      AuthProvider + useAuth (login, refresh), ToastProvider + useToast
  src/config/api.js API_URL / WS_URL derivati dal sottodominio corrente
  src/offline/      db Dexie, coda ordini offline, hook useOfflineSync, catalogo offline, ultimi valori noti, dispositivo e numerazione (device.js)
  src/print/        stampa dal dispositivo: builder ePOS, template, driver, coda, configurazione locale
  src/utils/apiClient.js  client unico per le API: apiFetch, fetchWithAuth, ApiError, NetworkError
  src/utils/sendOrder.js  invio ordine dalla cassa: numero, server o coda offline, stampa
  src/utils/pricing.js  specchio 1:1 di backend/utils/pricing.js
```

Ogni parte ha il suo `package.json` (`backend/`, `frontend/`): nella radice non ci sono dipendenze.

Comandi:

| Dove | Comando | Cosa fa |
|---|---|---|
| backend | `npm run dev` | nodemon su server.js (HTTPS, porta 3000) |
| backend | `npm run migrate` | applica le migrazioni mancanti |
| backend | `npm run db:baseline` | solo su un database appena creato da `schema.sql`: registra le migrazioni come già applicate |
| backend | `npm test` | test unitari (`node --test`) |
| backend | `npm run test:integration` | test di integrazione (serve `backend/.env.test`, vedi `.env.test.example`) |
| frontend | `npm run dev` | Vite su https://*.smarteats.local:5173 |
| backend | `scripts/backup.sh` | dump del database con rotazione (vedi `docs/deployment.md`) |
| backend | `npm run demo:seed` | crea il locale di dimostrazione `demo` (ristorante completo: sala, portate, carta, magazzino con fornitori, carichi e ricette, prenotazioni, asporto, serate passate e servizio in corso); `npm run demo:reset` lo ricrea. Solo su dominio `.local`. Utenti `demo`, `marta`, `luca`, `giulia`, `paolo`, `chef`, password `smarteats-demo` |
| backend | `npm run demo:festival` | crea il locale di dimostrazione `sagra` («Sagra del Borgo», SmartEats Stand: carta di 29 prodotti con porzioni, tre serate passate con sconti, omaggi e storni, la serata di oggi con ordini in coda e in preparazione); `npm run demo:festival-reset` lo ricrea. Solo su dominio `.local`. Utenti `sagra` (admin), `cassa1`, `cassa2`, `cucina`, password `smarteats-demo` |
| backend | `npm run db:prepare` | database vuoto: crea ruoli e schema (`scripts/init-db.js`, no-op se già pronto), poi migra; lo usa il container |
| radice | `./scripts/avvia.command` | avvia l'app come un programma (doppio clic dal Finder): costruisce il frontend se serve, parte in modalità produzione e apre il browser sul locale `demo` (o quello indicato: `./scripts/avvia.command altrolocale`). Serve PostgreSQL acceso |
| radice | `./scripts/crea-app.sh` | crea l'app Mac «SmartEats» in `~/Applications` (icona da trascinare nel Dock): avvia il server in silenzio, apre il browser e con «Esci» dal Dock ferma tutto; log in `~/Library/Logs/SmartEats.log`. Si rilancia se si sposta il progetto o cambia Node |
| radice | `./scripts/check.sh` | controlli **mirati**: sempre logica, lint e build; i test col database e nel browser solo se toccano ciò che hai cambiato (`scripts/select-tests.mjs`). `--quick`: solo logica, lint e build. **`--all`: il ciclo completo**, da lanciare alla fine del lavoro. `CHECK_BASE=HEAD` limita la scelta a ciò che è cambiato dall'ultimo salvataggio |
| radice | `node scripts/find-dead-code.mjs` | elenca file e export che nessuno usa |
| frontend | `npm run lint` | ESLint — deve passare prima di ogni commit |
| frontend | `npm test` | test (`node --test`) del motore di stampa in `src/print/`, anche contro la stampante simulata |
| frontend | `npm run mock:epos` | stampante Epson simulata su https://localhost:9443: disegna le copie nel terminale e può rifiutare i lavori (`-- --fail EPTR_COVER_OPEN`) |
| frontend | `npm run build` | build di produzione |
| frontend | `npm run e2e` | test nel browser (Playwright): costruisce il frontend, avvia `backend/scripts/e2e-server.js` (HTTPS autogenerato, locali di prova nel database di test) e fa il giro del ristorante e della sagra, anche da telefono; screenshot in `frontend/e2e/.run/schermate`. Prima volta: `npx playwright install chromium` |

Produzione: immagine Docker (`Dockerfile`), stack in `deploy/` (Traefik + app + Postgres + backup, `TLS_TERMINATED_BY_PROXY=true`), rilascio con tag `v*` (workflow `release.yml`, che controlla che l'etichetta coincida con `frontend/package.json`); installazione in `docs/deployment.md`, processo di rilascio in `docs/rilasci.md`. **Changelog, un'abitudine per ogni modifica:** ogni PR che cambia qualcosa per chi usa il locale aggiunge **una riga sintetica e professionale** (italiano, senza dettagli tecnici, che dica cosa cambia per l'utente) alla voce della prossima versione in `frontend/src/changelog.js`. La prima PR dopo un rilascio alza `version` in `frontend/package.json` (e nel lock) e apre la voce nuova; `changelog.test.js` verifica che coincidano. Le novità riservate al master (console `/master`) e le modifiche interne non vanno nel changelog: stanno nel titolo e nella descrizione della PR.

Il dominio di sviluppo è `smarteats.local` . Lo sviluppo locale usa certificati mkcert per `*.smarteats.local` e un sottodominio per tenant (es. `default.smarteats.local`). Gli script in `backend/scripts/*.ps1` configurano host e wildcard su Windows.

## 3. Multi-tenancy e RLS — regole **MUST**

L'isolamento tra tenant si basa sulla Row-Level Security di PostgreSQL con la variabile di sessione `app.tenant_id`. Un errore qui significa dati di un cliente visibili a un altro.

1. **Route autenticate:** la catena è sempre `authenticate → (authorizeAdmin | authorizeDiscount)? → tenantScope`, e le query usano **solo `req.db.query(...)`**.
2. **Mai `pool.query` su tabelle tenant-scoped.** `pool.query` è ammesso solo su tabelle globali (`tenants`, `_migrations`) e nei punti già previsti (login, master panel). Il master panel usa **`masterPool`** (ruolo `smarteats_master`, migrazione 025): è l'unico che scrive su `tenants` o li elimina; l'utente applicativo di `pool` ha solo SELECT su `tenants` e non cancella da `audit_logs`. Non usare `masterPool` fuori da `routes/master.js`, salvo la pulizia periodica dei registri di audit (`utils/auditRetention.js`, 60 giorni di partenza, `AUDIT_RETENTION_DAYS`): l'app non può cancellare `audit_logs`, solo quella pulizia sì.
3. **Lavoro asincrono dopo la risposta** (job in background): usa `withTenantClient(tenantId, fn)`. `req.db` a quel punto è già stato rilasciato.
4. **Endpoint pubblici** (`/menu`, `/kds`): `resolveTenantFromHost` + `withTenantClient(req.tenantId, …)`. Non esporre mai colonne interne: seleziona le colonne una per una, niente `SELECT *`.
5. **Nuova tabella tenant-scoped:** nella stessa migrazione aggiungi `tenant_id INTEGER NOT NULL REFERENCES tenants(id)`, l'indice, `ENABLE` + `FORCE ROW LEVEL SECURITY` e la policy `tenant_isolation`. La policy deve usare `NULLIF(current_setting('app.tenant_id', true), '')::int` (vedi migrazione 009: senza `NULLIF` una connessione riciclata con `''` manda in errore il cast).
6. **Non affidarti al client per `tenant_id`:** arriva dal JWT (`req.user.tenantId`) o dal sottodominio, mai dal body.
7. **Login e master panel** hanno percorsi dedicati. Il login risolve il tenant dal sottodominio (`resolveTenantFromHost`) e cerca l'utente **solo in quel tenant** con `withTenantClient`: l'username è unico per tenant (`uniq_users_tenant_username`) e `users` non ha deroghe alla RLS. Il master usa `authenticateMaster`. Non riusare questi percorsi altrove.

## 4. Sicurezza e logica di business

- **Il server ricalcola sempre i prezzi.** Dal client sono affidabili solo `id` e `quantity` di ogni riga. Usa `computeLineTotal` e `sanitizeAdjustment` in `utils/pricing.js`: il totale di riga è in centesimi interi, lo sconto in euro è sull'intera riga, e l'ordine salva `line_total` (riferimento) accanto a `price` (unitario, solo per mostrare). Sconti e omaggi solo per `DISCOUNT_ROLES`.
- Se cambi la logica di prezzo, aggiorna **entrambi** i file `pricing.js` (backend e frontend) nello stesso commit: `tests/pricing.test.js` verifica che diano gli stessi importi.
- **Ogni input si valida con zod** (schemi in `backend/schemas/`) tramite il middleware `validate({ body, params })`, messo prima di `tenantScope`. In caso di errore risponde 400 con `campo: motivo` in italiano; altrimenti `req.body` contiene solo i campi dello schema, già convertiti, e `req.params` i valori convertiti. Niente validazioni scritte a mano negli handler.
- Le operazioni con più scritture (ordine + stock, storno + ripristino stock) vanno in transazione con `inTransaction(req.db, async (db) => { … })` da `db.js`. Per uscire con un errore di business (404, 409) lancia `new HttpError(status, messaggio, CODICE)` e nel `catch` della route usa `sendHttpError(res, err)`.
- Ordini e sessioni: ogni ordine appartiene a una sessione (`orders.session_id`) e senza sessione aperta non si creano ordini (`409 NO_ACTIVE_SESSION`). Esiste al massimo una sessione aperta per tenant. **Numerazione unica** (migrazione 057, `utils/orderNumber.js`, un solo punto per tutti i tipi di locale): ogni ordine ha un `orders.number` dentro la sua serata. Viene da una **cassa** (stand: lettera del dispositivo + il suo progressivo, battuto e stampato dal client anche offline, quindi `display_code` = «A13» e `number` = 13; il server lo ricostruisce da `device_id` e `device_seq`, mai dal testo del client; `uniq_orders_device_seq` e `uniq_orders_session_source_number` impediscono i duplicati) oppure dal **server** (sala, asporto, ordini senza cassa: `sessions.order_counter` sotto lock, `display_code` = «23»). Non si riparte più da A1 dopo 100: la cassa non ha tetto. Come lo si scrive lo decide la fonte; il database ha sempre il numero. Le righe del coperto (`COP`) non hanno numero. Chi numera un ordine nuovo usa `orderNumber` / `nextServerNumber`, mai un incremento fatto a mano. Report e cassa filtrano per `session_id`, mai per orario.
- Dispositivi (`devices`, `routes/devices.js`): ogni cassa si abbina una volta e riceve una lettera (max 26 per tenant, assegnata sotto lock di transazione). Un dispositivo con ordini non si elimina. Una nuova tabella tenant-scoped va aggiunta anche a `TENANT_SCOPED_TABLES` in `routes/master.js` (eliminazione tenant), nell'ordine delle chiavi esterne.
- Elenco e statistiche: `GET /orders` non restituisce mai lo storico intero (o `session=active`, o pagine con `limit`/`before`). Le statistiche le aggrega il database (`routes/stats.js`, composizione in `utils/stats.js`): non portare gli ordini nel browser per sommarli. I prodotti si raggruppano per id, non per nome.
- Chiusura serata: se ci sono ordini in attesa o in preparazione `POST /sessions/end` richiede `openOrders` (`complete` li completa, `leave` li lascia fuori dai conti).
- Stock: conta solo con `stock_enabled = true` e `stock` valorizzato, altrimenti la disponibilità è illimitata. Si modifica solo con `utils/stock.js`, che somma le righe dello stesso prodotto e blocca i prodotti con `FOR UPDATE`. All'apertura di una sessione le porzioni ripartono secondo la regola di ogni prodotto (`products.portions_reset_rule`: `restart_each_service` torna a `portions_start`, `carry_over` continua, `unlimited` torna illimitato, la regola di prima), in `utils/inventory/portions.js` e `portionsDb.js`; senza il modulo magazzino valgono sempre le regole di prima.
- Le azioni sensibili (creazione ordine, storno, ristampa, modifiche admin) si registrano con `logAudit(req.db, req.user.id, 'AZIONE', dettagli)`: usa la connessione del tenant, quindi i log sono isolati dalla RLS. Chiamala fuori da transazioni aperte.
- Token: HS256 fissato (`utils/jwtConfig.js`), cookie `SameSite=Lax`. `authenticate` controlla a ogni richiesta (cache 15 s, `utils/userStatus.js`) che l'utente esista ancora e usa il suo ruolo attuale, non quello del token: 401 `USER_REVOKED` altrimenti. All'avvio `JWT_SECRET` e `MASTER_JWT_SECRET` devono esserci, essere diversi e lunghi almeno 32 caratteri (in produzione l'app non parte se deboli).
- **Licenza e rete assente** (`utils/license.js`, `offline/licenseLock.js`, `hooks/useLicenseLock.js`): online la licenza la controlla il server a ogni richiesta (402 `LICENSE_EXPIRED`). Offline la cassa lavora fino a **10 ore dopo la scadenza** (`OFFLINE_GRACE_HOURS`), poi si blocca (`LicenseLockScreen`); il server dà scadenza e ora a login, `/auth/me` e `/auth/refresh` (`license`) e il client conserva l'istante più avanzato visto, così riportare indietro l'orologio non sblocca. A licenza scaduta il server accetta **solo** `POST /orders` di un ordine battuto offline (sessione, chiave e `client_created_at` dichiarati) con ora entro scadenza + 10 ore e non nel futuro (`tenantScope` imposta `req.licenseExpiredAt`, la route controlla; resta traccia nell'audit `LATE_SYNC_AFTER_EXPIRY`); tutto il resto è 402.
- Sessione: il token JWT dura 8 ore. `/auth/refresh` lo rinnova solo se è scaduto da meno di 24 ore e se il login (`loginAt` nel token) risale a meno di 7 giorni; oltre serve un nuovo login (`SESSION_EXPIRED`). Il refresh verifica anche tenant attivo e licenza.
- Impostazioni per tenant (`settings`): le chiavi ammesse sono in `schemas/settingsSchema.js`. Solo quelle in `PUBLIC_SETTINGS_KEYS` escono dall'endpoint pubblico `GET /settings`. L'admin del tenant scrive solo quelle in `TENANT_WRITABLE_SETTINGS_KEYS`; le `receipt_*` (scontrini) le scrive solo il master.
- Sala, tavoli, conti e portate (modulo `tables`; dettaglio in `docs/regole-moduli.md`, «Sala, tavoli e conti»). Tabelle `rooms` e `dining_tables` (mai `tables`), tenant-scoped con RLS e in `TENANT_SCOPED_TABLES`; si leggono col personale di sala, si modificano solo da admin con audit. `seats` è il massimo che il server controlla (`NOT_ENOUGH_SEATS`); la pianta si salva intera con `PUT /rooms/:id/layout` e la geometria la verifica il server. **Il totale di un conto lo calcola sempre il server** (importi in centesimi interi, il client non manda importi); un solo conto aperto per tavolo (`TABLE_BUSY`); ogni operazione sul conto blocca **prima il conto (`lockCheck`) e poi le comande, mai al contrario**; un conto aperto blocca `POST /sessions/end` (`OPEN_CHECKS`). Una comanda per portata, tutte nella stessa transazione; le portate `scheduled` contano nel conto ma non vanno in cucina. **Lo stato di una comanda si ricava dalle righe** (`utils/lineStatus.js`): per i ristoranti non si scrive `orders.status` a mano. Righe sempre verificate con `verifyOrderItems`. Modificatori: dal client arrivano solo gli id; il server salva una copia in `order_items.modifiers`.
- Interfaccia (dettaglio in `docs/stile-interfaccia.md`, **da leggere prima di creare o cambiare una schermata**): un solo linguaggio visivo per SmartEats Restaurant e Stand, mai un'«isola» con regole diverse. **Un componente condiviso non si duplica** (`ProductPicker`, `CompactCatalog`, `Segmented`, `ActionMenu`, `Switch`, `SectionsPage`, `PageHeader`, `SearchField`). Importi e durate solo con `utils/format.js` (mai `toFixed(2)`). Finestre solo con `Modal` e pulsanti con `ModalActions`; il dettaglio di un elemento si apre nel pannello a destra (`PanelFrame`). Viste e filtri sempre con `Segmented`; stili da `floor/ui.js`: sobrio, un solo colore d'accento, niente maiuscolo spaziato né `font-black`. Meno elementi per schermata (il servizio in corso si vede e si chiude in un solo punto). Uno stesso colore di stato ovunque (`tone`).
- Prenotazioni e portale pubblico (modulo `bookings`, solo ristorante; dettaglio in `docs/regole-moduli.md`, «Prenotazioni»). Le regole sono pure in `utils/bookings.js`: **una richiesta in attesa tiene il posto** e decade dopo 24 ore; due prenotazioni attive non condividono un tavolo se i turni si sovrappongono; un turno è prenotabile solo se attivo, nel giorno giusto e senza chiusure. Il portale `/api/public/booking` non ha login: il cliente manda solo data, turno, persone e dati, il server ricalcola tutto (`assertBookable`) e crea una **richiesta che il personale conferma sempre**. Le risposte pubbliche non contengono mai numeri di posti, id o dati di altri clienti (colonne scelte una per una, con test). Il cliente *ritira* una richiesta non confermata ma per una confermata *chiede* l'annullo, che il locale decide. Le soglie fisse stanno in `utils/bookingPortal.js`, non sono impostazioni. Un conto che si chiude aggiorna la prenotazione nella stessa transazione (`utils/reservationCheck.js`).
- Asporto (modulo `takeaway`, tutti i tipi di locale; dettaglio in `docs/regole-moduli.md`, «Asporto e pagamenti online»). Prima dell'approvazione l'ordine vive in `takeaway_orders` (righe in `items`, mai in `orders`: non scala stock né va in cucina); `accept` crea l'ordine di cucina sulla sessione aperta. La capienza di una fascia è in **minuti di lavoro** calcolati dal server (`prep_minutes` × quantità): il cliente non vede mai i minuti. Il **codice di ritiro** (tre cifre) nasce all'accettazione (`assignPickupCode`); il KDS pubblico non lo riceve. Lo stato «pronto» non si memorizza: deriva dall'ordine di cucina `completed`; l'incasso passa da `isRevenue`. **Pagamento online con carta** (modulo `payments`, Stripe Connect, `docs/design-pagamenti.md`): la carta non passa mai da noi (Checkout); autorizzazione alla richiesta, incasso all'accettazione, rilascio se rifiuta, annulla o scade (`utils/takeawayPayments.js`); webhook `POST /api/webhooks/stripe` solo con firma valida; `tenants.stripe_account_id` lo scrive solo il master; l'importo lo decide sempre il server.
- Avvisi WhatsApp (modulo `whatsapp`; dettaglio in `docs/regole-moduli.md`, «Avvisi WhatsApp»). I messaggi si scrivono **solo con `enqueue(db, refType, refId, event)`**, meglio nella stessa transazione del cambio di stato: non invia e non lancia mai per colpa di WhatsApp; l'invio è di `deliverDue` (lavoro in background) che ricostruisce i valori dallo stato attuale. Un evento è unico per pratica (mai doppi invii). Eventi, tetto mensile e messaggi di prova si configurano **solo dal Master**; credenziali solo in variabili d'ambiente (mai nel database); i modelli sono versionati (`se_<evento>_v1`). Il webhook `/api/webhooks/whatsapp` non ha login né tenant: vale solo la firma sul corpo grezzo. **`whatsapp_message_tenants` e `whatsapp_optouts` sono le uniche tabelle con `tenant_id` fuori da RLS e non vanno estese.**
- Magazzino (modulo `inventory`, tutti i tipi di locale; disegno in `docs/design-magazzino.md`, dettaglio in `docs/regole-moduli.md`, «Magazzino»). Funzione a pagamento: **modalità (`portions` | `warehouse`) e scarico (`recipes` | `simple`) li sceglie solo il master**. **Ogni vendita e ogni storno passano da `utils/inventory/orderStock.js`**, mai direttamente sugli ingredienti; ogni variazione è un movimento in `ingredient_movements` che **non si corregge né si cancella** dall'app. Costi in centesimi senza IVA; l'incasso passa sempre da `isRevenue`. Scarichi, rettifiche e controlli solo per admin e responsabile (`authorizeManager`). La disponibilità in cassa e in sala è solo un avviso: **decide sempre il server** (409 `INGREDIENT_SHORTAGE`, `force_stock` solo per admin e responsabile). Un piatto esaurito resta in carta in grigio. Le ricette stanno nella Carta, i costi e i margini in Statistiche → Magazzino.
- Dati riservati (`utils/reservedData.js`, `routes/reservedData.js`; dettaglio in `docs/regole-moduli.md`, «Dati riservati»): l'admin può bloccare costi, margini, prezzi dei fornitori e statistiche di incasso, e **il blocco vale sul server, mai solo a schermo**. Accendere è immediato, **spegnere vuole la password dell'amministratore che lo chiede**; lo sblocco dura 10 minuti, solo per la sessione di chi lo chiede. Un endpoint con costi o incassi prende dopo `tenantScope` `requireUnlocked` (risposta tutta riservata) o `maskReserved` (risposta mista); **un campo nuovo con un costo si aggiunge a `RESERVED_KEYS`**. Un importo `null` non si scrive mai come zero.
- Feedback sull'app (`routes/feedback.js`, tabella `app_feedback` con RLS, migrazione 051): admin e responsabile lasciano un suggerimento per modulo da Impostazioni → Suggerimenti («Dicci cosa migliorare»); il master li legge in `GET /master/feedback` (policy `master_read`) e li segna letti.
- Statistiche del ristorante (`GET /stats/restaurant`; dettaglio in `docs/regole-moduli.md`, «Statistiche del ristorante»): solo admin e responsabile; contano i conti **pagati** (`isRevenue`), aggregati dal database; i prodotti si raggruppano per id, mai per nome; il filtro è per servizio (`sessions`). Un grafico nuovo: una serie nel colore d'accento, barre sottili, tooltip e vista a tabella.
- Incasso: cosa conta come incasso è definito **solo** in `utils/revenue.js` (`isRevenue()`); statistiche, incasso atteso e CSV lo usano, e `tests/revenue.test.js` vieta di riscrivere `status = 'completed'` in altre query. Un ordine senza conto conta se `completed`; uno con conto conta se non annullato e il conto è `paid`. I contanti attesi (`expectedCashSql`) sono gli ordini pagati subito più i pagamenti `cash` dei conti, anche parziali (`docs/design-tavoli.md`).
- Righe d'ordine: stanno **solo** in `order_items` (migrazioni 027-030; `orders.items` non esiste più). Sono parte dell'ordine: `writeOrderItems` (`utils/orderItemsWrite.js`) le scrive nella transazione di creazione, e se fallisce l'ordine non nasce. `utils/orderItems.js` mappa una riga verificata dal server in una riga di tabella; `utils/orderItemsRead.js` (`withItems`, `loadItems`) le rilegge nella forma che l'API ha sempre avuto (`id`, `name`, `quantity`, `price`, `line_total`, `type`, `discountMode`…). Le statistiche usano `utils/statsSql.js`. `product_id` è `bigint` e i prezzi `numeric`: `pg` li restituisce come stringhe, vanno convertiti (`Number`). Nessuna chiave esterna su `product_id`: un prodotto eliminato non deve toccare lo storico. Lo stato per riga e la portata arrivano con i tavoli (Fase 3 di `docs/requirements.md`).
- Moduli per tenant (`utils/modules.js`, `utils/tenantModules.js`, migrazione 026): ogni tenant ha `business_type` (`street_food` per sagre, paninari e food truck; `restaurant`; `takeaway_shop` per chi fa **solo asporto**: pizzeria da taglio, forno, rosticceria — usa SmartEats con asporto, cucina, carta, statistiche e impostazioni, senza sala né prenotazioni; migrazione 052) e `modules` (oggi `kds`, `stats`, `qr_menu`, `tables`, `bookings`, `takeaway`, `whatsapp`, `payments`, `inventory`). **Il tipo è fisso dopo la creazione e i tipi non si mescolano**: ogni modulo dichiara in `utils/modules.js` per quali tipi esiste (`firstModuleNotAllowed`; i tavoli solo al ristorante, il menu QR allo street food) e il master (creazione e `PUT /master/tenants/:id/modules`, che accetta solo `modules`) riceve 400 se ne accende uno non ammesso. Il tipo propone anche i moduli di partenza. Il nucleo (login, utenti, prodotti, ordini, sessioni, stampa, impostazioni) non è un modulo e c'è sempre. Una funzione opzionale si protegge **sul server** con `requireModule('id')` (dopo `authenticate` o `resolveTenantFromHost`; risponde 403 `MODULE_DISABLED`) e nel client con `canView` (`viewRoles.js`); il KDS pubblico via WebSocket è rifiutato se il modulo è spento. Login e `/auth/me` restituiscono `modules` e `businessType`. Solo il master li cambia (`PUT /master/tenants/:id/modules`, catalogo in `GET /master/catalog`). Un modulo nuovo si aggiunge in `utils/modules.js` e non richiede una migrazione. Il piano di sviluppo di SmartEats e della piattaforma sta in `docs/requirements.md`. Le parole che cambiano col tipo di locale (serata/servizio) sono in `frontend/src/utils/terms.js`.
- Utenti di un tenant (`utils/tenantUsers.js`, condiviso da `routes/auth.js` e `routes/master.js`): elenco, cambio ruolo/username, eliminazione e reset password. Non si elimina né si declassa l'ultimo admin (409 `LAST_ADMIN`) e un admin non elimina né declassa se stesso. Il master li gestisce con `withTenantClient(id, fn, masterPool)`: la policy `master_read` (025) lascia leggere gli utenti di tutti i tenant, quindi **ogni query su `users` filtra anche per `tenant_id` corrente** (`IN_TENANT`), mai solo per `id`. Le azioni del master si registrano nell'audit del tenant con `user_id` nullo (`MASTER_*`).
- Ruoli esistenti (`ROLES` in `authenticate.js`): `admin`, `manager`, `cashier`, `waiter` (042), `kitchen`. Gruppi: `WAITER_ROLES` (CASH_ROLES + cameriere: in sala apre i tavoli, ordina per portate, manda, serve, chiede il conto, stampa il pre-conto, cambia coperti e sposta il conto; **non** incassa, chiude, unisce, sconta o elimina conti, né tocca stock, carta e impostazioni; storna **solo le comande dei tavoli** (403 `WAITER_CANNOT_CANCEL` per un ordine pagato subito)), `CASH_ROLES` (admin, responsabile, cassa: creano, stornano e ristampano ordini, gestiscono lo stock), `DISCOUNT_ROLES` (sconti e omaggi). La cucina vede gli ordini e ne fa avanzare lo stato, nient'altro. Le autorizzazioni si controllano lato server (`authorizeCash`, `authorizeAdmin`, …), non solo nascondendo la UI.
- Profilo (`routes/profile.js`): il cambio username riemette il token (`utils/sessionToken.js`) e si registra nell'audit. Un reset password vale subito anche per chi è già collegato: `authenticate` prende `must_change_password` dal database (`userStatus`), mai dal token, e mette `loginAt` in `req.user` e risponde 403 `PASSWORD_CHANGE_REQUIRED`; il client passa alla schermata di cambio password. Chi cambia o reimposta una password invalida la cache di `userStatus`.
- Password: nessun utente esiste senza password. Master e admin ne impostano una **temporanea** alla creazione (`must_change_password`): finché non è cambiata il server risponde 403 `PASSWORD_CHANGE_REQUIRED` a tutto tranne `/auth/me`, `/auth/change-password` e logout. `POST /auth/admin/users/:id/reset-password` la reimposta. Il login non distingue utente inesistente, senza password o password errata.
- Mai segreti nel codice o nei commit. Nuove variabili d'ambiente vanno aggiunte a `.env.example` con un valore fittizio.
- Password: minimo 8 caratteri, bcrypt costo 12 (`utils/password.js`). Il login è limitato per coppia IP + username.
- Dal client una riga d'ordine vale solo per `id` e `quantity`: nome, categoria, destinazione di stampa e prezzo si leggono dal catalogo. Un ordine in ritardo (`session_id`) richiede `client_order_id`. Lo stesso vale per il QR del menu (`frontend/src/utils/qrCart.js`).
- Operatività: `GET /api/health` e `/api/health/ready`; una riga di log per richiesta (`middleware/requestLogger.js`, mai cookie né body); backup con `backend/scripts/backup.sh`. Rilascio e lista pre-produzione in `docs/deployment.md`.
- Stampa nel ristorante (`components/shell/PrintStatus.jsx`, `smarteats/settings/PrintersSettings.jsx`): `usePrintQueue` (configurazione e coda) deve essere montato in **ogni** guscio che stampa, altrimenti non parte nulla; lo monta `PrintStatus` in testata (stato delle stampe in attesa) sia nella sagra (dentro `SyncStatus`) sia in SmartEats. In Impostazioni → Stampanti (admin) il ristorante configura tre stampanti fisse (cucina, bar, conto) che dietro le quinte sono copie `Cucina`, `Ritiro Bar` e `Conto` (quest'ultima non stampa comande: serve solo alla ricevuta, `pickReceiptPrinter`).
- Esportazioni di una serata (`routes/exports.js`, `utils/sessionExport.js`, `utils/sessionReport.js`): `GET /exports/session/:id/csv?type=lines|products&tz=` (admin) e `GET /exports/session/:id/report?tz=` (admin e responsabile, i numeri aggregati dal database per il PDF disegnato in `components/shared/statistics/sessionReportPdf.js`). Entrambi dietro `requireUnlocked`; gli orari sono nel fuso del dispositivo (`tz`), mai in UTC.
- Menu pubblico con il QR (stand, modulo `qr_menu`): il messaggio di benvenuto (`welcome_message`) lo scrive **solo il master** (`PUT /master/tenants/:id/menu`, scheda «Menu pubblico»); il locale vede QR, link e messaggio in sola lettura (Impostazioni → Menu pubblico).
- Il rate limiting è in `middleware/rateLimiter.js`. Le API e gli ordini contano per utente se c'è una sessione valida, altrimenti per IP: le casse dietro lo stesso IP non si dividono il limite. Gli endpoint nuovi e "costosi" (export, stampa) meritano un limiter dedicato.
- Origini ammesse (`utils/origins.js`): `APP_DOMAIN` e i suoi sottodomini; localhost e IP LAN solo fuori dalla produzione. Un'origine non ammessa riceve 403 prima di qualsiasi elaborazione.

## 5. Convenzioni backend

- ESM (`import`/`export`), `async/await`, nessuna callback.
- Una route per dominio. Le route che devono notificare via WebSocket sono factory: `export default function (broadcast) { … }`.
- Struttura di un handler:
  ```js
  router.post('/', authenticate, validate({ body: schema }), tenantScope, async (req, res) => {
    const { … } = req.body; // già validato
    try {
      const { rows } = await req.db.query('…', [ … ]);
      res.status(201).json(rows[0]);
    } catch (err) {
      logger.error({ err }, 'Errore POST /api/…');
      res.status(500).json({ error: 'Errore …' });
    }
  });
  ```
- Errori: `{ error: 'messaggio in italiano' }`, più `code` in MAIUSCOLO quando il frontend deve distinguerli (`TOKEN_EXPIRED`, `LICENSE_EXPIRED`, `TENANT_INACTIVE`). Status coerenti: 400 validazione, 401 non autenticato, 403 non autorizzato, 404, 409 conflitto, 402 licenza.
- Log solo con `logger` (pino), mai `console.log` nel codice applicativo. Passa l'errore come `{ err }`.
- Query sempre parametrizzate (`$1, $2`). Niente concatenazione di input utente in SQL.
- Eventi WebSocket: `{ type: 'snake_case_evento', … }` (es. `order_updated`, `product_stock_updated`), inviati con `broadcast(req.user.tenantId, msg)`. Il tenant è obbligatorio: senza, l'evento viene scartato. Un nuovo evento va gestito anche in `App.jsx`, `SmartEatsApp.jsx` e/o nel KDS. Lato frontend il collegamento si apre solo con l'hook `useLiveUpdates` (riconnessione e rinnovo della sessione inclusi), mai con `new WebSocket` diretto.
- Il KDS pubblico (`?kds=public`) riceve solo gli eventi elencati in `PUBLIC_EVENTS` di `ws.js`, ridotti con `toPublicOrder()`. Un evento nuovo per il KDS pubblico va aggiunto lì, senza prezzi, totali o dati utente.

## 6. Database e migrazioni

- Ogni modifica di schema è una nuova migrazione `backend/migrations/NNN_descrizione.sql`, numerata dopo l'ultima esistente (oggi 058; il numero 012 è saltato, non riusarlo).
- **Non modificare mai una migrazione già applicata.** Per correggerla, scrivine una nuova.
- Le migrazioni devono essere idempotenti dove possibile (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`). `run.js` esegue ogni file in una transazione insieme alla riga in `_migrations`: non scrivere `BEGIN;`/`COMMIT;` nelle migrazioni nuove (quelle storiche vengono tolte da `utils/migrationSql.js`).
- L'utente applicativo ha solo SELECT/INSERT/UPDATE/DELETE (niente TRUNCATE, TRIGGER, REFERENCES; `audit_logs` non si aggiorna): nelle migrazioni non concedergli altro.
- `MIGRATION_DATABASE_URL` serve a eseguire le DDL con un utente privilegiato. L'app gira con l'utente applicativo, soggetto a RLS.
- `backend/schema.sql` è il dump di riferimento dello schema e contiene tutte le migrazioni. Rigeneralo (`pg_dump --schema-only`) dopo nuove migrazioni. Un database nuovo si crea da `schema.sql` più `npm run db:baseline`.

## 7. Convenzioni frontend

- Componenti funzionali con hook. Un componente per file, file `.jsx` in PascalCase; hook `useXxx`; utility in camelCase `.js`. Un file `.jsx` esporta solo componenti: contesti, hook e costanti condivise vanno in un `.js` a parte (es. `useAuth.js` accanto ad `AuthProvider.jsx`), come chiede la regola di fast refresh.
- `config/api.js`: in sviluppo le API sono sulla porta 3000 dello stesso host; in produzione sulla stessa origine del frontend.
- Le chiamate API passano **solo** da `src/utils/apiClient.js`, mai da `fetch` diretta:
  - `fetchWithAuth(path, { method, body })` per tutto ciò che richiede login: su 401 rinnova la sessione una volta (un solo rinnovo anche per più chiamate insieme) e ripete la richiesta; licenza scaduta o tenant disattivato riportano al login;
  - `apiFetch` dove un 401 non significa sessione scaduta: login, pagine pubbliche (menu, KDS), master panel;
  - `body` oggetto viene inviato come JSON; `raw: true` restituisce la Response (file, audio);
  - gli errori arrivano come `ApiError` (`message` in italiano dal server, `status`, `code`) o `NetworkError` (server non raggiungibile). Mostra `err.message` con un toast.
- Lato server un 401 significa solo "sessione assente o scaduta": per credenziali o dati errati usa 400 o 403, altrimenti il frontend tenterebbe un rinnovo inutile.
- Stile solo con Tailwind v4. Rispetta il tema chiaro/scuro esistente e il doppio layout desktop/mobile (`useBreakpoint`, cartelle `desktop/` e `mobile/`).
- Messaggi all'utente tramite `ToastContext`, non con `alert()`.
- **Cache offline (`offline/lastKnown.js`) con versione:** quando cambia il significato di ciò che si conserva (ruoli, tipi di locale, forma dell'utente) si alza `VERSION`: i valori di una versione precedente si scartano, non si interpretano. Un utente «vecchio» in cache, a server irraggiungibile, aprirebbe l'app sbagliata (è successo con la migrazione 048).
- **Account e notifiche**: la testata ha il servizio, la campanella (per chi gestisce prenotazioni e asporto) e il menu dell'account (iniziali: aspetto Auto/Chiaro/Scuro, **Suggerimenti** per admin e responsabile in una finestra `shared/FeedbackModal.jsx`, uscita). Il menu laterale della sagra si chiama «Impostazioni» come quello di SmartEats. La sezione **Account** (`components/setup/AccountSection.jsx`) è solo di admin e responsabile: l'admin vede l'elenco utenti e il **proprio profilo (nome e password) si apre nella sua riga «Tu»** (`shared/ProfileForm.jsx` dentro `UsersPanel`), il responsabile ha solo la propria riga; cassa, cameriere e cucina non cambiano username e password da soli: se dimenticano la password l'admin ne imposta una temporanea (`POST /auth/admin/users/:id/reset-password`) e al primo accesso la cambiano (`ChangePassword`). Una pagina Impostazioni senza sezioni per un ruolo non compare nel menu (`smarteats/app/views.js`, `viewRoles.js`).
- **Pagine pubbliche dei clienti** (`pages/BookingPage.jsx`, menu QR): si usano soprattutto da telefono (iOS e Android), in verticale e in orizzontale. Regole: il `body` dell'app è bloccato (`overflow: hidden`), quindi la pagina ha **un proprio contenitore che scorre** (`fixed inset-0 overflow-y-auto`); campi a 16 px (sotto, iOS ingrandisce la pagina al tocco); bersagli da almeno 48 px; azione principale sempre raggiungibile (barra in basso con `env(safe-area-inset-bottom)`); in orizzontale o su schermi larghi due colonne. Ogni pagina pubblica ha un test nel browser che verifica lo scorrimento a 390×664 e 740×360.
- **Aggiornamenti dell'app** (`registerType: 'prompt'`, `hooks/useAppUpdate.js`, regole pure in `utils/updatePolicy.js`): il service worker scarica la versione nuova in disparte; l'app la mette in uso da sola solo in momenti sicuri (ritorno in primo piano dopo 5 minuti, oppure 6 ore di attesa e 5 minuti di schermo fermo), **mai con ordini in coda o stampe da partire**; intanto `UpdateBanner` offre «Aggiorna». Dopo l'aggiornamento admin e responsabile vedono una sola volta la finestra «Novità» (`WhatsNew`, voci di `changelog.js`, ultima versione vista in `localStorage`): non c'è un archivio da consultare.
- **iPhone e iPad (come un'app nativa):** il guscio ha la classe `app-safe` (margini di tacca e Dynamic Island), le altezze usano `dvh` (mai `h-screen`/`min-h-screen`), le schermate centrate usano `layout/CenteredScreen` (scorrono se non ci stanno). La variante Tailwind `coarse:` (schermo a dito: bersagli da 44 px) è in `index.css`, dove stanno anche le regole per dito (niente selezione del testo né rimbalzo, campi a 16 px). Le righe che scorrono in orizzontale usano `shared/ScrollRow` (sfuma dal lato in cui c'è altro). I messaggi (`Toast`) stanno in alto sul telefono. Si prova con i viewport iPhone/iPad (390×844, 844×390, 820×1180, 1180×820) e si guardano gli screenshot.
- `App.jsx` e i gusci (`festival/FestivalApp.jsx`, `smarteats/app/SmartEatsApp.jsx`) collegano i pezzi: le nuove funzionalità vanno in componenti, hook o pagine dedicate, non qui.
- Icone PWA in `frontend/public/` (`pwa-192.png`, `pwa-512.png`, `apple-touch-icon.png`), ricavate dal simbolo del logo (ombrellone con spunta) con il simbolo al 56% del lato, così la 512 vale anche come maskable. Se cambi le icone, aggiorna il manifest in `vite.config.js`.

## 8. Offline-first (fase 2, in corso)

- La coda locale è in Dexie (`src/offline/`). Per cambiare lo schema serve una nuova `db.version(n)` con eventuale `upgrade`; non modificare la versione esistente.
- Ogni ordine ha una chiave di idempotenza generata dalla cassa (`client_order_id`, UUID) con vincolo di unicità per tenant: un nuovo invio dello stesso ordine restituisce quello esistente con `duplicate: true`.
- Un ordine battuto offline va in coda con `session_id` e `client_created_at`. Alla sincronizzazione il server lo assegna a quella sessione, anche se chiusa da meno di 24 ore (oltre: `409 SESSION_CLOSED`), e riporta l'ora dentro la sessione. Non lo rifiuta per stock, perché è già stato venduto. Se la sessione è chiusa: stato `completed`, niente stock, niente comanda o KDS, `expected_cash` ricalcolato.
- La coda (`syncQueue.js`) toglie gli ordini accettati, si ferma su rete assente, 5xx e 429, rinnova la sessione sul 401 e marca `failed`, con il motivo, quelli rifiutati per sempre (altri 4xx). Il contatore rosso in testata apre `FailedOrdersModal`: `offline/failedOrders.js` permette di riprovare (torna `pending`) o eliminare l'ordine dalla coda.
- Il server resta la fonte di verità per prezzi e stock anche per gli ordini sincronizzati in ritardo. Il `display_code` invece lo dà la cassa (vedi §4), così si numera e si stampa anche senza rete.
- Il dispositivo si abbina al primo accesso online (`POST /devices`) e conserva lettera e contatore per sessione in Dexie (`offline/device.js`). Cancellare i dati del sito lo fa riabbinare con una lettera nuova.
- Il service worker non mette in cache le risposte API: potrebbero essere di un altro utente o tenant. Offline il catalogo viene da Dexie (`productsCache.js`), l'ultimo utente e l'ultima sessione da `lastKnown.js`, usati solo quando il server non è raggiungibile. IndexedDB e localStorage sono separati per sottodominio, quindi per tenant.

## 9. Stampa

La stampa è **del client**: la cassa che batte l'ordine stampa direttamente sulla stampante in LAN, quindi funziona anche senza internet. Il backend non stampa. Dettagli, file e flussi in `docs/stampa.md`.

- Codice in `frontend/src/print/`. I template parlano solo con il builder (`eposBuilder.js`); un'altra marca si aggiunge come driver `{ id, createBuilder(), send(builder, target) }` in `print.js`, senza toccare template e coda.
- Si stampa dopo che il server ha accettato l'ordine (online) o subito, insieme all'ordine in coda (offline). Un ordine sincronizzato in ritardo non si ristampa mai.
- La coda (`printJobs` in Dexie) tiene il lavoro finché la stampante non lo accetta. La configurazione si scarica e si conserva in Dexie per stampare offline.
- La personalizzazione degli scontrini (`receipt_*`) è per tenant e la modifica solo il master (`TenantReceiptEditor.jsx`). Non scrivere testi o loghi nei template. Le immagini sono data URL PNG (max 150 KB) decodificate a mano in `raster.js` perché la CSP non permette `fetch` su `data:`.
- Il simulatore `scripts/mock-epos.js` (https://localhost:9443) serve ai test e alle prove a mano; non sostituisce una stampante vera (certificato e CORS reali).
- `backend/debug_epos.js` è uno script di diagnostica, non codice applicativo.

## 10. Come lavorare (workflow per Claude)

1. **Prima di scrivere codice**, per feature non banali: leggi i file coinvolti e proponi un piano breve (migrazioni, endpoint, componenti, eventi WS). Aspetta conferma se tocca DB, auth o RLS. **Se tocchi un modulo, leggi prima la sua sezione in `docs/regole-moduli.md`; se tocchi una schermata, `docs/stile-interfaccia.md`**: il dettaglio non sta qui per non pesare a ogni sessione.
2. Modifiche piccole e focalizzate. Niente refactoring non richiesti mescolati alla feature: segnalali a parte.
3. Riusa i pattern esistenti (vedi `routes/products.js` e il POST in `routes/orders.js` come riferimento).
4. Dopo ogni modifica: `./scripts/check.sh` (mirato: solo i test che attraversano ciò che hai toccato; chi aggiunge una cartella del frontend o un test nel browser aggiorna `E2E_RULES` in `scripts/select-tests.mjs`) e verifica che il backend parta. Se tocchi una migrazione, eseguila su un DB locale. **Il ciclo completo (`--all`) si fa una volta sola, alla fine del lavoro**, prima di chiedere l'unione: non a ogni piccola modifica.
5. Test nel browser: `frontend/e2e/*.spec.js`, uno per giro completo (non una scheda per schermata). Dopo una modifica all'interfaccia lancia `npm run e2e` e **guarda gli screenshot**: i test sulla logica non vedono layout, contrasti o testi sbagliati. In CI è il job `e2e` (non obbligatorio per l'unione).
5. Test: unitari in `backend/tests/` (`npm test`), di integrazione in `backend/tests/integration/` (`npm run test:integration`). Quelli di integrazione avviano l'app in memoria su un database locale vero (con RLS), creano tenant di prova con nomi casuali e li cancellano alla fine. Quando aggiungi logica critica (prezzi, stock, RLS) aggiungi test mirati: la logica pura va in funzioni separate con test unitari, i flussi tra API e database nei test di integrazione. Il frontend ha test solo per la logica pura (`frontend/src/**/*.test.js`, moduli senza dipendenze dal browser).
6. Commit in italiano, all'imperativo, con un ambito: `feat(orders): …`, `fix(rls): …`, `chore: …`. Ogni modifica visibile a chi usa il locale porta la sua riga in `changelog.js` (vedi §2). **Unire una PR richiede sempre il via libera esplicito dell'utente:** si chiede (con il link della PR) e l'unione la fa lui con il commento `/merge` (`.github/workflows/merge-comando.yml`: unisce solo se i controlli sono verdi e il commento è del proprietario). Mai unire, né aggirare i controlli, di propria iniziativa.
7. Se una richiesta contraddice queste regole (soprattutto §3 e §4), fermati e chiedi.
8. A fine feature, aggiorna questo file se è nata una convenzione nuova.

## 11. Leggibilità e manutenzione — regole per ogni modifica

Il progetto deve restare comprensibile anche a chi non è uno sviluppatore (guida: `docs/guida-al-codice.md`; controllo: `./scripts/check.sh`).

1. **Un file, un compito, ~300 righe al massimo.** Oltre, si divide per responsabilità (esempio: `components/products/`: modulo, azioni, finestre, elenchi). I file grandi che restano (`PrintProfiles.jsx`, `FloorEditor.jsx`) sono nel backlog.
2. **La logica sta fuori dalla grafica.** Calcoli e regole in file `.js` puri con un `.test.js` che li spiega con esempi; i `.jsx` li usano. Le chiamate al server stanno in un hook (`useXxx.js`) o in un file di azioni, non sparse nei componenti.
3. **Un commento in testa a ogni file** (a cosa serve) e sopra ogni funzione non ovvia (il *perché*). In italiano.
4. **Prima di creare, cerca** tra i componenti condivisi (elenco in `docs/stile-interfaccia.md`). Se una cosa serve in due posti, diventa condivisa.
5. **Il backend è a strati:** `routes/` risponde (permessi, validazione, risposta, avvisi), `utils/` fa il lavoro sui dati (esempio: `utils/createOrder.js` per `POST /orders`), `schemas/` dice cosa si può mandare. Una route non contiene regole di business lunghe.
6. **Niente codice morto:** un export non usato da nessuno si toglie. Si trovano con `node scripts/find-dead-code.mjs` (non cancella nulla, elenca).
7. **Le regole si controllano da sole:** `frontend/src/styleRules.test.js` (parte con `npm test` e `check.sh`) fa fallire il controllo se un file supera 300 righe, se nasce una finestra fatta a mano invece di `Modal`, se compaiono `tracking-widest`, `font-black` o `alert()`. I file lunghi già noti sono in elenco nel test e non devono crescere.
8. **Ogni refactor passa dai test** (`./scripts/check.sh --all`) e, se tocca una schermata senza test nel browser, ne guadagna uno (`frontend/e2e/`).

## 12. Difetti noti e lavoro previsto

I difetti noti stanno in `docs/backlog.md`; il piano per SmartEats e la piattaforma (moduli, tavoli, prenotazioni…) in `docs/requirements.md`, da aggiornare a ogni passo. Quando ne risolvi uno, toglilo da lì nello stesso commit.
