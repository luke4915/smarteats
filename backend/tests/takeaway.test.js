import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slotsOn, slotWithinWindow, pickupIsDue, pickupIsStale, orderLoad, slotStates, isSlot, clock } from '../utils/takeaway.js';

const HOURS = [
  { weekday: 5, open_time: '18:30:00', close_time: '20:00:00' },     // venerdì
  { weekday: 5, open_time: '12:00', close_time: '13:00' },           // anche a pranzo
  { weekday: 1, open_time: '19:00', close_time: '19:30' },
];

test('fasce di un giorno: dalla apertura alla chiusura (esclusa), in ordine, su più finestre', () => {
  // 2026-10-23 è un venerdì
  assert.deepEqual(slotsOn('2026-10-23', HOURS, 30), ['12:00', '12:30', '18:30', '19:00', '19:30']);
  assert.deepEqual(slotsOn('2026-10-23', HOURS, 15).slice(0, 5), ['12:00', '12:15', '12:30', '12:45', '18:30']);
  assert.deepEqual(slotsOn('2026-10-22', HOURS, 15), [], 'giovedì: chiuso');
  assert.equal(isSlot('2026-10-23', '19:00', HOURS, 30), true);
  assert.equal(isSlot('2026-10-23', '19:10', HOURS, 30), false, 'non è una fascia');
  assert.equal(clock(7 * 60 + 5), '07:05');
});

test('anticipo: serve il tempo minimo; oltre una settimana no; il passato no', () => {
  const now = { date: '2026-10-23', minutes: 18 * 60 };                // le 18:00
  assert.equal(slotWithinWindow('2026-10-23', '18:30', now, 30).ok, true, 'esattamente 30 minuti');
  assert.equal(slotWithinWindow('2026-10-23', '18:15', now, 30).code, 'TOO_SOON');
  assert.equal(slotWithinWindow('2026-10-22', '19:00', now, 30).code, 'PAST');
  assert.equal(slotWithinWindow('2026-10-30', '19:00', now, 30).ok, true, 'il settimo giorno sì');
  assert.equal(slotWithinWindow('2026-10-31', '19:00', now, 30).code, 'TOO_FAR');
});

test('ritiro per oggi: l\'ordine va in cucina; per un altro giorno aspetta', () => {
  const now = { date: '2026-10-23', minutes: 18 * 60 };                // oggi, le 18:00
  assert.equal(pickupIsDue('2026-10-23', now), true, 'oggi: va in cucina');
  assert.equal(pickupIsDue('2026-10-24', now), false, 'domani: aspetta la serata di domani');
  assert.equal(pickupIsDue('2026-10-30', now), false, 'anche fra una settimana');
  assert.equal(pickupIsDue('2026-10-22', now), true, 'ieri: un ordine in ritardo non deve restare bloccato');
});

test('un ritiro passato da più di due ore non va più in cucina da solo', () => {
  const now = { date: '2026-10-23', minutes: 23 * 60 };                // oggi, le 23:00
  assert.equal(pickupIsStale('2026-10-23', '12:30', now), true, 'il pranzo di stasera sarebbe un ordine fantasma');
  assert.equal(pickupIsStale('2026-10-23', '21:30', now), false, 'un\'ora e mezza di ritardo: ancora da servire');
  assert.equal(pickupIsStale('2026-10-23', '21:00', now), false, 'esattamente due ore: il limite non è superato');
  assert.equal(pickupIsStale('2026-10-23', '20:59', now), true);
  assert.equal(pickupIsStale('2026-10-23', '23:30', now), false, 'tra mezz\'ora: nessun ritardo');
  assert.equal(pickupIsStale('2026-10-22', '23:30', { date: '2026-10-23', minutes: 30 }), false, 'ieri alle 23:30, ora è mezzanotte e mezza');
  assert.equal(pickupIsStale('2026-10-22', '23:30', { date: '2026-10-23', minutes: 2 * 60 }), true, 'tre ore dopo la mezzanotte: troppo tardi');
  assert.equal(pickupIsStale('2026-10-20', '19:00', now), true, 'giorni fa');
  assert.equal(pickupIsStale('2026-10-24', '09:00', now), false, 'domani');
});

test('carico: quantità per carico del prodotto (le bibite non occupano il forno)', () => {
  const load = { 1: 1, 2: 0, 3: 2 };
  assert.equal(orderLoad([{ id: 1, quantity: 3 }, { id: 2, quantity: 4 }, { id: 3, quantity: 1 }], id => load[id]), 5);
  assert.equal(orderLoad([{ id: 9, quantity: 2 }], () => undefined), 2, 'senza carico indicato vale 1');
});

test('stato delle fasce: piena quando il carico non ci sta, fuori finestra non disponibile', () => {
  const states = slotStates({
    date: '2026-10-23', hours: HOURS, slotMinutes: 30, capacity: 10,
    loadByTime: new Map([['18:30', 8], ['19:00', 10]]), now: { date: '2026-10-23', minutes: 12 * 60 + 40 }, minLeadMinutes: 30, load: 3,
  });
  const by = Object.fromEntries(states.map(s => [s.time, s]));
  assert.equal(by['12:00'].available, false, 'già passata');
  assert.deepEqual([by['12:00'].status, by['18:30'].status, by['19:30'].status], ['closed', 'full', 'open']);
  assert.equal(by['12:30'].available, false, 'meno di 30 minuti');
  assert.deepEqual([by['18:30'].load, by['18:30'].available], [8, false], '8 + 3 supera 10');
  assert.equal(by['19:00'].available, false, 'piena');
  assert.equal(by['19:30'].available, true);
});
