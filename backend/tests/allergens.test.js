import test from 'node:test';
import assert from 'node:assert/strict';
import { ALLERGEN_IDS, normalizeAllergens } from '../utils/allergens.js';

test('sono i 14 allergeni dell\'allegato II, ognuno una volta', () => {
  assert.equal(ALLERGEN_IDS.length, 14);
  assert.equal(new Set(ALLERGEN_IDS).size, 14);
});

test('un elenco qualsiasi diventa solo allergeni validi, senza doppioni e nell\'ordine dell\'allegato', () => {
  assert.deepEqual(normalizeAllergens(['milk', 'gluten', 'milk', 'pollo', 7]), ['gluten', 'milk']);
  assert.deepEqual(normalizeAllergens(undefined), []);
  assert.deepEqual(normalizeAllergens('gluten'), []);
});
