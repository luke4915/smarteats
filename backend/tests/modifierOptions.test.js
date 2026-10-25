import test from 'node:test';
import assert from 'node:assert/strict';
import { planOptionChanges } from '../utils/modifierOptions.js';

const existing = [{ id: 10 }, { id: 11 }, { id: 12 }];

test('le opzioni che tornano con il loro id si aggiornano e l\'id resta', () => {
  const plan = planOptionChanges(existing, [{ id: 11, name: 'Media', price_delta: 0 }, { id: 10, name: 'Al sangue', price_delta: 0.5 }, { id: 12, name: 'Ben cotta', price_delta: 0 }]);
  assert.deepEqual(plan.update.map(o => [o.id, o.position]), [[11, 0], [10, 1], [12, 2]]);
  assert.deepEqual([plan.insert, plan.remove], [[], []]);
});

test('un\'opzione senza id è nuova; una che non torna si toglie', () => {
  const plan = planOptionChanges(existing, [{ id: 10, name: 'A', price_delta: 0 }, { name: 'Nuova', price_delta: 1 }]);
  assert.deepEqual(plan.insert, [{ name: 'Nuova', price_delta: 1, position: 1 }]);
  assert.deepEqual(plan.remove, [11, 12]);
});

test('un id che non è del gruppo, o ripetuto, si rifiuta', () => {
  assert.throws(() => planOptionChanges(existing, [{ id: 999, name: 'X', price_delta: 0 }]), (e) => e.status === 400 && e.code === 'INVALID_OPTION');
  assert.throws(() => planOptionChanges(existing, [{ id: 10, name: 'X', price_delta: 0 }, { id: 10, name: 'Y', price_delta: 0 }]), (e) => e.status === 400);
});
