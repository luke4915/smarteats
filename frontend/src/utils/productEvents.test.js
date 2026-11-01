import test from 'node:test';
import assert from 'node:assert/strict';
import { upsertProduct, productNotice, applyProductEvent, isSoldOut } from './productEvents.js';

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

test('il nuovo ordine delle categorie riordina l\'elenco senza perdere né duplicare prodotti', () => {
  const p = [{ id: 1, category: 'Bevande', price: 1 }, { id: 2, category: 'Antipasti', price: 2 }, { id: 3, category: 'Bevande', price: 3 }];
  const next = applyProductEvent(p, { type: 'category_order_updated', order: ['Antipasti', 'Bevande'] });
  assert.deepEqual(next.map(x => x.id), [2, 1, 3]);
  assert.equal(applyProductEvent(p, { type: 'category_order_updated' }).length, 3);
});


test('aggiungere due volte lo stesso prodotto non lo raddoppia: la seconda notizia lo aggiorna (con il prezzo come numero)', () => {
  const once = upsertProduct(list(), { id: 3, name: 'Gelato', price: '3.50' });
  assert.deepEqual(once.map(p => p.id), [1, 2, 3]);
  const twice = upsertProduct(once, { id: 3, name: 'Gelato artigianale', price: '4.00', stock: 9 });
  assert.equal(twice.length, 3);
  assert.deepEqual([twice[2].name, twice[2].price, twice[2].stock], ['Gelato artigianale', 4, 9]);
  assert.equal(applyProductEvent(once, { type: 'product_created', product: { id: 3, name: 'Gelato', price: '3.50' } }).length, 3, 'anche se arriva l\'avviso dopo');
});

test('il messaggio per le modifiche degli altri: nome del prodotto, anche per l\'eliminazione; nulla per scorta e ordine delle categorie', () => {
  assert.deepEqual(productNotice({ type: 'product_created', product: { id: 3, name: 'Gelato' } }, list()), { text: 'Aggiunto «Gelato»', tone: 'success' });
  assert.deepEqual(productNotice({ type: 'product_updated', product: { id: 1, name: 'Panino' } }, list()), { text: '«Panino» aggiornato', tone: 'success' });
  assert.deepEqual(productNotice({ type: 'product_deleted', id: 2 }, list()), { text: '«Birra» rimosso', tone: 'warning' });
  assert.equal(productNotice({ type: 'product_deleted', id: 99 }, list()).text, 'Un prodotto è stato rimosso');
  assert.equal(productNotice({ type: 'product_stock_updated', product: { id: 1 } }, list()), null);
  assert.equal(productNotice({ type: 'category_order_updated', order: [] }, list()), null);
});
