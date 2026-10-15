import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSchedule, defaultSlots, toPayload, moveLine, moveUscita, mergeWithPrevious, sendSummary, courseOfProduct, NO_COURSE_NAME } from './courses.js';

const courses = [
  { id: 10, name: 'Antipasti', with_previous: false }, { id: 20, name: 'Primi', with_previous: false },
  { id: 30, name: 'Secondi', with_previous: false }, { id: 35, name: 'Contorni', with_previous: true }, { id: 40, name: 'Dolci', with_previous: false },
];
const line = (id, course_id, extra = {}) => ({ id, name: `P${id}`, quantity: 1, note: '', print_destination: 'both', course_id, modifiers: [], ...extra });
const shape = (s) => s.uscite.map(u => [u.index, u.courses.map(c => c.name)]);

test('numeri d\'uscita di partenza: una portata «insieme alla precedente» esce con quella prima', () => {
  assert.deepEqual([...defaultSlots(courses)], [[10, 1], [20, 2], [30, 3], [35, 3], [40, 4]]);
});

test('le portate si dispongono in uscite; secondi e contorni insieme; bevande con la prima portata', () => {
  const cart = [line(1, 40), line(2, 35), line(3, null), line(4, 10), line(5, 30), line(6, 20)];
  const s = buildSchedule(cart, courses);
  assert.deepEqual(shape(s), [
    [1, [NO_COURSE_NAME, 'Antipasti']], [2, ['Primi']], [3, ['Secondi', 'Contorni']], [4, ['Dolci']],
  ]);
});

test('le uscite si compattano: se mancano delle portate i numeri restano consecutivi', () => {
  const s = buildSchedule([line(1, 30), line(2, 40)], courses);
  assert.deepEqual(s.uscite.map(u => u.index), [1, 2]);
  assert.deepEqual(toPayload(s).map(g => [g.course_id, g.seq]), [[30, 1], [40, 2]]);
});

test('solo bevande: una sola uscita', () => {
  const s = buildSchedule([line(1, null), line(2, null)], courses);
  assert.deepEqual(shape(s), [[1, [NO_COURSE_NAME]]]);
});

test('una portata eliminata dal locale non rompe la comanda: esce con le bevande', () => {
  const s = buildSchedule([line(1, 999), line(2, 10)], courses);
  assert.equal(s.uscite.length, 1);
});

test('spostare un singolo piatto: in un\'uscita esistente, in una nuova dopo, o davanti a tutto', () => {
  const cart = [line(1, 10), line(2, 20), line(3, 20), line(4, 40)];
  let s = buildSchedule(cart, courses);
  // il secondo primo (riga 2) esce insieme agli antipasti
  const together = moveLine(cart, 2, { raw: s.uscite[0].raw }, s);
  s = buildSchedule(together, courses);
  assert.deepEqual(shape(s), [[1, ['Antipasti', 'Primi']], [2, ['Primi']], [3, ['Dolci']]]);
  assert.equal(s.uscite[0].courses[1].lines.length, 1, 'un solo primo con gli antipasti');

  // il dolce in un'uscita sua, subito dopo gli antipasti (prima dei primi)
  const s0 = buildSchedule(cart, courses);
  const early = moveLine(cart, 3, { after: s0.uscite[0].raw }, s0);
  assert.deepEqual(shape(buildSchedule(early, courses)), [[1, ['Antipasti']], [2, ['Dolci']], [3, ['Primi']]]);

  // davanti a tutto
  const first = moveLine(cart, 1, { first: true }, s0);
  assert.deepEqual(shape(buildSchedule(first, courses)).map(([, c]) => c[0]), ['Primi', 'Antipasti', 'Primi', 'Dolci']);
});

test('spostare un\'intera uscita, o unirla alla precedente', () => {
  const cart = [line(1, 10), line(2, 20), line(3, 40)];
  const s = buildSchedule(cart, courses);
  const swapped = moveUscita(cart, s, 0, +1);
  assert.deepEqual(shape(buildSchedule(swapped, courses)).map(([, c]) => c[0]), ['Primi', 'Antipasti', 'Dolci']);
  assert.equal(moveUscita(cart, s, 0, -1), cart, 'già prima');
  const merged = mergeWithPrevious(cart, s, 1);
  assert.deepEqual(shape(buildSchedule(merged, courses)), [[1, ['Antipasti', 'Primi']], [2, ['Dolci']]]);
});

test('payload: id, quantità, nota, destinazione e opzioni; il numero d\'uscita segue la disposizione', () => {
  const cart = [line(1, 10, { quantity: 2, note: 'SENZA SALE', modifiers: [{ id: 7, name: 'x', price: 0 }] }), line(2, 35)];
  const payload = toPayload(buildSchedule(cart, courses));
  assert.deepEqual(payload, [
    { course_id: 10, seq: 1, items: [{ id: 1, name: 'P1', quantity: 2, note: 'SENZA SALE', print_destination: 'both', modifiers: [7] }] },
    { course_id: 35, seq: 2, items: [{ id: 2, name: 'P2', quantity: 1, note: '', print_destination: 'both', modifiers: [] }] },
  ]);
});

test('riepilogo invio: ora, poi; oppure tutto da mandare', () => {
  const s = buildSchedule([line(1, null), line(2, 10), line(3, 20), line(4, 30), line(5, 35)], courses);
  assert.deepEqual(sendSummary(s, true), { now: `${NO_COURSE_NAME} + Antipasti`, later: ['Primi', 'Secondi + Contorni'] });
  assert.deepEqual(sendSummary(s, false).now, null);
  assert.equal(sendSummary(s, false).later.length, 3);
  assert.deepEqual(sendSummary(buildSchedule([], courses), true), { now: null, later: [] });
});

test('portata del prodotto: vale solo se il locale la ha ancora', () => {
  assert.equal(courseOfProduct({ course_id: 20 }, courses), 20);
  assert.equal(courseOfProduct({ course_id: 99 }, courses), null);
  assert.equal(courseOfProduct({}, courses), null);
});
