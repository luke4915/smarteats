import test from 'node:test';
import assert from 'node:assert/strict';
import { addCash, exactCash } from './cash.js';

test('i tagli si sommano: prima 20 e poi 5 fanno 25', () => {
  assert.equal(addCash('', 20), '20');
  assert.equal(addCash('20', 5), '25');
  assert.equal(addCash('25', 50), '75');
});

test('si parte da un importo scritto a mano, anche con la virgola', () => {
  assert.equal(addCash('12.5', 5), '17.5');
  assert.equal(addCash('12,5', 5), '17.5');
});

test('nessun errore di virgola mobile', () => {
  assert.equal(addCash('0.1', 0.2), '0.3');
  assert.equal(addCash('10.05', 5), '15.05');
});

test('«Esatto» è il totale scritto in modo pulito', () => {
  assert.equal(exactCash(8), '8');
  assert.equal(exactCash(7.5), '7.5');
  assert.equal(exactCash(12.35), '12.35');
});
