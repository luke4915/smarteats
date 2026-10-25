#!/usr/bin/env bash
# Tutti i controlli del progetto con un solo comando. Da lanciare dalla cartella principale, PRIMA di salvare le modifiche.
#
#   ./scripts/check.sh            controlli MIRATI: sempre logica, lint e build; in più, solo se servono, i test col database e
#                                 nel browser di ciò che hai toccato (li sceglie scripts/select-tests.mjs dai file cambiati)
#   ./scripts/check.sh --quick    solo logica, lint e build (1-2 minuti)
#   ./scripts/check.sh --all      il CICLO COMPLETO: tutto, anche test col database (serve backend/.env.test) e nel browser.
#                                 Da lanciare alla fine del lavoro, prima di chiedere di unire.
#
# Si ferma al primo errore e dice dove guardare. Se tutto è verde, le modifiche non hanno rotto nulla di ciò che è provato.
set -euo pipefail
cd "$(dirname "$0")/.."

MODE="${1:-}"
step() { printf '\n\033[1;34m▶ %s\033[0m\n' "$1"; }
ok()   { printf '\033[1;32m✔ %s\033[0m\n' "$1"; }
skip() { printf '\033[1;33m– %s\033[0m\n' "$1"; }
field() { node -e "const v=JSON.parse(process.argv[1])[process.argv[2]]; console.log(Array.isArray(v)?v.join(' '):v)" "$SELECTION" "$1"; }

if [[ "$MODE" == "--all" ]]; then
  SELECTION='{"code":true,"full":true,"integration":"all","e2e":"all"}'
elif [[ "$MODE" == "--quick" ]]; then
  SELECTION='{"code":true,"full":false,"integration":[],"e2e":[]}'
else
  SELECTION="$(node scripts/select-tests.mjs --base "${CHECK_BASE:-origin/main}")"   # CHECK_BASE=HEAD: solo ciò che è cambiato dall'ultimo salvataggio
fi
CODE="$(field code)"; INTEGRATION="$(field integration)"; E2E="$(field e2e)"

if [[ "$CODE" != "true" ]]; then
  skip "Sono cambiati solo documenti: non c'è nulla da provare."
  exit 0
fi
[[ "$MODE" == "--all" ]] && echo "Ciclo completo." || echo "Test scelti dai file cambiati — database: ${INTEGRATION:-nessuno} · browser: ${E2E:-nessuno}"

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
(cd frontend && npm run build --silent > /tmp/smarteats-build.log 2>&1) || { cat /tmp/smarteats-build.log; exit 1; }
ok "Build a posto"

if [[ -z "$INTEGRATION" ]]; then
  [[ "$MODE" == "--quick" ]] || skip "Test col database: nessuno tocca ciò che hai cambiato."
else
  step "Backend: test con il database"
  if [[ "$INTEGRATION" == "all" ]]; then
    (cd backend && npm run test:integration --silent 2>&1 | grep -E "^ℹ (tests|pass|fail)")
  else
    FILES=(); for f in $INTEGRATION; do FILES+=("tests/integration/$f"); done
    (cd backend && node --test --test-concurrency=1 "${FILES[@]}" 2>&1 | grep -E "^ℹ (tests|pass|fail)")
  fi
  ok "Database: tutto a posto"
fi

if [[ -z "$E2E" ]]; then
  [[ "$MODE" == "--quick" ]] || skip "Test nel browser: nessuna schermata toccata."
else
  step "Test nel browser"
  if [[ "$E2E" == "all" ]]; then
    (cd frontend && npm run e2e --silent 2>&1 | grep -E "passed|failed|✘")
  else
    SPECS=(); for f in $E2E; do SPECS+=("e2e/$f"); done
    (cd frontend && npm run e2e --silent -- "${SPECS[@]}" 2>&1 | grep -E "passed|failed|✘")
  fi
  ok "Browser: tutto a posto"
fi

printf '\n\033[1;32mTutti i controlli sono passati.\033[0m\n'
