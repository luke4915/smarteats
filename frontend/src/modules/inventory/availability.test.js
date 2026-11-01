import test from 'node:test';
import assert from 'node:assert/strict';
import { canForceSale, toPortionsMap, ingredientPortionsLeft, isIngredientOut, tighterLimit } from './availability.js';

const portions = toPortionsMap([{ product_id: 1, ingredient_portions: 3 }, { product_id: 2, ingredient_portions: 0 }, { product_id: 3, ingredient_portions: null }]);

test('solo amministratore e responsabile vendono comunque', () => {
  assert.equal(canForceSale('admin'), true);
  assert.equal(canForceSale('manager'), true);
  for (const role of ['cashier', 'waiter', 'kitchen', undefined]) assert.equal(canForceSale(role), false);
});

test('le porzioni che restano scalano con ciò che è già nel carrello', () => {
  assert.equal(ingredientPortionsLeft(portions, 1, 0), 3);
  assert.equal(ingredientPortionsLeft(portions, 1, 2), 1);
  assert.equal(ingredientPortionsLeft(portions, 1, 5), 0, 'mai sotto zero');
  assert.equal(ingredientPortionsLeft(portions, 3, 4), null, 'senza ricetta non c\'è limite');
  assert.equal(ingredientPortionsLeft(portions, 99, 1), null, 'un piatto che il server non elenca non ha limite');
});

test('esaurito quando gli ingredienti non bastano per un\'altra porzione', () => {
  assert.equal(isIngredientOut(portions, 2), true);
  assert.equal(isIngredientOut(portions, 1, 3), true);
  assert.equal(isIngredientOut(portions, 1, 2), false);
  assert.equal(isIngredientOut(portions, 3, 10), false);
});

test('fra porzioni contate e ingredienti vale il limite più stretto', () => {
  assert.equal(tighterLimit(null, null), null);
  assert.equal(tighterLimit(4, null), 4);
  assert.equal(tighterLimit(null, 2), 2);
  assert.equal(tighterLimit(4, 2), 2);
});
