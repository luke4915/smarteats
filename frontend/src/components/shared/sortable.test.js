import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reorder, nearestIndex, shiftFor } from './sortable.js';

test('riordino: sposta una riga, senza toccare l\'originale; fuori dai limiti non fa nulla', () => {
  const list = ['a', 'b', 'c', 'd'];
  assert.deepEqual(reorder(list, 0, 2), ['b', 'c', 'a', 'd']);
  assert.deepEqual(reorder(list, 3, 0), ['d', 'a', 'b', 'c']);
  assert.equal(reorder(list, 1, 1), list);
  assert.equal(reorder(list, 0, 9), list);
  assert.deepEqual(list, ['a', 'b', 'c', 'd']);
});

test('la riga più vicina alla posizione del dito', () => {
  assert.equal(nearestIndex([50, 150, 250], 10), 0);
  assert.equal(nearestIndex([50, 150, 250], 190), 1);
  assert.equal(nearestIndex([50, 150, 250], 400), 2);
});

test('le righe in mezzo si scostano per far posto, le altre restano ferme', () => {
  // trascino la riga 0 sopra la 2: la 1 e la 2 salgono
  assert.deepEqual([0, 1, 2, 3].map(i => shiftFor(i, 0, 2, 40)), [0, -40, -40, 0]);
  // trascino la 3 sopra la 1: la 1 e la 2 scendono
  assert.deepEqual([0, 1, 2, 3].map(i => shiftFor(i, 3, 1, 40)), [0, 40, 40, 0]);
  assert.deepEqual([0, 1, 2].map(i => shiftFor(i, 1, 1, 40)), [0, 0, 0]);
});
