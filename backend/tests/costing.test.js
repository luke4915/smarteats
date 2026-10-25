import test from 'node:test';
import assert from 'node:assert/strict';
import { nextAverageCost, lineAmounts, receiptTotals } from '../utils/inventory/costing.js';

test('il costo medio ponderato fra ciò che c\'è e ciò che arriva', () => {
  // 1000 g a 0,20 c/g + 3000 g a 0,60 c/g = (200 + 1800) / 4000 = 0,5
  assert.equal(nextAverageCost({ onHand: 1000, averageCost: 0.2, addedQuantity: 3000, addedUnitCost: 0.6 }), 0.5);
});

test('con la dispensa vuota il costo è quello del carico', () => {
  assert.equal(nextAverageCost({ onHand: 0, averageCost: 9, addedQuantity: 500, addedUnitCost: 0.3 }), 0.3);
});

test('una dispensa in negativo (vendite forzate) conta come vuota: nessun costo falso', () => {
  assert.equal(nextAverageCost({ onHand: -200, averageCost: 9, addedQuantity: 500, addedUnitCost: 0.3 }), 0.3);
});

test('un carico di zero non cambia il costo', () => {
  assert.equal(nextAverageCost({ onHand: 0, averageCost: 0.4, addedQuantity: 0, addedUnitCost: 0 }), 0.4);
});

test('una riga: da confezioni a unità di base e costo della riga', () => {
  // 2,5 casse da 12 bottiglie da 750 ml, 18,00 € a cassa
  assert.deepEqual(lineAmounts({ quantity: 2.5, baseUnitsPerPurchaseUnit: 9000, unitCostCents: 1800 }), { baseQuantity: 22500, lineCostCents: 4500 });
});

test('totali del carico: senza IVA, IVA e con IVA, riga per riga', () => {
  const lines = [{ lineCostCents: 1000, vatRate: 10 }, { lineCostCents: 2000, vatRate: 22 }, { lineCostCents: 500, vatRate: null }];
  assert.deepEqual(receiptTotals(lines), { netCents: 3500, vatCents: 100 + 440, grossCents: 4040 });
});
