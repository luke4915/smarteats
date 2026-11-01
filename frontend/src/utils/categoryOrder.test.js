import test from 'node:test';
import assert from 'node:assert/strict';
import { sortByCategoryOrder, categoriesInOrder } from './categoryOrder.js';

const P = (id, category) => ({ id, category });
const ids = (l) => l.map(p => p.id);

test('stessa regola del server: ordine scelto, categorie nuove dopo, ordine interno invariato', () => {
  const list = [P(1, 'Caffè'), P(2, 'Antipasti'), P(3, 'Antipasti'), P(4, 'Zuppe'), P(5, 'Bevande')];
  assert.deepEqual(ids(sortByCategoryOrder(list, ['Bevande', 'Antipasti'])), [5, 2, 3, 1, 4]);
  assert.deepEqual(ids(sortByCategoryOrder(list, [])), [1, 2, 3, 4, 5]);
  assert.deepEqual(ids(list), [1, 2, 3, 4, 5], 'non cambia l\'elenco ricevuto');
});

test('le categorie dell\'elenco, nell\'ordine in cui compaiono; senza categoria è «Generico»', () => {
  assert.deepEqual(categoriesInOrder([P(1, 'B'), P(2, 'A'), P(3, 'B'), P(4, null)]), ['B', 'A', 'Generico']);
});
