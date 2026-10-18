// Cerca codice morto: file che nessuno importa e funzioni/costanti esportate che nessuno usa.
// Uso (dalla cartella principale):  node scripts/find-dead-code.mjs
// Non cancella nulla: stampa un elenco da controllare a mano (un export usato solo da un test non è morto).
import fs from 'fs';
import path from 'path';

const ROOTS = ['backend', 'frontend/src'];
const SKIP_DIRS = new Set(['node_modules', 'dist', '.run']);
const ENTRY_POINTS = /(\.test\.|\.spec\.|main\.jsx|server\.js|\/app\.js|vite\.config|playwright|eslint|\/run\.js|\/sw\.js|debug_epos|\/scripts\/|\/tests\/)/;

const files = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(jsx?|mjs)$/.test(entry.name)) files.push(full);
  }
};
ROOTS.forEach(walk);
const source = new Map(files.map(f => [f, fs.readFileSync(f, 'utf8')]));

// 1) File che nessun altro file importa
const imported = new Set();
for (const [file, text] of source) {
  for (const m of text.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"](\.[^'"]+)['"]/g)) {
    const base = path.join(path.dirname(file), m[1]);
    for (const candidate of [base, `${base}.js`, `${base}.jsx`, path.join(base, 'index.js'), path.join(base, 'index.jsx')]) imported.add(candidate);
  }
}
const orphans = files.filter(f => !imported.has(f) && !ENTRY_POINTS.test(`/${f}`));

// 2) Export che nessun altro file nomina
const unusedExports = [];
for (const [file, text] of source) {
  if (ENTRY_POINTS.test(`/${file}`)) continue;
  for (const m of text.matchAll(/export\s+(?:async\s+)?(?:function|const|class)\s+(\w+)/g)) {
    const name = m[1];
    const usedElsewhere = [...source].some(([other, t]) => other !== file && new RegExp(`\\b${name}\\b`).test(t));
    if (!usedElsewhere) unusedExports.push(`${file}: ${name}`);
  }
}

console.log(orphans.length ? `File che nessuno importa:\n${orphans.map(f => `  ${f}`).join('\n')}\n` : 'Nessun file orfano.\n');
console.log(unusedExports.length
  ? `Export che nessun altro file usa (se servono solo dentro il file, basta togliere «export»; se non servono, si cancellano):\n${unusedExports.map(e => `  ${e}`).join('\n')}`
  : 'Nessun export inutilizzato.');
