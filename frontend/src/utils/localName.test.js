import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localName } from './localName.js';

const p = { name: 'Panino con salsiccia', translations: { en: 'Sausage sandwich', de: '' } };

test('la traduzione se c\'è, altrimenti il nome italiano', () => {
  assert.equal(localName(p, 'en'), 'Sausage sandwich');
  assert.equal(localName(p, 'it'), 'Panino con salsiccia');
  assert.equal(localName(p, 'de'), 'Panino con salsiccia', 'una traduzione vuota non conta');
  assert.equal(localName(p, 'fr'), 'Panino con salsiccia');
  assert.equal(localName({ name: 'Acqua' }, 'en'), 'Acqua');
});
