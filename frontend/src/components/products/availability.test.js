import test from 'node:test';
import assert from 'node:assert/strict';
import { modeOf, stateLabel, startQuantity, quantityProblem, stockPatch, savedMessage, isChange } from './availability.js';

const base = { id: 1, name: 'Panino', stock_enabled: false, stock: null };

test('lo stato si legge da stock e stock_enabled: senza limite, porzioni, esaurito', () => {
  assert.equal(modeOf(base), 'unlimited');
  assert.equal(modeOf({ ...base, stock_enabled: true, stock: 8 }), 'portions');
  assert.equal(modeOf({ ...base, stock_enabled: true, stock: 0 }), 'soldout');
  assert.equal(modeOf({ ...base, stock_enabled: true, stock: null }), 'unlimited', 'limite acceso ma senza numero: non si conta');
  assert.equal(modeOf({ ...base, stock: 5 }), 'unlimited', 'con il limite spento la scorta vecchia non conta');
});

test('le parole dello stato', () => {
  assert.equal(stateLabel(base), 'Disponibile');
  assert.equal(stateLabel({ ...base, stock_enabled: true, stock: 0 }), 'Esaurito');
  assert.equal(stateLabel({ ...base, stock_enabled: true, stock: 1 }), 'Ne resta 1');
  assert.equal(stateLabel({ ...base, stock_enabled: true, stock: 12 }), '12 rimaste');
});

test('il campo delle porzioni parte dal numero di adesso, o vuoto', () => {
  assert.equal(startQuantity({ ...base, stock_enabled: true, stock: 12 }), '12');
  assert.equal(startQuantity(base), '');
  assert.equal(startQuantity({ ...base, stock_enabled: true, stock: 0 }), '', 'esaurito: si riparte da zero, non da «0»');
});

test('con le porzioni serve un intero da 1 in su; gli altri stati non chiedono nulla', () => {
  assert.equal(quantityProblem('portions', '8'), null);
  assert.equal(quantityProblem('portions', ' 8 '), null);
  for (const bad of ['', '0', '-3', '2,5', 'abc']) assert.ok(quantityProblem('portions', bad), `«${bad}» non va`);
  assert.equal(quantityProblem('unlimited', ''), null);
  assert.equal(quantityProblem('soldout', ''), null);
});

test('il corpo per il server: la forma che stockSchema accetta', () => {
  assert.deepEqual(stockPatch('unlimited', ''), { stock_enabled: false, stock: null });
  assert.deepEqual(stockPatch('soldout', ''), { stock_enabled: true, stock: 0 });
  assert.deepEqual(stockPatch('portions', ' 7 '), { stock_enabled: true, stock: 7 });
});

test('i messaggi dopo il salvataggio', () => {
  assert.equal(savedMessage('Panino', 'soldout'), '«Panino» segnato esaurito');
  assert.equal(savedMessage('Panino', 'unlimited'), '«Panino» di nuovo disponibile');
  assert.equal(savedMessage('Panino', 'portions', '1'), '«Panino»: ne resta 1');
  assert.equal(savedMessage('Panino', 'portions', '9'), '«Panino»: ne restano 9');
});

test('«Applica» serve solo se qualcosa cambia', () => {
  const eight = { ...base, stock_enabled: true, stock: 8 };
  assert.equal(isChange(base, 'unlimited', ''), false);
  assert.equal(isChange(base, 'soldout', ''), true);
  assert.equal(isChange(eight, 'portions', '8'), false);
  assert.equal(isChange(eight, 'portions', '9'), true);
  assert.equal(isChange(eight, 'unlimited', ''), true);
});
