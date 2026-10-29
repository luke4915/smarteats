import test from 'node:test';
import assert from 'node:assert/strict';
import { festivalSections } from './sections.js';

const ids = (user) => festivalSections(user).map(s => s.id);

test('l\'admin vede tutto, l\'asporto solo se il modulo è acceso', () => {
  assert.deepEqual(ids({ role: 'admin', modules: ['kds', 'stats'] }), ['device', 'menu', 'printing', 'reserved', 'account']);
  assert.deepEqual(ids({ role: 'admin', modules: ['takeaway'] }), ['device', 'takeaway', 'menu', 'printing', 'reserved', 'account']);
});

test('il responsabile ha anche l\'account, ma non l\'asporto da configurare', () => {
  assert.deepEqual(ids({ role: 'manager', modules: ['takeaway'] }), ['device', 'menu', 'printing', 'account']);
});

test('la cassa lavora con il dispositivo, il menu e la stampa: niente account', () => {
  assert.deepEqual(ids({ role: 'cashier', modules: ['takeaway'] }), ['device', 'menu', 'printing']);
});

test('la cucina non ha impostazioni', () => {
  assert.deepEqual(ids({ role: 'kitchen', modules: ['kds'] }), []);
});

test('l\'IVA predefinita compare solo all\'admin nella modalità magazzino', () => {
  const warehouse = { mode: 'warehouse', depletion: 'recipes' };
  assert.equal(ids({ role: 'admin', modules: ['inventory'], inventory: warehouse }).includes('inventory'), true);
  assert.equal(ids({ role: 'admin', modules: ['inventory'], inventory: { mode: 'portions' } }).includes('inventory'), false);
  assert.equal(ids({ role: 'manager', modules: ['inventory'], inventory: warehouse }).includes('inventory'), false);
});
