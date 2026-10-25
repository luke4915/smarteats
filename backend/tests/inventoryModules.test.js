import test from 'node:test';
import assert from 'node:assert/strict';
import { inventoryOf, inventoryColumnsFor, firstModuleNotAllowed } from '../utils/modules.js';

test('il magazzino esiste per tutti i tipi di locale', () => {
  for (const type of ['street_food', 'restaurant', 'takeaway_shop']) assert.equal(firstModuleNotAllowed(type, ['inventory']), undefined, type);
});

test('modulo spento: nessuna modalità; acceso: quella scelta o il predefinito', () => {
  assert.equal(inventoryOf({ modules: ['kds'], inventory_mode: 'warehouse', inventory_depletion: 'simple' }), null);
  assert.deepEqual(inventoryOf({ modules: ['kds', 'inventory'], inventory_mode: 'warehouse', inventory_depletion: 'simple' }), { mode: 'warehouse', depletion: 'simple' });
  assert.deepEqual(inventoryOf({ modules: ['inventory'], inventory_mode: null, inventory_depletion: null }), { mode: 'portions', depletion: 'recipes' });
});

test('accendendo il modulo senza dire altro si parte da «porzioni» e «dalle ricette»', () => {
  assert.deepEqual(inventoryColumnsFor(['inventory'], undefined, null), { inventory_mode: 'portions', inventory_depletion: 'recipes' });
});

test('una scelta del master vale; il resto resta com\'era', () => {
  const current = { inventory_mode: 'warehouse', inventory_depletion: 'simple' };
  assert.deepEqual(inventoryColumnsFor(['inventory'], { mode: 'portions' }, current), { inventory_mode: 'portions', inventory_depletion: 'simple' });
  assert.deepEqual(inventoryColumnsFor(['inventory'], undefined, current), current);
});

test('spegnendo il modulo la modalità si svuota e la regola di scarico si ricorda', () => {
  assert.deepEqual(inventoryColumnsFor(['kds'], undefined, { inventory_mode: 'warehouse', inventory_depletion: 'simple' }), { inventory_mode: null, inventory_depletion: 'simple' });
});
