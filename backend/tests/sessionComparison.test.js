import test from 'node:test';
import assert from 'node:assert/strict';
import { buildComparison } from '../utils/sessionComparison.js';

const A = { id: 1, name: 'Venerdì', start_time: '2026-10-02T17:00:00Z' };
const B = { id: 2, name: 'Sabato', start_time: '2026-10-03T17:00:00Z' };
const input = {
  sessions: [A, B],
  totals: [{ session_id: 1, n: 10, revenue: '100.00', avg_minutes: 8 }, { session_id: 2, n: 20, revenue: '300.00', avg_minutes: null }],
  products: [
    { session_id: 1, product_id: '7', name: 'Panino', category: 'Panini', quantity: '10', revenue: '50' },
    { session_id: 2, product_id: '7', name: 'Panino', category: 'Panini', quantity: '25', revenue: '125' },
    { session_id: 1, product_id: '8', name: 'Torta', category: 'Dolci', quantity: '4', revenue: '12' },
    { session_id: 2, product_id: '9', name: 'Birra', category: null, quantity: '6', revenue: '24' },
  ],
  hours: [{ session_id: 1, hour: 20, n: 6, revenue: '60' }, { session_id: 2, hour: 20, n: 12, revenue: '180' }, { session_id: 2, hour: 1, n: 2, revenue: '30' }],
};

test('i numeri di ogni serata: incasso, ordini, importo medio e tempo (assente se non registrato)', () => {
  const r = buildComparison(input);
  assert.deepEqual([r.a.revenue, r.a.orders, r.a.avgOrder, r.a.avgMinutes], [100, 10, 10, 8]);
  assert.deepEqual([r.b.revenue, r.b.orders, r.b.avgOrder, r.b.avgMinutes], [300, 20, 15, null]);
  assert.equal(r.a.name, 'Venerdì');
});

test('ogni prodotto affiancato, con chi è nuovo e chi è sparito; il più venduto in cima', () => {
  const r = buildComparison(input);
  assert.deepEqual(r.products.map(p => [p.name, p.status]), [['Panino', 'both'], ['Birra', 'new'], ['Torta', 'gone']]);
  const panino = r.products[0];
  assert.deepEqual([panino.a.qty, panino.b.qty, panino.a.revenue, panino.b.revenue], [10, 25, 50, 125]);
  assert.equal(r.products[1].category, 'Altro', 'senza categoria: Altro');
});

test('le ore sono da mezzogiorno a mezzogiorno e solo quelle con ordini in almeno una serata', () => {
  const r = buildComparison(input);
  assert.deepEqual(r.hours.map(h => h.hour), [20, 1]);
  assert.deepEqual(r.hours[0], { hour: 20, a: { orders: 6, revenue: 60 }, b: { orders: 12, revenue: 180 } });
  assert.deepEqual(r.hours[1].a, { orders: 0, revenue: 0 });
});

test('una serata senza ordini non rompe nulla', () => {
  const r = buildComparison({ sessions: [A, B], totals: [], products: [], hours: [] });
  assert.deepEqual([r.a.orders, r.a.avgOrder, r.b.revenue, r.products.length, r.hours.length], [0, 0, 0, 0, 0]);
});
