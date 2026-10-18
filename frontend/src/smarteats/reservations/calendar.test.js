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
