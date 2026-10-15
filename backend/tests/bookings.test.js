import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canTransition, holdsSeats, isExpired, minutesOf, shiftInterval, overlaps, weekdayOf, shiftOpenOn, freeSeats, tableConflicts, confirmationMessage } from '../utils/bookings.js';

const shift = (extra = {}) => ({ id: 1, name: 'Cena', start_time: '19:30:00', duration_minutes: 90, weekdays: [0, 1, 2, 3, 4, 5, 6], capacity: 40, active: true, ...extra });

test('stati: da una richiesta si va avanti, gli stati finali non hanno uscite', () => {
  assert.equal(canTransition('requested', 'confirmed'), true);
  assert.equal(canTransition('requested', 'seated'), false, 'prima va confermata');
  assert.equal(canTransition('confirmed', 'seated'), true);
  assert.equal(canTransition('confirmed', 'declined'), false);
  for (const final of ['seated', 'declined', 'cancelled', 'no_show', 'expired']) assert.equal(canTransition(final, 'confirmed'), false);
});

test('tengono il posto: richiesta, confermata, seduta', () => {
  assert.deepEqual(['requested', 'confirmed', 'seated', 'declined', 'cancelled', 'no_show', 'expired'].map(holdsSeats), [true, true, true, false, false, false, false]);
});

test('una richiesta decade dopo 24 ore', () => {
  const now = Date.parse('2026-10-15T12:00:00Z');
  assert.equal(isExpired('2026-10-14T12:00:01Z', now), false);
  assert.equal(isExpired('2026-10-14T12:00:00Z', now), true);
  assert.equal(isExpired('2026-10-15T11:00:00Z', now), false);
});

test('orari: minuti, intervallo del turno, sovrapposizioni (toccarsi non conta)', () => {
  assert.equal(minutesOf('19:30:00'), 1170);
  assert.deepEqual(shiftInterval(shift()), { start: 1170, end: 1260 });
  const a = shiftInterval(shift()), b = shiftInterval(shift({ start_time: '21:00' })), c = shiftInterval(shift({ start_time: '20:00' }));
  assert.equal(overlaps(a, b), false, 'finisce alle 21:00 e l\'altro comincia alle 21:00');
  assert.equal(overlaps(a, c), true);
});

test('giorno della settimana senza fusi orari', () => {
  assert.equal(weekdayOf('2026-10-15'), 4);   // giovedì
  assert.equal(weekdayOf('2026-10-18'), 0);   // domenica
});

test('un turno è aperto se attivo, nel giorno giusto e senza chiusure', () => {
  const s = shift({ weekdays: [4, 5, 6] });
  assert.equal(shiftOpenOn(s, '2026-10-15').open, true);
  assert.equal(shiftOpenOn(s, '2026-10-14').open, false, 'mercoledì non previsto');
  assert.equal(shiftOpenOn(shift({ active: false }), '2026-10-15').open, false);
  const closures = [{ date_from: '2026-10-14', date_to: '2026-10-16', shift_id: null, reason: 'Ferie' }, { date_from: '2026-10-22', date_to: '2026-10-22', shift_id: 2, reason: 'Evento' }];
  assert.deepEqual(shiftOpenOn(s, '2026-10-15', closures), { open: false, reason: 'Ferie' });
  assert.equal(shiftOpenOn(s, '2026-10-22', closures).open, true, 'la chiusura è di un altro turno');
});

test('posti liberi: contano richieste, confermate e sedute; non quelle chiuse né le richieste scadute', () => {
  const now = Date.parse('2026-10-15T12:00:00Z');
  const list = [
    { status: 'confirmed', party_size: 4 },
    { status: 'requested', party_size: 6, requested_at: '2026-10-15T08:00:00Z' },
    { status: 'requested', party_size: 8, requested_at: '2026-10-13T08:00:00Z' },   // scaduta
    { status: 'seated', party_size: 2 },
    { status: 'cancelled', party_size: 10 }, { status: 'declined', party_size: 3 }, { status: 'no_show', party_size: 5 },
  ];
  assert.deepEqual(freeSeats(40, list, { now }), { held: 12, free: 28 });
  assert.deepEqual(freeSeats(10, [{ status: 'confirmed', party_size: 12 }]), { held: 12, free: -2 });
});

test('tavoli: conflitto solo se stessa data, tavolo in comune e orari che si sovrappongono', () => {
  const lunch = shift({ id: 1, start_time: '19:30' }), late = shift({ id: 2, start_time: '21:00' }), mid = shift({ id: 3, start_time: '20:00' });
  const others = [
    { id: 10, date: '2026-10-15', status: 'confirmed', table_ids: [5], shift: lunch },
    { id: 11, date: '2026-10-16', status: 'confirmed', table_ids: [5], shift: lunch },
    { id: 12, date: '2026-10-15', status: 'cancelled', table_ids: [5], shift: lunch },
  ];
  const probe = (s, tableIds) => tableConflicts({ date: '2026-10-15', shift: s, tableIds }, others).map(o => o.id);
  assert.deepEqual(probe(lunch, [5]), [10]);
  assert.deepEqual(probe(late, [5]), [], 'secondo turno: il tavolo si è liberato');
  assert.deepEqual(probe(mid, [5]), [10], 'turni che si accavallano');
  assert.deepEqual(probe(lunch, [6]), []);
});

test('messaggio di conferma', () => {
  const m = confirmationMessage({ restaurant: 'Trattoria Da Mario', date: '2026-10-16', shift: shift(), party_size: 4, customer_name: 'Rossi' });
  assert.match(m, /Rossi/);
  assert.match(m, /venerdì 16 ottobre alle 19:30/);
  assert.match(m, /4 persone da Trattoria Da Mario/);
  assert.match(confirmationMessage({ date: '2026-10-16', shift: shift(), party_size: 1, customer_name: 'Bianchi' }), /1 persona\./);
});
