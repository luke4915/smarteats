import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GROUPS, pointPosition, itemsOf, groupShare, valueLabel } from './matrixData.js';

const items = [
  { id: 1, name: 'A', quantity: 100, share: 50, valueCents: 500, klass: 'star' },
  { id: 2, name: 'B', quantity: 60, share: 30, valueCents: 200, klass: 'workhorse' },
  { id: 3, name: 'C', quantity: 40, share: 20, valueCents: 800, klass: 'puzzle' },
];

test('quattro gruppi, ognuno con un titolo e un consiglio', () => {
  assert.deepEqual(GROUPS.map(g => g.id), ['star', 'workhorse', 'puzzle', 'dog']);
  assert.ok(GROUPS.every(g => g.title && g.note && g.advice));
});

test('il gruppo prende i suoi prodotti e pesa sulle vendite quanto la somma delle loro quote', () => {
  assert.deepEqual(itemsOf(items, 'workhorse').map(i => i.name), ['B']);
  assert.equal(groupShare(items, 'star'), 50);
  assert.equal(groupShare(items, 'dog'), 0);
});

test('i punti stanno dentro il grafico, con un po\' d\'aria sopra il massimo', () => {
  const scale = { maxQuantity: 100, maxValue: 800 };
  const top = pointPosition(items[0], scale);
  assert.ok(top.x > 90 && top.x < 100);
  const highest = pointPosition(items[2], scale);
  assert.ok(highest.y > 85 && highest.y < 100);
  assert.deepEqual(pointPosition({ quantity: 0, valueCents: 0 }, scale), { x: 0, y: 0 });
  assert.equal(pointPosition({ quantity: 9999, valueCents: 9999 }, scale).x, 100, 'mai fuori dal riquadro');
});

test('l\'asse dice se si parla di margine o di ricavo', () => {
  assert.equal(valueLabel('margin'), 'Margine per pezzo');
  assert.equal(valueLabel('price'), 'Ricavo per pezzo');
});
