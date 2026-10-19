import test from 'node:test';
import assert from 'node:assert/strict';
import { timelineWindow, blocksForTable, unassigned, walkInTables, clockOf } from './timeline.js';

const shifts = [{ start_time: '19:30', duration_minutes: 90, active: true }, { start_time: '21:15', duration_minutes: 90, active: true }];
const res = (o) => ({ id: 1, status: 'confirmed', start_time: '19:30', duration_minutes: 90, table_ids: [], party_size: 2, customer_name: 'Rossi', check_id: null, ...o });

test('la finestra va da mezz\'ora prima del primo turno a mezz\'ora dopo l\'ultima fine', () => {
  assert.deepEqual(timelineWindow(shifts), { start: 19 * 60, end: 23 * 60 + 30 });
});

test('un conto aperto prima dei turni allarga la finestra', () => {
  assert.equal(timelineWindow(shifts, [], [17 * 60 + 40]).start, 17 * 60);
});

test('senza turni si usa la finestra di default', () => {
  assert.deepEqual(timelineWindow([]), { start: 720, end: 1440 });
});

test('i blocchi di un tavolo sono le sue prenotazioni attive, in ordine', () => {
  const list = [res({ id: 2, table_ids: [5], start_time: '21:15' }), res({ id: 1, table_ids: [5] }), res({ id: 3, table_ids: [5], status: 'cancelled' }), res({ id: 4, table_ids: [6] })];
  const blocks = blocksForTable(5, list, [], { isToday: true, nowMin: 1200 });
  assert.deepEqual(blocks.map(b => b.id), [1, 2]);
  assert.equal(blocks[0].end - blocks[0].start, 90);
});

test('un conto aperto è un blocco, ma non se è già quello di una prenotazione al tavolo', () => {
  const checks = [{ id: 10, table_id: 5, covers: 3, opened_at: new Date(2026, 9, 18, 20, 5).toISOString() }, { id: 11, table_id: 5, covers: 2, opened_at: new Date(2026, 9, 18, 20, 40).toISOString() }];
  const list = [res({ id: 1, status: 'seated', table_ids: [5], check_id: 11 })];
  const blocks = blocksForTable(5, list, checks, { isToday: true, nowMin: 20 * 60 + 50 });
  assert.deepEqual(blocks.map(b => [b.kind, b.id]), [['reservation', 1], ['check', 10]]);
  assert.equal(blocks.filter(b => b.kind === 'check').length, 1);
  assert.equal(blocks.find(b => b.kind === 'check').title, 'Senza prenotazione');
});

test('i conti aperti non compaiono in un altro giorno', () => {
  const checks = [{ id: 10, table_id: 5, covers: 3, opened_at: new Date().toISOString() }];
  assert.equal(blocksForTable(5, [], checks, { isToday: false, nowMin: 600 }).length, 0);
});

test('le prenotazioni senza tavolo sono da assegnare', () => {
  assert.deepEqual(unassigned([res({ id: 1 }), res({ id: 2, table_ids: [3] }), res({ id: 3, status: 'declined' })]).map(r => r.id), [1]);
});

const rooms = [{ name: 'Sala', tables: [
  { id: 1, name: 'T1', seats: 2, active: true }, { id: 2, name: 'T2', seats: 4, active: true }, { id: 3, name: 'T3', seats: 6, active: true }, { id: 4, name: 'T4', seats: 4, active: false },
] }];

test('walk-in: i tavoli liberi che bastano, dal meno sprecato', () => {
  const { fits } = walkInTables(3, rooms, [], [], { nowMin: 1200 });
  assert.deepEqual(fits.map(t => t.name), ['T2', 'T3']);
});

test('walk-in: un tavolo occupato o con una prenotazione vicina non è libero', () => {
  const reservations = [res({ table_ids: [2], start_time: '20:30' })];                  // alle 20:30 tocca a T2
  const checks = [{ id: 1, table_id: 3 }];                                               // T3 ha un conto aperto
  const { fits } = walkInTables(3, rooms, reservations, checks, { nowMin: 20 * 60 });
  assert.deepEqual(fits, []);
});

test('walk-in: una prenotazione lontana non blocca il tavolo', () => {
  const { fits } = walkInTables(4, rooms, [res({ table_ids: [2], start_time: '22:30' })], [], { nowMin: 19 * 60 });
  assert.deepEqual(fits.map(t => t.name), ['T2', 'T3']);
});

test('walk-in: se nessun tavolo basta, si propongono i più capienti', () => {
  const { fits, rest } = walkInTables(8, rooms, [], [], { nowMin: 600 });
  assert.equal(fits.length, 0);
  assert.equal(rest[0].name, 'T3');
});

test('clockOf formatta le ore', () => assert.equal(clockOf(19 * 60 + 5), '19:05'));

test('walk-in con intervalli: il tavolo dove il gruppo sta nell\'intervallo viene prima, sotto il minimo si siede lo stesso', () => {
  const ranged = [{ id: 1, name: 'Sala', active: true, tables: [
    { id: 1, name: 'A', seats: 6, seats_min: 4, active: true },
    { id: 2, name: 'B', seats: 4, seats_min: 2, active: true },
    { id: 3, name: 'C', seats: 10, seats_min: 8, active: true },
  ] }];
  const two = walkInTables(2, ranged, [], [], { nowMin: 600 }).fits;
  assert.deepEqual(two.map(t => [t.name, t.under]), [['B', false], ['A', true], ['C', true]], '2 persone: B va bene, gli altri sono grandi');
  const five = walkInTables(5, ranged, [], [], { nowMin: 600 }).fits;
  assert.deepEqual(five.map(t => [t.name, t.under]), [['A', false], ['C', true]], '5 persone: A è perfetto; B non basta');
});
