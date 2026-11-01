import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOrder, sortByCategoryOrder } from '../utils/categoryOrder.js';

const P = (id, category, name = `p${id}`) => ({ id, category, name });
const ids = (list) => list.map(p => p.id);

test('le categorie seguono l\'ordine scelto; dentro ognuna resta l\'ordine di arrivo', () => {
  const list = [P(1, 'Antipasti'), P(2, 'Antipasti'), P(3, 'Bevande'), P(4, 'Dolci'), P(5, 'Primi')];
  assert.deepEqual(ids(sortByCategoryOrder(list, ['Primi', 'Antipasti', 'Dolci', 'Bevande'])), [5, 1, 2, 4, 3]);
});

test('una categoria fuori elenco (nuova) va dopo, nell\'ordine in cui compare', () => {
  const list = [P(1, 'Caffè'), P(2, 'Antipasti'), P(3, 'Zuppe'), P(4, 'Bevande')];
  assert.deepEqual(ids(sortByCategoryOrder(list, ['Bevande', 'Antipasti'])), [4, 2, 1, 3]);
});

test('senza ordine scelto non cambia nulla; un prodotto senza categoria sta in «Generico»', () => {
  const list = [P(1, 'B'), P(2, 'A'), P(3, null)];
  assert.deepEqual(ids(sortByCategoryOrder(list, [])), [1, 2, 3]);
  assert.deepEqual(ids(sortByCategoryOrder(list, ['Generico'])), [3, 1, 2]);
});

test('non cambia l\'elenco ricevuto', () => {
  const list = [P(1, 'B'), P(2, 'A')];
  sortByCategoryOrder(list, ['A', 'B']);
  assert.deepEqual(ids(list), [1, 2]);
});

test('un valore salvato rovinato vale «nessun ordine»', () => {
  assert.deepEqual(parseOrder('["A","B"]'), ['A', 'B']);
  for (const bad of [undefined, '', 'non json', '{"a":1}', '5']) assert.deepEqual(parseOrder(bad), []);
  assert.deepEqual(parseOrder('["A",3,"",null,"B"]'), ['A', 'B']);
});
