import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CHANGELOG } from './changelog.js';
import { compareVersions } from './utils/whatsNew.js';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('la prima voce del changelog è la versione di package.json (quella che esce)', () => {
  assert.equal(CHANGELOG[0].version, pkg.version);
});

test('il changelog va dalla più recente alla più vecchia e ogni voce ha delle righe', () => {
  for (let i = 1; i < CHANGELOG.length; i++) assert.ok(compareVersions(CHANGELOG[i - 1].version, CHANGELOG[i].version) > 0);
  for (const e of CHANGELOG) assert.ok(e.items.length > 0 && /^\d+\.\d+\.\d+$/.test(e.version));
});
