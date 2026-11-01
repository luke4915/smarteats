import test from 'node:test';
import assert from 'node:assert/strict';
import { reasonText, entryQuantity, countDifference, stockLevelPayload, movementProblem, movementPayload, usagePayload, kindLabel, differenceText, reportRange } from './controls.js';

test('il motivo nel registro si legge in italiano', () => {
  assert.equal(reasonText('expired: scaduta ieri'), 'Scaduto · scaduta ieri');
  assert.equal(reasonText('broken'), 'Rotto o caduto');
  assert.equal(reasonText('errore nel carico'), 'errore nel carico');
  assert.equal(reasonText('closing'), 'Fine servizio');
  assert.equal(reasonText('order_canceled'), 'Ordine stornato');
  assert.equal(reasonText(null), '');
  assert.equal(kindLabel('stock_level'), 'Controllo');
});

test('una quantità scritta diventa quantità di base; una riga vuota no', () => {
  assert.equal(entryQuantity({ text: '1,5', unit: 'kg' }), 1500);
  assert.equal(entryQuantity({ text: '', unit: 'g' }), null);
  assert.equal(entryQuantity({ text: 'abc', unit: 'g' }), null);
});

test('la differenza del conteggio: manca (−) o avanza (+)', () => {
  assert.equal(countDifference({ text: '9,5', unit: 'kg' }, 9750), -250);
  assert.equal(countDifference({ text: '', unit: 'kg' }, 9750), null);
});

test('il controllo manda solo gli ingredienti contati', () => {
  const ingredients = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const entries = { 1: { text: '9,5', unit: 'kg' }, 2: { text: '', unit: 'g' }, 3: { text: '0', unit: 'g' } };
  assert.deepEqual(stockLevelPayload('closing', '  fine serata ', ingredients, entries), { kind: 'closing', notes: 'fine serata', lines: [{ ingredient_id: 1, counted_quantity: 9500 }, { ingredient_id: 3, counted_quantity: 0 }] });
  assert.deepEqual(stockLevelPayload('periodic', '', ingredients, {}).lines, []);
});

test('scarto e rettifica: cosa manca e cosa si manda', () => {
  const waste = { type: 'waste', ingredient_id: '4', text: '500', unit: 'g', reason: 'expired', note: '', direction: 'remove' };
  assert.equal(movementProblem(waste), null);
  assert.deepEqual(movementPayload(waste), { type: 'waste', ingredient_id: 4, quantity: 500, reason: 'expired' });
  assert.match(movementProblem({ ...waste, ingredient_id: '' }), /ingrediente/);
  assert.match(movementProblem({ ...waste, text: '0' }), /maggiore di zero/);
  const adjustment = { ...waste, type: 'adjustment', note: 'errore nel carico' };
  assert.equal(movementPayload({ ...adjustment, direction: 'remove' }).quantity_change, -500);
  assert.equal(movementPayload({ ...adjustment, direction: 'add' }).quantity_change, 500);
  assert.match(movementProblem({ ...adjustment, note: ' a ' }), /motivo/);
});

test('lo scarico di fine servizio: usato o rimasto', () => {
  const ingredients = [{ id: 1 }, { id: 2 }];
  const entries = { 1: { text: '300', unit: 'g' }, 2: { text: '' , unit: 'ml' } };
  assert.deepEqual(usagePayload('used', ingredients, entries), { lines: [{ ingredient_id: 1, used: 300 }] });
  assert.deepEqual(usagePayload('remaining', ingredients, entries), { lines: [{ ingredient_id: 1, remaining: 300 }] });
});

test('la differenza a parole', () => {
  assert.equal(differenceText(-250, 'g'), 'Manca 250 g');
  assert.equal(differenceText(1500, 'g'), 'Avanza 1,5 kg');
  assert.equal(differenceText(0, 'g'), 'Torna');
  assert.equal(differenceText(null, 'g'), '');
});

test('il periodo del report: un giorno o il mese intero', () => {
  assert.deepEqual(reportRange('day', '2026-10-25', '2026-10'), { from: '2026-10-25', to: '2026-10-25' });
  assert.deepEqual(reportRange('month', '2026-10-25', '2026-02'), { from: '2026-02-01', to: '2026-02-28' });
  assert.deepEqual(reportRange('month', '', '2026-12'), { from: '2026-12-01', to: '2026-12-31' });
});
