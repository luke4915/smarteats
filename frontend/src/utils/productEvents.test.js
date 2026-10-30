import test from 'node:test';
import assert from 'node:assert/strict';
import { applyProductEvent, isSoldOut } from './productEvents.js';

const list = () => [{ id: 1, name: 'Panino', price: 5, stock: 3, stock_enabled: true, visible: true }, { id: 2, name: 'Birra', price: 4, stock: null, stock_enabled: false, visible: true }];

test('un prodotto esaurito dalla cucina diventa grigio sulla tessera e resta in carta', () => {
  const next = applyProductEvent(list(), { type: 'product_stock_updated', product: { id: 1, stock: 0, stock_enabled: true, visible: true } });
  assert.deepEqual([next[0].stock, next[0].visible, isSoldOut(next[0])], [0, true, true]);
});

test('tornato disponibile (illimitato) la tessera non è più esaurita, anche se prima contava le porzioni', () => {
  const soldOut = applyProductEvent(list(), { type: 'product_stock_updated', product: { id: 1, stock: 0, stock_enabled: true, visible: true } });
  const back = applyProductEvent(soldOut, { type: 'product_stock_updated', product: { id: 1, stock: null, stock_enabled: false, visible: true } });
  assert.equal(isSoldOut(back[0]), false);
  assert.equal(back[0].stock_enabled, false);
});

test('un avviso vecchio senza stock_enabled non lo cancella', () => {
  const next = applyProductEvent(list(), { type: 'product_stock_updated', product: { id: 1, stock: 2, visible: true } });
  assert.deepEqual([next[0].stock, next[0].stock_enabled], [2, true]);
});

test('creato, modificato e tolto: il prezzo torna un numero e un prodotto non si duplica', () => {
  let p = applyProductEvent(list(), { type: 'product_created', product: { id: 3, name: 'Acqua', price: '1.50' } });
  assert.deepEqual([p.length, p[2].price], [3, 1.5]);
  p = applyProductEvent(p, { type: 'product_created', product: { id: 3, name: 'Acqua', price: '1.50' } });
  assert.equal(p.length, 3);
  p = applyProductEvent(p, { type: 'product_updated', product: { id: 3, name: 'Acqua frizzante', price: '2' } });
  assert.deepEqual([p[2].name, p[2].price], ['Acqua frizzante', 2]);
  p = applyProductEvent(p, { type: 'product_deleted', id: 3 });
  assert.equal(p.length, 2);
});

test('un evento che non riguarda i prodotti lascia l\'elenco com\'è', () => {
  const l = list();
  assert.equal(applyProductEvent(l, { type: 'order_created' }), l);
  assert.equal(applyProductEvent(l, undefined), l);
});
