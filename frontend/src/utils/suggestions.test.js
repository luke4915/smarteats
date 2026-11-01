import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickSuggestion } from './suggestions.js';

const products = [
  { id: 1, name: 'Panino', category: 'Panini' }, { id: 2, name: 'Hamburger', category: 'Panini' },
  { id: 12, name: 'Birra', category: 'Bevande' }, { id: 13, name: 'Acqua', category: 'Bevande' },
];
const rules = [{ category: 'Panini', suggest: 12 }, { product: 2, suggest: 13 }];

test('a carrello vuoto non si suggerisce nulla', () => assert.equal(pickSuggestion(rules, products, {}), null));

test('chi sceglie un panino riceve la birra; chi sceglie solo una bevanda niente', () => {
  assert.equal(pickSuggestion(rules, products, { 1: 1 })?.id, 12);
  assert.equal(pickSuggestion(rules, products, { 13: 2 }), null);
});

test('un prodotto già nel carrello o già scartato non si propone più', () => {
  assert.equal(pickSuggestion(rules, products, { 1: 1, 12: 1 }), null);
  assert.equal(pickSuggestion(rules, products, { 1: 1 }, [12]), null);
});

test('la regola su un prodotto scatta solo per quel prodotto; passa alla regola successiva se la prima non vale', () => {
  assert.equal(pickSuggestion([{ product: 2, suggest: 13 }], products, { 1: 1 }), null);
  assert.equal(pickSuggestion([{ product: 2, suggest: 13 }], products, { 2: 1 })?.id, 13);
  assert.equal(pickSuggestion(rules, products, { 2: 1 }, [12])?.id, 13, 'la birra è scartata: tocca all\'acqua');
});

test('senza regole o con un prodotto proposto che non è in menu: nessun suggerimento', () => {
  assert.equal(pickSuggestion([], products, { 1: 1 }), null);
  assert.equal(pickSuggestion(undefined, products, { 1: 1 }), null);
  assert.equal(pickSuggestion([{ category: 'Panini', suggest: 99 }], products, { 1: 1 }), null);
});
