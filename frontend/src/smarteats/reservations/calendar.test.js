import test from 'node:test';
import assert from 'node:assert/strict';
import { monthGrid, addMonths, monthOf, summaryByDay, formatMonth } from './calendar.js';

test('ottobre 2026 inizia di giovedì: la prima settimana parte da lunedì 28 settembre', () => {
  const weeks = monthGrid('2026-10');
  assert.equal(weeks[0][0].date, '2026-09-28');
  assert.equal(weeks[0][0].inMonth, false);
  assert.equal(weeks[0][3].date, '2026-10-01');
  assert.equal(weeks[0][3].inMonth, true);
  assert.equal(weeks.length, 5);
  assert.equal(weeks.at(-1)[6].date, '2026-11-01');
});

test('un mese che inizia di lunedì non ha giorni prima', () => {
  assert.equal(monthGrid('2026-06')[0][0].date, '2026-06-01');
});

test('ogni settimana ha 7 giorni e i giorni sono consecutivi', () => {
  const days = monthGrid('2026-02').flat();
  assert.ok(monthGrid('2026-02').every(w => w.length === 7));
  assert.equal(days[0].date, '2026-01-26');
  assert.equal(days.length, 35);
});

test('mesi: avanti, indietro, cambio d\'anno', () => {
  assert.equal(addMonths('2026-12', 1), '2027-01');
  assert.equal(addMonths('2026-01', -1), '2025-12');
  assert.equal(monthOf('2026-10-18'), '2026-10');
  assert.match(formatMonth('2026-10'), /ottobre 2026/);
});

test('il riepilogo si raggruppa per giorno e turno', () => {
  const map = summaryByDay([{ date: '2026-10-18', shift_id: 1, reservations: 2, covers: 6 }, { date: '2026-10-18', shift_id: 2, reservations: 1, covers: 2 }]);
  assert.equal(map.get('2026-10-18')[2].covers, 2);
  assert.equal(map.get('2026-10-19'), undefined);
});

import { dayLoad, busiestAndQuietest, heat } from './calendar.js';
const shifts = [
  { id: 1, capacity: 40, weekdays: [0, 6], active: true },          // pranzo: sabato e domenica
  { id: 2, capacity: 36, weekdays: [0, 1, 2, 3, 4, 5, 6], active: true },
  { id: 3, capacity: 10, weekdays: [0, 1, 2, 3, 4, 5, 6], active: false },
];

test('il carico di un giorno conta solo i turni aperti quel giorno', () => {
  // 2026-10-18 è una domenica: pranzo e cena aperti, il turno spento non conta
  const load = dayLoad('2026-10-18', shifts, { 1: { covers: 10, reservations: 3, requested: 1 }, 2: { covers: 18, reservations: 5, requested: 0 } });
  assert.deepEqual([load.covers, load.capacity, load.pct, load.requested], [28, 76, 37, 1]);
  assert.equal(load.perShift.length, 2);
});

test('un lunedì ha solo la cena: il pranzo non si conta', () => {
  assert.equal(dayLoad('2026-10-19', shifts, {}).capacity, 36);
});

test('senza turni aperti il carico non esiste', () => {
  assert.equal(dayLoad('2026-10-19', [], {}).pct, null);
});

test('giorno più carico e più libero (i giorni vuoti non contano)', () => {
  const days = [
    { date: 'a', load: { pct: 10 } }, { date: 'b', load: { pct: 90 } }, { date: 'c', load: { pct: null } }, { date: 'd', load: { pct: 40 } }, { date: 'e', load: { pct: 0 } },
  ];
  const { busiest, quietest } = busiestAndQuietest(days);
  assert.equal(busiest.date, 'b');
  assert.equal(quietest.date, 'a');
});

test('con un solo giorno prenotato c\'è il più carico ma non il più libero', () => {
  const { busiest, quietest } = busiestAndQuietest([{ date: 'a', load: { pct: 30 } }, { date: 'b', load: { pct: 0 } }]);
  assert.deepEqual([busiest.date, quietest], ['a', null]);
});

test('con tutti i giorni vuoti non c\'è né il più carico né il più libero', () => {
  const { busiest, quietest } = busiestAndQuietest([{ date: 'a', load: { pct: 0 } }, { date: 'b', load: { pct: 0 } }]);
  assert.deepEqual([busiest, quietest], [null, null]);
});

test('il colore cresce col carico e non supera il massimo', () => {
  assert.equal(heat(0), 0);
  assert.ok(heat(50) < heat(100));
  assert.equal(heat(150), heat(100));
  assert.equal(heat(null), 0);
});
