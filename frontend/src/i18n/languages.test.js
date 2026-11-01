import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickLanguage, translate, LANGUAGES } from './languages.js';

test('la lingua scelta vince; altrimenti la prima del telefono che si conosce; altrimenti l\'italiano', () => {
  assert.equal(pickLanguage('de', ['en-US']), 'de');
  assert.equal(pickLanguage(null, ['ja-JP', 'fr-CA', 'en']), 'fr');
  assert.equal(pickLanguage('klingon', ['xx']), 'it');
  assert.equal(pickLanguage(undefined, []), 'it');
});

const messages = {
  it: { hello: 'Ciao {name}', 'items.one': '{count} articolo', 'items.other': '{count} articoli', onlyItalian: 'Solo italiano' },
  en: { hello: 'Hello {name}', 'items.one': '{count} item', 'items.other': '{count} items' },
};

test('i segnaposto si riempiono e il plurale si sceglie dal numero', () => {
  assert.equal(translate(messages, 'en', 'hello', { name: 'Anna' }), 'Hello Anna');
  assert.equal(translate(messages, 'en', 'items', { count: 1 }), '1 item');
  assert.equal(translate(messages, 'en', 'items', { count: 3 }), '3 items');
});

test('una frase che manca in una lingua si legge in italiano; una chiave sconosciuta resta com\'è', () => {
  assert.equal(translate(messages, 'en', 'onlyItalian'), 'Solo italiano');
  assert.equal(translate(messages, 'en', 'nope'), 'nope');
  assert.equal(translate(messages, 'en', 'hello'), 'Hello {name}', 'un segnaposto senza valore non sparisce');
});

test('sono cinque lingue, con l\'italiano per primo', () => {
  assert.deepEqual(LANGUAGES.map(l => l.id), ['it', 'en', 'de', 'fr', 'es']);
});
