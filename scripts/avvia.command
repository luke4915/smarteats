#!/bin/bash
# Avvia SmartEats come un'app: un doppio clic su questo file (Finder) o `./scripts/avvia.command` dal terminale.
# Costruisce il frontend se è cambiato, poi avvia il server (che serve anche le pagine) e apre il browser.
# Per fermarlo: Ctrl+C in questa finestra, o chiudila. Serve PostgreSQL acceso (da Homebrew parte da solo).
set -e
cd "$(dirname "$0")/.."
DOMAIN="${APP_DOMAIN:-smarteats.local}"
LOCALE="${1:-demo}"                 # il locale da aprire nel browser (default: la demo)
# La porta è quella di backend/.env (di solito 3000); si può forzare con PORT=… prima del comando
PORT="${PORT:-$(grep -E '^PORT=' backend/.env 2>/dev/null | cut -d= -f2)}"
PORT="${PORT:-3000}"

# Il frontend si ricostruisce solo se manca o se un file dei sorgenti è più recente
if [ ! -f frontend/dist/index.html ] || [ -n "$(find frontend/src frontend/index.html frontend/package.json -newer frontend/dist/index.html -print -quit)" ]; then
  echo "▶ Preparo l'app (qualche secondo)…"
  (cd frontend && npm run build >/dev/null)
fi

# Apre il browser appena il server risponde
( for _ in $(seq 1 40); do
    if curl -ksf "https://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then open "https://$LOCALE.$DOMAIN:$PORT"; break; fi
    sleep 0.5
  done ) &

echo "▶ SmartEats parte su https://$LOCALE.$DOMAIN:$PORT   (Ctrl+C per fermarlo)"
cd backend
NODE_ENV=production exec node server.js
