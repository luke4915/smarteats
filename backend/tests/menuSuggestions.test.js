import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRules, publicRules } from '../utils/menuSuggestions.js';

const menu = [{ id: 1, category: 'Panini' }, { id: 2, category: 'Panini' }, { id: 12, category: 'Bevande' }];

test('dal testo salvato alle regole: quelle malformate si scartano, un testo rovinato non rompe nulla', () => {
  assert.deepEqual(parseRules('[{"category":"Panini","suggest":12},{"product":1,"suggest":12}]'), [{ category: 'Panini', suggest: 12 }, { product: 1, suggest: 12 }]);
  assert.deepEqual(parseRules('[{"suggest":12},{"category":"A","product":1,"suggest":2},{"category":"A","suggest":"x"},null]'), [], 'né «quando» né due «quando» né id non numerico');
  assert.deepEqual(parseRules('non è json'), []);
  assert.deepEqual(parseRules('{"a":1}'), []);
  assert.deepEqual(parseRules(undefined), []);
});

test('ai clienti arrivano solo le regole con il prodotto da proporre in menu e il «quando» ancora esistente', () => {
  const rules = [
    { category: 'Panini', suggest: 12 },        // va bene
    { product: 1, suggest: 12 },                // va bene
    { category: 'Dolci', suggest: 12 },         // nessun prodotto «Dolci» in menu
    { category: 'Panini', suggest: 99 },        // il prodotto proposto è nascosto o eliminato
    { product: 77, suggest: 12 },               // il prodotto «quando» non c'è
    { product: 2, suggest: 2 },                 // non si propone se stesso
  ];
  assert.deepEqual(publicRules(rules, menu), [{ category: 'Panini', suggest: 12 }, { product: 1, suggest: 12 }]);
});
