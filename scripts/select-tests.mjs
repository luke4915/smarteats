#!/usr/bin/env node
// Sceglie quali test lanciare in base ai file cambiati: così una modifica piccola non aspetta tutta la batteria.
// La usano `scripts/check.sh` (sul tuo computer) e `.github/workflows/ci.yml` (su GitHub).
//
//   node scripts/select-tests.mjs                    file cambiati rispetto a origin/main (anche non salvati)
//   node scripts/select-tests.mjs --base <ramo>      stessa cosa con un altro ramo di partenza
//   node scripts/select-tests.mjs --full             il ciclo completo (tutto)
//   node scripts/select-tests.mjs --files a b c      file indicati a mano (prove)
//
// Risposta in JSON: { code, full, integration, e2e }
//   code         true se è cambiato del codice (lint, test della logica e build servono); false se solo documenti
//   integration  'all' | [file dei test col database] | []
//   e2e          'all' | [file dei test nel browser] | []
// La regola è prudente: nel dubbio si lancia di più, mai di meno. Tocca solo l'infrastruttura (workflow, dipendenze, schema,
// migrazioni, script)? Ciclo completo. Un file del frontend che non conosciamo? Tutti i test nel browser.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Chi tocca cosa nel frontend: la cartella → i test nel browser che la attraversano. Vale la prima regola che combacia.
export const E2E_RULES = [
  ['frontend/src/smarteats/floorplan/', ['floorplan']],
  ['frontend/src/smarteats/floor/', ['restaurant', 'reservations', 'tables-range']],
  ['frontend/src/smarteats/reservations/', ['reservations', 'booking-portal']],
  ['frontend/src/smarteats/takeaway/', ['takeaway', 'takeaway-shop']],
  ['frontend/src/smarteats/kitchen/', ['restaurant', 'takeaway-shop']],
  ['frontend/src/smarteats/catalog/', ['catalog']],
  ['frontend/src/smarteats/stats/', ['restaurant']],
  ['frontend/src/smarteats/settings/', ['tables-range', 'booking-portal', 'takeaway', 'floorplan', 'festival']],
  ['frontend/src/festival/', ['festival', 'festival.phone']],
  ['frontend/src/components/master/', ['master']],
  ['frontend/src/pages/MasterPage', ['master']],
  ['frontend/src/pages/BookingPage', ['booking-portal']],
  ['frontend/src/pages/OrderPage', ['takeaway']],
  ['frontend/src/pages/LegalPage', ['legal']],
  ['frontend/src/components/products/', ['catalog']],
  ['frontend/src/components/cart/', ['festival', 'festival.phone']],
  ['frontend/src/components/setup/', ['festival', 'tables-range', 'floorplan']],
];

// Cartelle del backend che reggono tutto: se cambiano, si provano tutti i test col database e nel browser.
const CORE_BACKEND = ['backend/app.js', 'backend/db.js', 'backend/server.js', 'backend/ws.js', 'backend/middleware/', 'backend/logger.js', 'backend/tests/integration/helpers.js'];
// Qui dentro si cambia solo l'infrastruttura: ciclo completo.
const INFRA = [/^\.github\//, /^scripts\//, /package(-lock)?\.json$/, /^backend\/schema\.sql$/, /^backend\/migrations\//, /^backend\/scripts\//, /^deploy\//, /^Dockerfile$/, /vite\.config\.js$/, /playwright\.config\.js$/, /eslint\.config\.js$/];

const isDoc = (f) => /\.md$/i.test(f) || f.startsWith('docs/') || f.startsWith('.claude/');

const stem = (f) => path.basename(f).replace(/\.[^.]+$/, '');
// «takeawayDb» → «takeaway», «orderItemsWrite» → «order»: la prima parola in camelCase, che di solito è il dominio.
const domain = (f) => stem(f).split(/(?=[A-Z])|[_-]/)[0].toLowerCase();

// Quali test col database riguardano un file del backend: quelli che ne nominano il dominio (es. «takeaway»). Nessuno → tutti.
function integrationFor(file, tests) {
  const word = domain(file);
  const hit = tests.filter(t => t.text.toLowerCase().includes(word) || t.file.toLowerCase().includes(word)).map(t => t.file);
  return hit.length ? hit : 'all';
}

const merge = (a, b) => (a === 'all' || b === 'all' ? 'all' : [...new Set([...a, ...b])].sort());

// `tests`: [{ file, text }] i test col database (nome e contenuto), per capire quali riguardano un file.
export function selectTests(files, tests = []) {
  const changed = files.filter(Boolean);
  const FULL = { code: true, full: true, integration: 'all', e2e: 'all' };
  const code = changed.filter(f => !isDoc(f));
  if (code.length === 0) return { code: false, full: false, integration: [], e2e: [] };
  if (code.some(f => INFRA.some(re => re.test(f)))) return FULL;

  let integration = [];
  let e2e = [];
  for (const f of code) {
    if (f.startsWith('backend/')) {
      if (CORE_BACKEND.some(p => f.startsWith(p))) return FULL;
      if (f.startsWith('backend/tests/integration/') && f.endsWith('.test.js')) { integration = merge(integration, [path.basename(f)]); continue; }
      if (f.startsWith('backend/tests/')) continue;                       // test della logica: li lancia già la base
      if (/^backend\/(routes|utils|schemas)\//.test(f)) { integration = merge(integration, integrationFor(f, tests)); continue; }
      integration = 'all';
    } else if (f.startsWith('frontend/e2e/')) {
      if (f.endsWith('.spec.js')) e2e = merge(e2e, [path.basename(f)]);
      else e2e = 'all';                                                   // support.js e simili: servono a tutti
    } else if (f.startsWith('frontend/')) {
      if (/\.test\.js$/.test(f)) continue;                                // test della logica: li lancia già la base
      const rule = E2E_RULES.find(([prefix]) => f.startsWith(prefix));
      e2e = merge(e2e, rule ? rule[1].map(n => `${n}.spec.js`) : 'all');
    } else {
      return FULL;                                                        // file che non conosciamo: prudenza
    }
  }
  return { code: true, full: false, integration, e2e };
}

// ── da riga di comando ──
const sh = (cmd) => execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').filter(Boolean);

function changedFiles(base) {
  const mergeBase = sh(`git merge-base HEAD ${base}`)[0];
  return [...new Set([...sh(`git diff --name-only ${mergeBase}`), ...sh('git ls-files --others --exclude-standard')])];
}

function integrationTests(root) {
  const dir = path.join(root, 'backend/tests/integration');
  return fs.readdirSync(dir).filter(f => f.endsWith('.test.js')).map(file => ({ file, text: fs.readFileSync(path.join(dir, file), 'utf8') }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const flag = (name) => args.indexOf(name);
  let result;
  if (args.includes('--full')) result = { code: true, full: true, integration: 'all', e2e: 'all' };
  else if (flag('--files') >= 0) result = selectTests(args.slice(flag('--files') + 1), integrationTests(root));
  else result = selectTests(changedFiles(flag('--base') >= 0 ? args[flag('--base') + 1] : 'origin/main'), integrationTests(root));
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
