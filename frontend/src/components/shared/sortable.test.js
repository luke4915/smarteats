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

test('la transizione è solo durante il trascinamento: a riposo no, altrimenti al rilascio le righe saltano', async () => {
  const { rowTransition } = await import('./sortable.js');
  assert.equal(rowTransition(null, false), 'none', 'a riposo: nessuna animazione');
  assert.equal(rowTransition({ settling: false }, true), 'none', 'la riga che si trascina segue il dito senza ritardo');
  assert.equal(rowTransition({ settling: false }, false), 'transform 180ms ease', 'le altre righe si scostano con dolcezza');
  assert.equal(rowTransition({ settling: true }, true), 'transform 180ms ease', 'la riga lasciata scivola nel suo posto');
});
