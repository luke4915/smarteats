import test from 'node:test';
import assert from 'node:assert/strict';
import { unitsFor, parseDecimal, toBaseQuantity, toDisplayQuantity, formatQuantity, formatCostPerUnit, formatCents, formatPercent } from './units.js';

test('le unità tra cui scegliere dipendono dall\'unità di base', () => {
  assert.deepEqual(unitsFor('g').map(u => u.id), ['g', 'kg']);
  assert.deepEqual(unitsFor('ml').map(u => u.id), ['ml', 'cl', 'l']);
  assert.deepEqual(unitsFor('pc').map(u => u.id), ['pc']);
});

test('si digita con la virgola o col punto; un testo che non è un numero vale null', () => {
  assert.equal(parseDecimal('1,5'), 1.5);
  assert.equal(parseDecimal(' 2.25 '), 2.25);
  assert.equal(parseDecimal(''), null);
  assert.equal(parseDecimal('ciao'), null);
});

test('dall\'unità digitata alla base: 1,5 kg sono 1500 g, 33 cl sono 330 ml', () => {
  assert.equal(toBaseQuantity(1.5, 'kg'), 1500);
  assert.equal(toBaseQuantity(33, 'cl'), 330);
  assert.equal(toBaseQuantity(0.2, 'l'), 200);
});

test('dalla base alla forma più leggibile', () => {
  assert.deepEqual(toDisplayQuantity(1500, 'g'), { value: 1.5, unit: 'kg' });
  assert.deepEqual(toDisplayQuantity(800, 'g'), { value: 800, unit: 'g' });
  assert.deepEqual(toDisplayQuantity(2000, 'ml'), { value: 2, unit: 'l' });
  assert.deepEqual(toDisplayQuantity(0, 'g'), { value: 0, unit: 'g' });
});

test('il testo mostrato a chi legge', () => {
  assert.equal(formatQuantity(1500, 'g'), '1,5 kg');
  assert.equal(formatQuantity(3, 'pc'), '3 pz');
  assert.equal(formatQuantity(-250, 'g'), '-250 g');
});

test('costi in euro: il costo per grammo diventa €/kg', () => {
  assert.equal(formatCostPerUnit(0.2, 'g').replace(/\s/g, ' '), '2,00 €/kg');
  assert.equal(formatCents(129).replace(/\s/g, ' '), '1,29 €');
});

test('la percentuale a parole', () => {
  assert.equal(formatPercent(26.4), '26,4%');
  assert.equal(formatPercent(30), '30%');
  assert.equal(formatPercent(null), '—');
});
