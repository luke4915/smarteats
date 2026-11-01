import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allergensOf, conflicts, listText, parseAvoid, toggleAvoid, ALLERGEN_IDS } from './allergens.js';

test('sono i 14 allergeni, come nel server', () => assert.equal(ALLERGEN_IDS.length, 14));

test('gli allergeni di un prodotto, anche se il campo manca, nell\'ordine dell\'allegato', () => {
  assert.deepEqual(allergensOf({ allergens: ['milk', 'gluten'] }), ['gluten', 'milk']);
  assert.deepEqual(allergensOf({}), []);
  assert.deepEqual(allergensOf(null), []);
});

test('chi evita il latte vede segnalati i prodotti che lo contengono, non gli altri', () => {
  assert.deepEqual(conflicts({ allergens: ['milk', 'eggs'] }, ['milk', 'fish']), ['milk']);
  assert.deepEqual(conflicts({ allergens: ['eggs'] }, ['milk']), []);
});

test('la frase con i nomi nella lingua scelta', () => assert.equal(listText(['gluten', 'milk'], id => ({ gluten: 'glutine', milk: 'latte' })[id]), 'glutine, latte'));

test('quello che è salvato sul telefono: solo codici validi, un testo rovinato vale nessuno', () => {
  assert.deepEqual(parseAvoid('["milk","pollo","gluten"]'), ['gluten', 'milk']);
  assert.deepEqual(parseAvoid('non json'), []);
  assert.deepEqual(parseAvoid(null), []);
});

test('si aggiunge e si toglie un allergene da evitare', () => {
  assert.deepEqual(toggleAvoid([], 'milk'), ['milk']);
  assert.deepEqual(toggleAvoid(['milk', 'gluten'], 'milk'), ['gluten']);
});
