import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Le regole di leggibilità e di stile di CLAUDE.md (§11 e «Stile uniforme»), controllate da sole a ogni `npm test`:
// così non dipendono dalla memoria di chi modifica il codice. Se un test fallisce, il messaggio dice file e cosa fare.
const root = path.dirname(fileURLToPath(import.meta.url));
const sources = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(jsx?|mjs)$/.test(entry.name) && !/\.test\./.test(entry.name)) sources.push(full);
  }
};
walk(root);
const rel = (f) => path.relative(root, f).split(path.sep).join('/');
const text = (f) => fs.readFileSync(f, 'utf8');

// File che superano il limite per scelta (nel backlog): non devono crescere. Stampa e pianta si riordinano a parte.
const LONG_FILES_ALLOWED = { 'components/setup/PrintProfiles.jsx': 450, 'smarteats/floorplan/FloorEditor.jsx': 350, 'print/templates.js': 350 };
const MAX_LINES = 300;

test(`un file, un compito: al massimo ${MAX_LINES} righe (salvo quelli in elenco, che non devono crescere)`, () => {
  const tooLong = sources.map(f => [rel(f), text(f).split('\n').length]).filter(([name, lines]) => lines > (LONG_FILES_ALLOWED[name] ?? MAX_LINES));
  assert.deepEqual(tooLong, [], 'File troppo lunghi: dividili per responsabilità (esempio: components/products/)');
});

// Le finestre sono tutte `components/shared/Modal.jsx`: Esc per chiudere, stile e animazione uguali ovunque.
test('nessuna finestra fatta a mano: si usa Modal', () => {
  const handmade = sources.filter(f => !/shared\/Modal\.jsx$/.test(f) && /fixed inset-0[^"'`]*bg-black\/\d+/.test(text(f))).map(rel);
  assert.deepEqual(handmade, [], 'Usa <Modal> di components/shared/Modal.jsx invece di un fixed inset-0 con sfondo scuro');
});

test('niente maiuscolo spaziato né font-black: gerarchia con dimensione e peso (floor/ui.js)', () => {
  const noisy = sources.filter(f => /tracking-widest|font-black/.test(text(f))).map(rel);
  assert.deepEqual(noisy, [], 'Togli tracking-widest e font-black: vedi lo stile sobrio in smarteats/floor/ui.js');
});

test('niente alert(): i messaggi passano da useToast', () => {
  const alerts = sources.filter(f => /\balert\(/.test(text(f))).map(rel);
  assert.deepEqual(alerts, []);
});
