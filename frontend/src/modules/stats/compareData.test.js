import { test } from 'node:test';
import assert from 'node:assert/strict';
import { change, percentText, rankProducts, defaultPair } from './compareData.js';

test('la variazione: differenza e percentuale; con A a zero non c\'è percentuale', () => {
  assert.deepEqual(change(100, 150), { delta: 50, percent: 50, direction: 'up' });
  assert.deepEqual(change(200, 150), { delta: -50, percent: -25, direction: 'down' });
  assert.deepEqual(change(0, 30), { delta: 30, percent: null, direction: 'up' });
  assert.equal(change(5, 5).direction, 'flat');
});

test('il testo della variazione, in italiano', () => {
  assert.equal(percentText(change(100, 112.5)), '+12,5 %');
  assert.equal(percentText(change(100, 92)), '−8 %');
  assert.equal(percentText(change(0, 10)), 'nuovo');
  assert.equal(percentText(change(4, 4)), '—');
});

const P = (name, aq, bq, ar = aq * 5, br = bq * 5) => ({ id: name, name, a: { qty: aq, revenue: ar }, b: { qty: bq, revenue: br } });
const list = [P('Panino', 10, 25), P('Birra', 40, 38), P('Torta', 4, 0), P('Gelato', 0, 6)];

test('i prodotti che sono cambiati di più vengono prima, in quantità o in incasso', () => {
  assert.deepEqual(rankProducts(list).map(p => p.name), ['Panino', 'Gelato', 'Torta', 'Birra']);   // variazioni 15, 6, 4, 2
  assert.equal(rankProducts(list)[0].name, 'Panino');
  assert.equal(rankProducts(list)[0].delta, 15);
  const byRevenue = rankProducts([P('X', 1, 1, 100, 10), P('Y', 5, 9, 25, 45)], { metric: 'revenue' });
  assert.equal(byRevenue[0].name, 'X');
});

test('i più venduti nelle due serate insieme, e la ricerca per nome', () => {
  assert.deepEqual(rankProducts(list, { order: 'best' }).map(p => p.name), ['Birra', 'Panino', 'Gelato', 'Torta']);
  assert.deepEqual(rankProducts(list, { query: ' tor ' }).map(p => p.name), ['Torta']);
});

test('le due serate di partenza sono le ultime due concluse', () => {
  const sessions = [{ id: 9, end_time: null }, { id: 8, end_time: 'x' }, { id: 7, end_time: 'x' }, { id: 6, end_time: 'x' }];
  assert.deepEqual(defaultPair(sessions), { a: 7, b: 8 });
  assert.deepEqual(defaultPair([{ id: 2, end_time: null }, { id: 1, end_time: null }]), { a: 1, b: 2 }, 'se non ce ne sono due concluse si usano quelle che ci sono');
  assert.equal(defaultPair([{ id: 1, end_time: 'x' }]), null);
});
