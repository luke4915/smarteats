import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Le regole di leggibilità e di stile di CLAUDE.md (§11) e docs/stile-interfaccia.md, controllate da sole a ogni `npm test`:
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

// I pulsanti dei componenti condivisi che stanno dentro i moduli devono dichiarare `type="button"`: senza, un tocco sul selettore
// delle porzioni inviava il modulo (errore nel toast, oppure salvataggio e finestra chiusa).
test('Segmented e ActionMenu: ogni pulsante è type="button"', () => {
  const wrong = sources.filter(f => /(Segmented|ActionMenu)\.jsx$/.test(f))
    .filter(f => (text(f).match(/<button\b(?![^>]*\btype=)/g) || []).length > 0).map(rel);
  assert.deepEqual(wrong, [], 'Un <button> senza type dentro un <form> lo invia: aggiungi type="button"');
});

// Ogni ricerca è `components/shared/SearchField.jsx` (campo con lente e X): stesso aspetto e stessa tastiera ovunque.
test('nessun campo di ricerca fatto a mano: si usa SearchField', () => {
  const handmade = sources.filter(f => !/shared\/SearchField\.jsx$/.test(f) && /<input[^>]*(placeholder|aria-label)="Cerc[ah]/.test(text(f))).map(rel);
  assert.deepEqual(handmade, [], 'Usa <SearchField> di components/shared/SearchField.jsx invece di un input con la lente fatto a mano');
});

// Un solo linguaggio visivo per la cassa e per SmartEats (docs/stile-interfaccia.md): niente maiuscolo, ombre colorate, angoli
// esagerati né testi minuscoli. Prima la cassa delle sagre li aveva e un blocco di CSS li toglieva nel ristorante: ora non esistono.
test('niente maiuscolo, ombre colorate, angoli esagerati né testi sotto gli 11 px', () => {
  const heavy = sources.filter(f => !/shared\/Modal\.jsx$/.test(f) && /(^|["' `])uppercase(["' `]|$)|tracking-wider|tracking-tighter|font-extrabold|text-\[9px\]|accent-shadow|rounded-3xl/.test(text(f))).map(rel);
  assert.deepEqual(heavy, [], 'Togli uppercase, tracking-wider/tighter, font-extrabold, text-[9px], le ombre colorate e rounded-3xl: vedi smarteats/floor/ui.js');
});

// Gli importi si scrivono con `formatEuro` / `formatCents` (utils/format.js): «6,00 €», mai «6.00€».
test('nessun prezzo scritto a mano con toFixed: si usa formatEuro', () => {
  const handmade = sources.filter(f => /\.jsx$/.test(f) && /toFixed\(2\)[^\n]*€|€[^\n]*toFixed\(2\)/.test(text(f))).map(rel);
  assert.deepEqual(handmade, [], 'Usa formatEuro di utils/format.js invece di toFixed(2) per mostrare un importo');
});

// I pulsanti in fondo a una finestra sono `ModalActions` (components/shared/ModalActions.jsx): «Annulla» a sinistra dell'azione,
// uguali ovunque. Con il piede la finestra non mostra la X: l'uscita è «Annulla».
test('nessun piede di finestra fatto a mano: si usa ModalActions', () => {
  const handmade = sources.filter(f => !/shared\/ModalActions\.jsx$/.test(f) && /footer=\{?\(?\s*<div className="flex gap-/.test(text(f))).map(rel);
  assert.deepEqual(handmade, [], 'Usa <ModalActions> invece di un <div className="flex gap-…"> nel footer di Modal');
});
