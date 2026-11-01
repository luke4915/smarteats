import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTranslations } from '../utils/translations.js';

test('restano solo le lingue ammesse, con il testo ripulito; i vuoti spariscono', () => {
  assert.deepEqual(normalizeTranslations({ en: '  Sausage sandwich ', de: '', ja: 'x', fr: 3 }), { en: 'Sausage sandwich' });
  assert.deepEqual(normalizeTranslations({ es: 'Bocadillo' }), { es: 'Bocadillo' });
});
test('un valore che non è un oggetto vale nessuna traduzione', () => {
  for (const bad of [null, undefined, 'en', ['en'], 7]) assert.deepEqual(normalizeTranslations(bad), {});
});
test('un nome troppo lungo si taglia', () => assert.equal(normalizeTranslations({ en: 'x'.repeat(100) }).en.length, 40));
