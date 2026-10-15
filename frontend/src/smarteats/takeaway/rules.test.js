import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupOrders, loadByTime, itemsSummary, addToCart, cartCount, cartTotal, cartLoad, shownStatus } from './rules.js';

const o = (id, status, time, load = 1, extra = {}) => ({ id, status, time, load, ...extra });

test('lista della giornata: prima da approvare, poi in lavorazione per orario, poi il resto', () => {
  const groups = groupOrders([o(1, 'accepted', '20:00'), o(2, 'requested', '19:30'), o(3, 'picked_up', '19:00'), o(4, 'rejected', '19:00'), o(5, 'accepted', '19:15')]);
  assert.deepEqual(groups.map(g => [g.key, g.items.map(i => i.id)]), [['requested', [2]], ['active', [1, 5]], ['done', [3]], ['closed', [4]]]);
  assert.deepEqual(groupOrders([]), []);
});

test('carico per fascia: contano solo gli ordini vivi', () => {
  const map = loadByTime([o(1, 'accepted', '19:00', 3), o(2, 'requested', '19:00', 2), o(3, 'picked_up', '19:00', 5), o(4, 'cancelled', '19:15', 4)]);
  assert.equal(map.get('19:00'), 5);
  assert.equal(map.has('19:15'), false);
});

test('un ordine accettato con la cucina a posto è «pronto»', () => {
  assert.equal(shownStatus({ status: 'accepted', ready: true }), 'ready');
  assert.equal(shownStatus({ status: 'accepted', ready: false }), 'accepted');
  assert.equal(shownStatus({ status: 'requested', ready: false }), 'requested');
});

test('riepilogo delle righe', () => {
  const items = [{ quantity: 2, name: 'Margherita' }, { quantity: 1, name: 'Acqua' }, { quantity: 1, name: 'Birra' }, { quantity: 3, name: 'Diavola' }];
  assert.equal(itemsSummary(items), '2× Margherita, 1× Acqua, 1× Birra + altre 1');
  assert.equal(itemsSummary(items.slice(0, 2)), '2× Margherita, 1× Acqua');
});

test('carrello: somma le stesse righe, toglie a zero, conta pezzi, totale e carico', () => {
  const pizza = { id: 1, name: 'Margherita', price: 6.5, takeaway_load: 1 };
  const water = { id: 2, name: 'Acqua', price: 1.5, takeaway_load: 0 };
  let cart = addToCart([], pizza);
  cart = addToCart(cart, pizza);
  cart = addToCart(cart, water, 3);
  assert.deepEqual(cart.map(l => [l.id, l.quantity]), [[1, 2], [2, 3]]);
  assert.deepEqual([cartCount(cart), cartTotal(cart), cartLoad(cart)], [5, 17.5, 2]);
  assert.deepEqual(addToCart(cart, water, -3).map(l => l.id), [1]);
  assert.deepEqual(addToCart([], pizza, -1), []);
});
