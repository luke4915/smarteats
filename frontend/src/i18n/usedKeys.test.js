// Ogni frase chiesta nel codice con `t('chiave')` deve esistere in italiano: altrimenti sullo schermo comparirebbe la chiave. Chiavi composte
// (`allergen.${id}`) non si controllano qui. Il test legge i sorgenti, quindi una frase dimenticata si scopre subito.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MESSAGES } from './messages.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? files(path.join(dir, e.name)) : /\.(jsx?|js)$/.test(e.name) && !/\.test\.js$/.test(e.name) ? [path.join(dir, e.name)] : []));

test('tutte le chiavi usate nel codice esistono in italiano (anche al plurale)', () => {
  const missing = [];
  for (const file of files(root)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'\s*(,\s*\{[^}]*count[^}]*\})?/g)) {
      const [, key, hasCount] = m;
      const ok = hasCount ? (`${key}.one` in MESSAGES.it && `${key}.other` in MESSAGES.it) : key in MESSAGES.it;
      if (!ok) missing.push(`${path.relative(root, file)}: ${key}`);
    }
  }
  assert.deepEqual(missing, []);
});
