import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSessionReport } from '../utils/sessionReport.js';

const base = () => ({
  session: { id: 5, name: 'Sagra — sabato', start_time: '2026-10-24T15:00:00Z', end_time: '2026-10-24T22:00:00Z', declared_cash: '118.50' },
  locale: { name: 'Pro Loco', business_type: 'street_food' },
  totals: { n: 4, total: '120', takeaway: 1 },
  adjustments: { discount: '3.5', gift: '8' },
  products: [
    { product_id: '1', name: 'Panino', category: 'Panini', quantity: '10', gifts: '1', revenue: '70' },
    { product_id: '2', name: 'Birra', category: 'Bevande', quantity: '10', gifts: '0', revenue: '40' },
    { product_id: '3', name: 'Acqua', category: 'Bevande', quantity: '5', gifts: '0', revenue: '10' },
  ],
  byHour: [{ hour: 1, n: 1, total: '10' }, { hour: 19, n: 2, total: '70' }, { hour: 20, n: 1, total: '40' }],
  bySource: [{ letter: 'A', n: 3, total: '100' }, { letter: null, n: 1, total: '20' }],
  methods: [],
  registerTotal: '120',
  checks: { n: 0, covers: 0, avg_minutes: null },
  canceled: [{ display_code: 'A9', total: '12', created_at: '2026-10-24T18:00:00Z' }],
  expectedCash: '120',
});

test('i totali e la media dell\'ordine', () => {
  const r = buildSessionReport(base());
  assert.equal(r.summary.revenue, 120);
  assert.equal(r.summary.orders, 4);
  assert.equal(r.summary.averageOrder, 30);
  assert.equal(r.summary.takeawayOrders, 1);
  assert.equal(r.summary.discountTotal, 3.5);
  assert.equal(r.summary.giftTotal, 8);
  assert.deepEqual([r.summary.canceledCount, r.summary.canceledTotal], [1, 12]);
});

test('la cassa: contanti attesi, contati e differenza', () => {
  const r = buildSessionReport(base());
  assert.deepEqual(r.cash, { expected: 120, declared: 118.5, difference: -1.5 });
  const open = base();
  open.session.end_time = null; open.session.declared_cash = null;
  const o = buildSessionReport(open);
  assert.equal(o.session.open, true);
  assert.deepEqual(o.cash, { expected: 120, declared: null, difference: null }, 'serata aperta: niente differenza');
});

test('i pagamenti: gli ordini pagati subito stanno in «Incasso alla cassa», i conti per metodo', () => {
  const raw = base();
  raw.registerTotal = '60'; raw.methods = [{ method: 'card', amount: '45' }, { method: 'cash', amount: '15' }];
  const r = buildSessionReport(raw);
  assert.deepEqual(r.payments.map(p => [p.method, p.amount]), [['register', 60], ['card', 45], ['cash', 15]]);
  assert.equal(r.payments[1].label, 'Carta');
  raw.registerTotal = '0';
  assert.equal(buildSessionReport(raw).payments[0].method, 'card', 'senza incassi alla cassa la voce non compare');
});

test('le categorie sommano i prodotti e hanno la quota sull\'incasso', () => {
  const r = buildSessionReport(base());
  assert.deepEqual(r.categories.map(c => [c.category, c.quantity, c.revenue, c.share]), [['Panini', 10, 70, 58.33], ['Bevande', 15, 50, 41.67]]);
});

test('i prodotti dal più venduto, a parità in ordine alfabetico', () => {
  const r = buildSessionReport(base());
  assert.deepEqual(r.products.map(p => p.name), ['Birra', 'Panino', 'Acqua']);
  assert.equal(r.products[1].gifts, 1);
});

test('le ore seguono la serata: da mezzogiorno in poi, poi la notte', () => {
  const r = buildSessionReport(base());
  assert.deepEqual(r.byHour.map(h => h.hour), [19, 20, 1]);
});

test('ristorante: coperti e scontrino medio per coperto', () => {
  const raw = base();
  raw.checks = { n: 3, covers: 8, avg_minutes: '62.4' };
  const r = buildSessionReport(raw);
  assert.equal(r.summary.covers, 8);
  assert.equal(r.summary.averagePerCover, 15);
  assert.equal(r.summary.averageCheckMinutes, 62);
});

test('una serata senza ordini non dà errori né divisioni per zero', () => {
  const raw = base();
  raw.totals = { n: 0, total: '0', takeaway: 0 }; raw.products = []; raw.byHour = []; raw.bySource = []; raw.registerTotal = '0'; raw.canceled = []; raw.expectedCash = '0';
  const r = buildSessionReport(raw);
  assert.equal(r.summary.averageOrder, 0);
  assert.deepEqual(r.categories, []);
  assert.deepEqual(r.payments, []);
});

test('l\'elenco degli annullati è limitato ma il totale no', () => {
  const raw = base();
  raw.canceled = Array.from({ length: 40 }, (_, i) => ({ display_code: `A${i}`, total: '1', created_at: '2026-10-24T18:00:00Z' }));
  const r = buildSessionReport(raw);
  assert.equal(r.canceled.length, 30);
  assert.equal(r.summary.canceledCount, 40);
  assert.equal(r.summary.canceledTotal, 40);
});
