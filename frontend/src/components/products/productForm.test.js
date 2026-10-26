import test from 'node:test';
import assert from 'node:assert/strict';
import { blankForm, formFromProduct, cleanPriceInput, colorOfCategory, namesForCategory, findNameConflict, stockProblem, stockUpdateOf, buildPayload, categoryColors } from './productForm.js';

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

test('col magazzino il modulo ha la regola delle porzioni; senza non c\'è', () => {
  assert.equal(blankForm().portions_reset_rule, undefined);
  assert.deepEqual([blankForm({ portions: true }).portions_reset_rule, blankForm({ portions: true }).portions_start], ['unlimited', '']);
  const form = formFromProduct({ ...products[0], portions_reset_rule: 'restart_each_service', portions_start: 40 }, { portions: true });
  assert.deepEqual([form.portions_reset_rule, form.portions_start], ['restart_each_service', '40']);
});

test('«da N a ogni servizio» chiede il numero di partenza, «continua» le porzioni di adesso, «illimitate» nulla', () => {
  assert.ok(stockProblem({ portions_reset_rule: 'restart_each_service', portions_start: '' }));
  assert.ok(stockProblem({ portions_reset_rule: 'restart_each_service', portions_start: '0' }));
  assert.equal(stockProblem({ portions_reset_rule: 'restart_each_service', portions_start: '40' }), null);
  assert.ok(stockProblem({ portions_reset_rule: 'carry_over', stock: '' }));
  assert.equal(stockProblem({ portions_reset_rule: 'carry_over', stock: '0' }), null);
  assert.equal(stockProblem({ portions_reset_rule: 'unlimited', stock: '', stock_enabled: true }), null);
});

test('il conto di adesso si manda a parte solo per «continua dal servizio prima»; senza magazzino come sempre', () => {
  assert.deepEqual(stockUpdateOf({ portions_reset_rule: 'carry_over', stock: '7' }), { stock: 7, stock_enabled: true });
  assert.equal(stockUpdateOf({ portions_reset_rule: 'restart_each_service', portions_start: '40', stock: '' }), null);
  assert.equal(stockUpdateOf({ portions_reset_rule: 'unlimited', stock: '' }), null);
  assert.deepEqual(stockUpdateOf({ stock_enabled: true, stock: '12' }), { stock: 12, stock_enabled: true });
  assert.deepEqual(stockUpdateOf({ stock_enabled: false, stock: '' }), { stock: null, stock_enabled: false });
});

test('il numero di partenza va al server solo con «da N a ogni servizio»', () => {
  assert.equal(buildPayload({ price: '5', portions_reset_rule: 'restart_each_service', portions_start: '40' }).portions_start, 40);
  assert.equal(buildPayload({ price: '5', portions_reset_rule: 'carry_over', portions_start: '40' }).portions_start, null);
  assert.equal('portions_start' in buildPayload({ price: '5' }), false);
});

test('l\'IVA del prodotto esiste solo nella modalità magazzino e vuota vale «quella del locale»', () => {
  assert.equal('vat_rate' in blankForm(), false);
  assert.equal(blankForm({ vat: true }).vat_rate, '');
  assert.equal(formFromProduct({ id: 1, vat_rate: '10.00' }, { vat: true }).vat_rate, '10');
  assert.equal(formFromProduct({ id: 1, vat_rate: null }, { vat: true }).vat_rate, '');
  assert.equal(buildPayload({ price: '5', vat_rate: '22' }).vat_rate, 22);
  assert.equal(buildPayload({ price: '5', vat_rate: '' }).vat_rate, null);
  assert.equal('vat_rate' in buildPayload({ price: '5' }), false);
});
