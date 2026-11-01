import test from 'node:test';
import assert from 'node:assert/strict';
import { blankRow, rowsFromLines, unitAfterChoosing, recipeProblem, linesFromRows, optionRowsFromLines, optionLinesFromRows } from './recipeLines.js';

const ingredients = [{ id: 1, name: 'Farina', base_unit: 'g' }, { id: 2, name: 'Latte', base_unit: 'ml' }];
const preparations = [{ id: 7, name: 'Sugo', base_unit: 'g' }];
const row = (ref, text, unit = 'g') => ({ key: 'x', ref, text, unit });

test('dalle righe del server a quelle da mostrare: 1500 g si leggono 1,5 kg', () => {
  const rows = rowsFromLines([{ ingredient_id: 1, component_preparation_id: null, quantity: 1500 }, { ingredient_id: null, component_preparation_id: 7, quantity: 200 }], ingredients, preparations);
  assert.deepEqual(rows.map(r => [r.ref, r.text, r.unit]), [['i1', '1,5', 'kg'], ['p7', '200', 'g']]);
});

test('dalle righe a schermo al server: la quantità torna nell\'unità di base', () => {
  assert.deepEqual(linesFromRows([row('i1', '1,5', 'kg'), row('p7', '200')]), [
    { ingredient_id: 1, component_preparation_id: null, quantity: 1500 }, { ingredient_id: null, component_preparation_id: 7, quantity: 200 }]);
});

test('cosa manca per salvare', () => {
  assert.equal(recipeProblem([row('i1', '200')], ingredients, preparations), null);
  assert.ok(recipeProblem([blankRow()], ingredients, preparations));
  assert.ok(recipeProblem([row('i1', '')], ingredients, preparations));
  assert.ok(recipeProblem([row('i1', '0')], ingredients, preparations));
  assert.ok(recipeProblem([row('i1', '5'), row('i1', '6')], ingredients, preparations), 'doppione');
  assert.ok(recipeProblem([row('i99', '5')], ingredients, preparations), 'ingrediente che non esiste più');
});

test('cambiando ingrediente l\'unità resta una delle sue', () => {
  assert.equal(unitAfterChoosing('i2', 'kg', ingredients, preparations), 'ml');
  assert.equal(unitAfterChoosing('i1', 'kg', ingredients, preparations), 'kg');
  assert.equal(unitAfterChoosing('', 'kg', ingredients, preparations), 'kg');
});

test('le opzioni hanno un segno: «senza» toglie, «extra» aggiunge', () => {
  const rows = optionRowsFromLines([{ ingredient_id: 1, quantity_change: -50 }, { ingredient_id: 2, quantity_change: 1500 }], ingredients);
  assert.deepEqual(rows.map(r => [r.ref, r.text, r.unit, r.sign]), [['i1', '50', 'g', -1], ['i2', '1,5', 'l', 1]]);
  assert.deepEqual(optionLinesFromRows([{ ref: 'i1', text: '50', unit: 'g', sign: -1 }, { ref: 'i2', text: '2', unit: 'cl', sign: 1 }]), [{ ingredient_id: 1, quantity_change: -50 }, { ingredient_id: 2, quantity_change: 20 }]);
});
