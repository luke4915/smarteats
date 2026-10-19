import test from 'node:test';
import assert from 'node:assert/strict';
import { minOf, maxOf, effectiveMin, seatsLabel, rangeBody, fitOf, fitCost } from './seats.js';

test('intervallo: il minimo manca = tavolo fisso; etichetta «4–6» o «4»', () => {
  assert.deepEqual([minOf({ seats: 4 }), maxOf({ seats: 4 })], [4, 4]);
  assert.equal(minOf({ seats: 6, seats_min: 4 }), 4);
  assert.equal(minOf({ seats: 6, seatsMin: 3 }), 3, 'anche con il nome usato nei candidati');
  assert.equal(seatsLabel({ seats: 6, seats_min: 4 }), '4–6');
  assert.equal(seatsLabel({ seats: 4 }), '4');
  assert.equal(seatsLabel({ seats: 4, seats_min: 4 }), '4');
});

test('un tavolo fisso non ha un minimo che conti; uno con intervallo sì', () => {
  assert.equal(effectiveMin({ seats: 4 }), 1);
  assert.equal(effectiveMin({ seats: 4, seats_min: 4 }), 1);
  assert.equal(effectiveMin({ seats: 6, seats_min: 4 }), 4);
});

test('un gruppo ci sta se non supera il massimo; sotto il minimo ci sta, con un costo', () => {
  assert.equal(fitOf(7, 4, 6), null, 'oltre il massimo: no');
  assert.deepEqual(fitOf(5, 4, 6), { waste: 1, shortfall: 0 }, 'nell\'intervallo');
  assert.deepEqual(fitOf(2, 4, 6), { waste: 4, shortfall: 2 }, 'sotto il minimo: si può, ma costa');
  assert.deepEqual(fitOf(6, 4, 6), { waste: 0, shortfall: 0 });
});

test('il costo: meglio il tavolo giusto; sotto il minimo pesa di più; ogni tavolo unito costa', () => {
  const small = fitCost(fitOf(3, 2, 4));          // 3 persone al «2–4»
  const large = fitCost(fitOf(3, 4, 6));          // 3 persone al «4–6»
  assert.ok(small < large);
  assert.ok(fitCost(fitOf(4, 4, 4)) < fitCost(fitOf(4, 4, 4), 2), 'unire un tavolo in più costa');
  assert.ok(fitCost(fitOf(2, 4, 4)) > fitCost(fitOf(2, 2, 4)), 'sotto il minimo costa più che dentro');
});

test('dal modulo ai dati: il minimo vuoto non si manda', () => {
  assert.deepEqual(rangeBody({ min: '', max: '4' }), { seats: 4 });
  assert.deepEqual(rangeBody({ min: '2', max: '4' }), { seats: 4, seats_min: 2 });
});
