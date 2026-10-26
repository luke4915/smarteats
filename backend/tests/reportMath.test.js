import test from 'node:test';
import assert from 'node:assert/strict';
import { netOfVat, dishFigures, overviewFigures, inventoryValueCents, valueCents, daysOfStock } from '../utils/inventory/reportMath.js';

test('dal prezzo con IVA al netto', () => {
  assert.equal(netOfVat(1100, 10), 1000);
  assert.equal(netOfVat(1000, 0), 1000);
  assert.equal(netOfVat(1220, 22), 1000);
});

test('un piatto con ricetta: ricavo netto, margine e food cost', () => {
  // 10 pizze a 7,00 € con IVA 10% = 70,00 € lordi = 63,64 € netti; costo teorico 20,00 €
  const f = dishFigures({ grossCents: 7000, grossWithCostCents: 7000, costCents: 2000, vatRate: 10 });
  assert.deepEqual([f.netCents, f.marginCents, f.foodCostPercent, f.hasRecipe], [6364, 4364, 31.4, true]);
});

test('un piatto senza ricetta: solo il ricavo, nessun margine inventato', () => {
  const f = dishFigures({ grossCents: 700, grossWithCostCents: 0, costCents: null, vatRate: 10 });
  assert.deepEqual([f.netCents, f.hasRecipe, f.marginCents, f.foodCostPercent], [636, false, null, null]);
});

test('il quadro del periodo somma i piatti e dice quanto ricavo ha una ricetta', () => {
  const dishes = [
    { netCents: 6000, netWithCostCents: 6000, costCents: 1800, hasRecipe: true },
    { netCents: 4000, netWithCostCents: 0, costCents: null, hasRecipe: false },
  ];
  assert.deepEqual(overviewFigures(dishes), { netCents: 10000, costCents: 1800, marginCents: 4200, foodCostPercent: 30, recipeCoveragePercent: 60 });
  assert.equal(overviewFigures([]).foodCostPercent, null);
});

test('il valore della dispensa: quantità per costo medio, senza i negativi', () => {
  assert.equal(inventoryValueCents([{ quantity_on_hand: '1000', weighted_average_cost: '0.2' }, { quantity_on_hand: '-50', weighted_average_cost: '9' }, { quantity_on_hand: '24', weighted_average_cost: '40' }]), 200 + 960);
  assert.equal(valueCents(250, 0.6), 150);
});

test('i giorni di scorta al consumo medio', () => {
  assert.equal(daysOfStock(1000, 700, 7), 10);
  assert.equal(daysOfStock(1000, 0, 7), null);
  assert.equal(daysOfStock(-5, 70, 7), 0);
});
