import test from 'node:test';
import assert from 'node:assert/strict';
import { blankForm, formFromProduct, cleanPriceInput, colorOfCategory, namesForCategory, findNameConflict, stockProblem, buildPayload, categoryColors } from './productForm.js';

const products = [
  { id: 1, name: 'Margherita', category: 'Pizze', color: '#ef4444', price: 7, visible: true, print_destination: 'kitchen', course_id: 3, stock_enabled: true, stock: 5 },
  { id: 2, name: 'Diavola', category: 'Pizze', color: '#ef4444', price: 9 },
  { id: 3, name: 'Acqua', category: 'Bevande', color: '#3b82f6', price: 2 },
];

test('un prodotto nuovo ha i campi del tipo di locale', () => {
  assert.deepEqual(Object.keys(blankForm()).sort(), ['category', 'color', 'name', 'price', 'print_destination', 'stock', 'stock_enabled', 'visible']);
  const full = blankForm({ courses: [], takeawayEnabled: true, modifierGroups: [] });
  assert.equal(full.course_id, null);
  assert.equal(full.takeaway_load, 1);
  assert.deepEqual(full.modifier_group_ids, []);
});

test('il modulo di un prodotto esistente riporta i suoi valori, con le opzioni collegate', () => {
  const form = formFromProduct(products[0], { courses: [], modifierGroups: [{ id: 9, product_ids: [1] }, { id: 8, product_ids: [2] }] });
  assert.deepEqual([form.name, form.price, form.course_id, form.stock_enabled, form.stock], ['Margherita', '7', 3, true, '5']);
  assert.deepEqual(form.modifier_group_ids, [9]);
});

test('il prezzo accetta la virgola e due decimali al massimo', () => {
  assert.equal(cleanPriceInput('12,5'), '12.5');
  assert.equal(cleanPriceInput('12.345'), null);
  assert.equal(cleanPriceInput('ab'), null);
  assert.equal(cleanPriceInput(''), '');
});

test('il colore della categoria è quello degli altri prodotti, senza distinguere le maiuscole', () => {
  assert.equal(colorOfCategory(products, ' pizze '), '#ef4444');
  assert.equal(colorOfCategory(products, 'Dolci'), null);
  assert.equal(colorOfCategory(products, '  '), null);
});

test('i nomi suggeriti sono quelli della categoria, o tutti se la categoria è nuova', () => {
  assert.deepEqual(namesForCategory(products, 'Pizze'), ['Margherita', 'Diavola']);
  assert.deepEqual(namesForCategory(products, 'Nuova'), ['Margherita', 'Diavola', 'Acqua']);
});

test('lo stesso nome nella stessa categoria è un doppione; in un\'altra categoria è un conflitto diverso', () => {
  assert.deepEqual(findNameConflict(products, { name: 'margherita', category: 'Pizze' }), { product: products[0], sameCategory: true });
  assert.deepEqual(findNameConflict(products, { name: 'Margherita', category: 'Dolci' }), { product: products[0], sameCategory: false });
  assert.equal(findNameConflict(products, { name: 'Calzone', category: 'Pizze' }), null);
});

test('modificando un prodotto, il suo stesso nome non è un conflitto', () => {
  assert.equal(findNameConflict(products, { name: 'Margherita', category: 'Pizze' }, 1), null);
});

test('la disponibilità limitata chiede una quantità valida', () => {
  assert.equal(stockProblem({ stock_enabled: false, stock: '' }), null);
  assert.ok(stockProblem({ stock_enabled: true, stock: '' }));
  assert.ok(stockProblem({ stock_enabled: true, stock: '-1' }));
  assert.equal(stockProblem({ stock_enabled: true, stock: '0' }), null);
});

test('il prezzo del payload è un numero', () => {
  assert.equal(buildPayload({ name: 'A', price: '7.5' }).price, 7.5);
  assert.equal(buildPayload({ name: 'A', price: '' }).price, 0);
});

test('ogni categoria compare una volta con il suo colore', () => {
  assert.deepEqual(categoryColors(products).map(c => c.category), ['Pizze', 'Bevande']);
});
