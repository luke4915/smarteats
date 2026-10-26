import test from 'node:test';
import assert from 'node:assert/strict';
import { needsOfRecipe, needsOfPortion, needsOfItems, costCentsOf, findShortages, portionsFromIngredients, usesItself } from '../utils/inventory/recipeNeeds.js';

// Un piccolo ristorante: spaghetti con sugo (preparazione) e vongole; la carne ha una resa dell'80%.
const ingredient = (id, name, onHand, extra = {}) => [id, { id, name, yield_percent: 100, quantity_on_hand: onHand, marked_out: false, weighted_average_cost: 0, ...extra }];
const makeBook = () => ({
  ingredients: new Map([
    ingredient(1, 'Spaghetti', 1000, { weighted_average_cost: 0.2 }),
    ingredient(2, 'Pomodoro', 2000, { weighted_average_cost: 0.1 }),
    ingredient(3, 'Vongole', 500, { weighted_average_cost: 1 }),
    ingredient(4, 'Manzo', 800, { yield_percent: 80, weighted_average_cost: 1.5 }),
    ingredient(5, 'Cipolla', 300),
    ingredient(6, 'Mozzarella', 400),
  ]),
  preparations: new Map([[100, { id: 100, output_quantity: 1000, lines: [{ ingredient_id: 2, quantity: 800 }, { ingredient_id: 5, quantity: 100 }] }]]),   // 1 kg di sugo
  productLines: new Map([
    [10, [{ ingredient_id: 1, quantity: 100 }, { ingredient_id: 3, quantity: 150 }, { component_preparation_id: 100, quantity: 200 }]],   // spaghetti
    [11, [{ ingredient_id: 4, quantity: 200 }, { ingredient_id: 5, quantity: 30 }]],                                                      // tagliata
  ]),
  modifierLines: new Map([
    [50, { affects_stock: true, lines: [{ ingredient_id: 6, quantity_change: 50 }] }],                 // extra mozzarella
    [51, { affects_stock: true, lines: [{ ingredient_id: 5, quantity_change: -50 }] }],                // senza cipolla
    [52, { affects_stock: false, lines: [{ ingredient_id: 6, quantity_change: 50 }] }],                // opzione che non scala
  ]),
});
const obj = (map) => Object.fromEntries([...map].map(([id, q]) => [id, Math.round(q * 1000) / 1000]));

test('una ricetta con ingredienti e una preparazione: la preparazione si scala in proporzione', () => {
  // 200 g di sugo = 0,2 dose: 160 g di pomodoro e 20 g di cipolla
  assert.deepEqual(obj(needsOfRecipe(makeBook().productLines.get(10), makeBook())), { 1: 100, 3: 150, 2: 160, 5: 20 });
});

test('la resa: per avere 200 g di carne utilizzabile ne servono 250 g', () => {
  assert.equal(needsOfRecipe(makeBook().productLines.get(11), makeBook()).get(4), 250);
});

test('le opzioni aggiungono e tolgono; quella che non scala il magazzino si ignora', () => {
  const book = makeBook();
  assert.equal(needsOfPortion(10, [50], book).get(6), 50);
  assert.equal(needsOfPortion(10, [52], book).has(6), false);
});

test('«senza» non fa mai scendere sotto zero: l\'ingrediente sparisce dai bisogni', () => {
  assert.equal(needsOfPortion(11, [51], makeBook()).has(5), false);
});

test('un piatto senza ricetta non scala nulla', () => {
  assert.equal(needsOfPortion(999, [], makeBook()).size, 0);
});

test('un ordine: il totale somma le righe, ogni riga tiene il suo', () => {
  const { total, perLine } = needsOfItems([{ id: 10, quantity: 2, modifiers: [] }, { id: 11, quantity: 1, modifiers: [{ id: 50 }] }], makeBook());
  assert.equal(total.get(1), 200);
  assert.equal(total.get(5), 2 * 20 + 30);
  assert.equal(total.get(6), 50);
  assert.equal(perLine[0].get(3), 300);
  assert.equal(perLine[1].has(3), false);
});

test('il costo di una riga al costo medio di adesso, in centesimi', () => {
  const book = makeBook();
  const { perLine } = needsOfItems([{ id: 10, quantity: 1 }], book);
  // 100 g × 0,2 + 150 g × 1 + 160 g × 0,1 = 20 + 150 + 16 = 186
  assert.equal(costCentsOf(perLine[0], book), 186);
});

test('gli ingredienti che non bastano; uno segnato esaurito non basta mai', () => {
  const book = makeBook();
  const { total } = needsOfItems([{ id: 10, quantity: 4, modifiers: [] }], book);     // 600 g di vongole, ne ho 500
  assert.deepEqual(findShortages(total, book).map(s => [s.ingredient.name, s.needed, s.available]), [['Vongole', 600, 500]]);
  book.ingredients.get(1).marked_out = true;
  assert.deepEqual(findShortages(total, book).map(s => s.ingredient.name), ['Spaghetti', 'Vongole']);
});

test('quante porzioni si possono fare: il limite è l\'ingrediente che finisce prima', () => {
  const book = makeBook();
  assert.equal(portionsFromIngredients(10, book), 3);         // vongole: 500 / 150
  book.ingredients.get(3).quantity_on_hand = 149;
  assert.equal(portionsFromIngredients(10, book), 0);
  assert.equal(portionsFromIngredients(999, book), null, 'senza ricetta nessun limite dagli ingredienti');
});

test('una dispensa in negativo (vendite forzate) vale zero porzioni', () => {
  const book = makeBook();
  book.ingredients.get(3).quantity_on_hand = -40;
  assert.equal(portionsFromIngredients(10, book), 0);
});

test('una preparazione che usa se stessa si riconosce, anche passando da un\'altra', () => {
  const preparations = new Map([[1, { lines: [{ ingredient_id: 1, quantity: 1 }] }], [2, { lines: [{ component_preparation_id: 1, quantity: 1 }] }]]);
  assert.equal(usesItself(1, [{ component_preparation_id: 2, quantity: 1 }], preparations), true);
  assert.equal(usesItself(1, [{ component_preparation_id: 1, quantity: 1 }], preparations), true);
  assert.equal(usesItself(3, [{ component_preparation_id: 2, quantity: 1 }], preparations), false);
});

test('una ricetta circolare non manda in loop: errore chiaro', () => {
  const book = makeBook();
  book.preparations.set(100, { id: 100, output_quantity: 1, lines: [{ component_preparation_id: 100, quantity: 1 }] });
  assert.throws(() => needsOfRecipe([{ component_preparation_id: 100, quantity: 1 }], book), /circolare/);
});
