import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReportModel, cashDifference, summaryPairs, kpiCards, cashBox, chartsOf } from './reportModel.js';

const NBSP = ' ';
const report = (over = {}) => ({
  locale: { name: 'Pro Loco di Prova', businessType: 'street_food' },
  session: { id: 5, name: 'Sagra d\'autunno — sabato', start: '2026-10-24T15:00:00Z', end: '2026-10-24T20:00:00Z', open: false },
  summary: { revenue: 120, orders: 4, averageOrder: 30, takeawayOrders: 1, canceledCount: 1, canceledTotal: 12, discountTotal: 3.5, giftTotal: 8, checks: 0, covers: 0, averagePerCover: 0, averageCheckMinutes: null },
  cash: { expected: 120, declared: 118.5, difference: -1.5 },
  payments: [{ method: 'register', label: 'Incasso alla cassa', amount: 120 }],
  categories: [{ category: 'Panini', quantity: 10, revenue: 70, share: 58.33 }],
  products: [{ name: 'Panino', category: 'Panini', quantity: 10, gifts: 1, revenue: 70 }, { name: 'Acqua', category: 'Bevande', quantity: 5, gifts: 0, revenue: 10 }],
  byHour: [{ hour: 19, orders: 3, revenue: 80 }],
  bySource: [{ source: 'A', orders: 3, revenue: 100 }, { source: null, orders: 1, revenue: 20 }],
  canceled: [{ code: 'A9', total: 12, at: '2026-10-24T18:00:00Z' }],
  ...over,
});

test('la differenza di cassa si legge in italiano e col segno', () => {
  assert.equal(cashDifference(null), 'da contare alla chiusura');
  assert.equal(cashDifference(0), 'Quadra: nessuna differenza');
  assert.equal(cashDifference(1.5), `+1,50${NBSP}€  in più del previsto`);
  assert.equal(cashDifference(-1.5), `-1,50${NBSP}€  in meno del previsto`);
});

test('le cifre grandi: incasso, ordini, importo medio e, al ristorante, l\'incasso per coperto', () => {
  assert.deepEqual(kpiCards(report()).map(k => k.label), ['Incasso', 'Ordini', 'Importo medio', 'Da asporto']);
  const rest = kpiCards(report({ summary: { ...report().summary, covers: 8, averagePerCover: 15 } }));
  assert.deepEqual([rest[3].label, rest[3].value], ['Incasso per coperto', `15,00${NBSP}€ `]);
});

test('gli altri indicatori hanno i coperti e la durata solo se ci sono', () => {
  assert.equal(summaryPairs(report()).some(([k]) => k === 'Coperti'), false);
  const rest = summaryPairs(report({ summary: { ...report().summary, covers: 8, averagePerCover: 15, averageCheckMinutes: 62 } }));
  assert.deepEqual(rest.filter(([k]) => ['Coperti', 'Durata media del conto'].includes(k)).map(([, v]) => v), ['8', '1 h 2\'']);
});

test('la scatola della cassa: verde se quadra o avanza, rossa se mancano soldi, neutra se non è chiusa', () => {
  assert.equal(cashBox(report()).tone, 'bad');
  assert.equal(cashBox(report({ cash: { expected: 100, declared: 100, difference: 0 } })).tone, 'good');
  const open = cashBox(report({ cash: { expected: 100, declared: null, difference: null } }));
  assert.deepEqual([open.tone, open.declared], ['neutral', 'da contare']);
});

test('i grafici: pagamenti, categorie e ore, solo se ci sono dati', () => {
  assert.deepEqual(chartsOf(report()).map(c => [c.id, c.type]), [['payments', 'split'], ['categories', 'bars'], ['hours', 'columns']]);
  assert.equal(chartsOf(report({ payments: [], byHour: [] })).map(c => c.id).join(), 'categories');
  const bars = chartsOf(report()).find(c => c.id === 'categories').rows[0];
  assert.deepEqual([bars.label, bars.value, bars.text], ['Panini', 70, `70,00${NBSP}€  · 58,33%`]);
});

test('il titolo, il periodo e le sezioni in tabella', () => {
  const m = buildReportModel(report(), { noun: 'serata', generatedAt: new Date('2026-10-25T10:00:00Z') });
  assert.equal(m.place, 'Pro Loco di Prova');
  assert.equal(m.title, 'Report della serata: Sagra d\'autunno — sabato');
  assert.match(m.period, /^dal 24\/10\/2026 \d{2}:\d{2} al 24\/10\/2026 \d{2}:\d{2}$/);
  assert.deepEqual(m.sections.map(s => s.title), ['Altri indicatori', 'Tutti i prodotti', 'Per cassa', 'Ordini annullati']);
});

test('una serata ancora aperta lo dice e non inventa il conteggio', () => {
  const m = buildReportModel(report({ session: { ...report().session, end: null, open: true }, cash: { expected: 50, declared: null, difference: null } }));
  assert.match(m.period, /\(ancora in corso\)$/);
  assert.equal(m.cashBox.declared, 'da contare');
  assert.equal(m.cashBox.verdict, 'da contare alla chiusura');
});

test('i prodotti elencano tutto, con gli omaggi solo dove ci sono', () => {
  const m = buildReportModel(report());
  const products = m.sections.find(s => s.title === 'Tutti i prodotti');
  assert.deepEqual(products.body.map(r => [r[0], r[3]]), [['Panino', '1'], ['Acqua', '-']]);
});

test('con una sola origine senza cassa la sezione «Per cassa» non compare; le sezioni vuote spariscono', () => {
  const m = buildReportModel(report({ bySource: [{ source: null, orders: 4, revenue: 120 }], canceled: [] }));
  const titles = m.sections.map(s => s.title);
  assert.equal(titles.includes('Per cassa'), false);
  assert.equal(titles.includes('Ordini annullati'), false);
});

test('il nome del file è pulito', () => {
  assert.equal(buildReportModel(report()).fileName, 'report_sagra-d-autunno-sabato.pdf');
  assert.equal(buildReportModel(report({ session: { ...report().session, name: null } }), { noun: 'servizio' }).fileName, 'report_servizio-5.pdf');
});

test('gli annullati oltre l\'elenco sono segnalati', () => {
  const r = report({ summary: { ...report().summary, canceledCount: 40 } });
  const m = buildReportModel(r);
  assert.equal(m.sections.find(s => s.title === 'Ordini annullati').note, 'Sono elencati i primi 1 su 40.');
});
