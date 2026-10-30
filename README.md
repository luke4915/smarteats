# SmartEats

Gestionale SaaS per sagre, eventi e ristorazione, in due prodotti sulla stessa piattaforma: **SmartEats Stand** (sagre, paninari, food truck) e **SmartEats Restaurant** (ristoranti, pizzerie, solo asporto): cassa, ordini, comande su stampanti termiche, schermo cucina (KDS), magazzino, statistiche e menu pubblico con QR. Ogni cliente (tenant) ha il suo sottodominio e i suoi dati, isolati nel database con la Row-Level Security di PostgreSQL.

- `backend/`: Node.js, Express 5, PostgreSQL, WebSocket
- `frontend/`: React 19, Vite, Tailwind v4, PWA con funzionamento offline

Regole, convenzioni, comandi e struttura delle cartelle: [`CLAUDE.md`](CLAUDE.md). **Se non sei uno sviluppatore** e vuoi fare una modifica piccola: [`docs/guida-al-codice.md`](docs/guida-al-codice.md).

## Requisiti

- Node.js 22
- PostgreSQL 16 o successivo
- [mkcert](https://github.com/FiloSottile/mkcert) per i certificati HTTPS locali

## Sviluppo in locale

**1. Database**

```bash
createdb smarteats
psql -d smarteats -c "CREATE ROLE smarteats_app LOGIN PASSWORD 'una-password'"
psql -d smarteats -c "CREATE ROLE smarteats_master LOGIN PASSWORD 'un-altra-password'"   # pannello master, vedi sotto
psql -d smarteats -f backend/schema.sql   # gli avvisi sul ruolo proprietario si possono ignorare
```

**2. Backend**

```bash
cd backend
cp .env.example .env          # compila database, JWT_SECRET, master panel e certificati
npm install
npm run db:baseline           # solo la prima volta: schema.sql contiene già tutte le migrazioni
npm run migrate               # da ora in poi applica solo le migrazioni nuove
npm run dev                   # https://<tenant>.smarteats.local:3000
```

**3. Frontend**

```bash
cd frontend
npm install
npm run dev                   # https://<tenant>.smarteats.local:5173
```

Ogni tenant si apre dal suo sottodominio (es. `default.smarteats.local`): i nomi vanno risolti verso `127.0.0.1`, su Windows con gli script in `backend/scripts/`. I tenant si creano dal master panel, su `/master`. Per provare l'app con dati realistici: `npm run demo:seed` (in `backend/`) crea il ristorante `demo` (vedi `CLAUDE.md` per gli utenti); serve la riga `127.0.0.1 demo.smarteats.local` in `/etc/hosts`.

## Test

`./scripts/check.sh` (veloce) o `./scripts/check.sh --all` (anche database e browser). I singoli comandi di test sono nella tabella di [`CLAUDE.md`](CLAUDE.md) §2. La CI (`.github/workflows/ci.yml`) esegue lint, test, build e `npm audit` a ogni push e pull request, con un PostgreSQL vero per i test di integrazione.

## Produzione

Installazione, variabili d'ambiente, utenti del database, certificati, backup e monitoraggio: [`docs/deployment.md`](docs/deployment.md). Rilascio di una versione: [`docs/rilasci.md`](docs/rilasci.md). Gestione quotidiana del server: [`docs/promemoria-operativo.md`](docs/promemoria-operativo.md).
