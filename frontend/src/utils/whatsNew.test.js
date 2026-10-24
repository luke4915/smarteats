import test from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions, entriesToShow } from './whatsNew.js';

const LOG = [{ version: '0.3.0' }, { version: '0.2.1' }, { version: '0.2.0' }];

test('compareVersions confronta numero per numero, non come testo', () => {
  assert.ok(compareVersions('0.10.0', '0.9.0') > 0);
  assert.equal(compareVersions('1.2.3', '1.2.3'), 0);
  assert.ok(compareVersions('0.2.0', '0.2.1') < 0);
});

test('mostra solo le voci uscite dopo l\'ultima versione vista', () => {
  assert.deepEqual(entriesToShow(LOG, '0.2.0', '0.3.0').map(e => e.version), ['0.3.0', '0.2.1']);
});

test('chi è già aggiornato non vede nulla', () => {
  assert.deepEqual(entriesToShow(LOG, '0.3.0', '0.3.0'), []);
});

test('primo accesso su un dispositivo: nessun annuncio', () => {
  assert.deepEqual(entriesToShow(LOG, null, '0.3.0'), []);
});

test('non annuncia versioni più nuove di quella in uso', () => {
  assert.deepEqual(entriesToShow(LOG, '0.2.0', '0.2.1').map(e => e.version), ['0.2.1']);
});
