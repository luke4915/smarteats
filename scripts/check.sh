#!/usr/bin/env bash
# Tutti i controlli del progetto con un solo comando. Da lanciare dalla cartella principale, PRIMA di salvare le modifiche.
#
#   ./scripts/check.sh            controlli veloci (1-2 minuti): test della logica, lint, build
#   ./scripts/check.sh --all    in più i test con il database (serve backend/.env.test) e quelli nel browser
#
# Si ferma al primo errore e dice dove guardare. Se tutto è verde, le modifiche non hanno rotto nulla di ciò che è provato.
set -euo pipefail
cd "$(dirname "$0")/.."

step() { printf '\n\033[1;34m▶ %s\033[0m\n' "$1"; }
ok()   { printf '\033[1;32m✔ %s\033[0m\n' "$1"; }

step "Backend: test della logica"
(cd backend && npm test --silent 2>&1 | grep -E "^ℹ (tests|pass|fail)")
ok "Backend: logica a posto"

step "Frontend: controllo del codice (lint)"
(cd frontend && npm run lint --silent)
ok "Frontend: lint a posto"

step "Frontend: test della logica"
(cd frontend && npm test --silent 2>&1 | grep -E "^ℹ (tests|pass|fail)")
ok "Frontend: logica a posto"

step "Frontend: costruzione dell'app"
(cd frontend && npm run build --silent > /tmp/stand-manager-build.log 2>&1) || { cat /tmp/stand-manager-build.log; exit 1; }
ok "Build a posto"

if [[ "${1:-}" == "--all" ]]; then
  step "Backend: test con il database"
  (cd backend && npm run test:integration --silent 2>&1 | grep -E "^ℹ (tests|pass|fail)")
  ok "Database: tutto a posto"

  step "Test nel browser (fanno il giro del ristorante e della sagra)"
  (cd frontend && npm run e2e --silent 2>&1 | grep -E "passed|failed|✘")
  ok "Browser: tutto a posto"
fi

printf '\n\033[1;32mTutti i controlli sono passati.\033[0m\n'
