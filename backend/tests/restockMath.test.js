import test from 'node:test';
import assert from 'node:assert/strict';
import { needsRestock, pricePerBaseUnit, priceChangePercent } from '../utils/inventory/restockMath.js';

test('da riordinare: solo con una scorta minima e a quella soglia o sotto', () => {
  assert.equal(needsRestock(900, 1500), true);
  assert.equal(needsRestock(1500, 1500), true);
  assert.equal(needsRestock(1501, 1500), false);
  assert.equal(needsRestock(0, null), false, 'senza soglia non si avvisa mai');
  assert.equal(needsRestock('-20', '0'), true, 'anche in negativo');
});

test('il prezzo per unità di base', () => {
  assert.equal(pricePerBaseUnit(2500, 25000), 0.1);
  assert.equal(pricePerBaseUnit(1000, 3000), 0.3333);
  assert.equal(pricePerBaseUnit(100, 0), null);
});

test('la variazione di prezzo in percentuale', () => {
  assert.equal(priceChangePercent(0.1, 0.1125), 12.5);
  assert.equal(priceChangePercent(0.2, 0.18), -10);
  assert.equal(priceChangePercent(0.2, 0.2), 0);
  assert.equal(priceChangePercent(0, 0.2), null);
  assert.equal(priceChangePercent(null, 0.2), null);
});
