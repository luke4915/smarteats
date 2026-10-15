import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localNow, daysBetween, addDays, withinWindow, phoneDigits, retentionCutoff, MAX_PARTY } from '../utils/bookingPortal.js';

test('adesso nel fuso del locale: una mezzanotte in UTC è già le 2 d\'estate a Roma', () => {
  assert.deepEqual(localNow(Date.UTC(2026, 6, 14, 23, 30)), { date: '2026-07-15', minutes: 90 });
  assert.deepEqual(localNow(Date.UTC(2026, 0, 14, 23, 30)), { date: '2026-01-15', minutes: 30 }, 'd\'inverno è solo +1');
});

test('giorni tra due date e somma di giorni, anche a cavallo di mese e anno', () => {
  assert.equal(daysBetween('2026-10-15', '2026-10-22'), 7);
  assert.equal(daysBetween('2026-10-15', '2026-10-14'), -1);
  assert.equal(addDays('2026-12-30', 3), '2027-01-02');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});

test('finestra: serve almeno un\'ora di anticipo e al massimo 30 giorni', () => {
  const now = { date: '2026-10-15', minutes: 18 * 60 };            // le 18:00
  assert.equal(withinWindow('2026-10-15', '19:30', now).ok, true);
  assert.equal(withinWindow('2026-10-15', '19:00', now).ok, true, 'esattamente un\'ora: va bene');
  assert.deepEqual([withinWindow('2026-10-15', '18:45', now).ok, withinWindow('2026-10-15', '18:45', now).code], [false, 'TOO_SOON']);
  assert.equal(withinWindow('2026-10-14', '21:00', now).ok, false, 'ieri no');
  assert.equal(withinWindow('2026-11-14', '19:30', now).ok, true, 'il trentesimo giorno sì');
  assert.equal(withinWindow('2026-11-15', '19:30', now).code, 'TOO_FAR');
});

test('telefono: contano le ultime dieci cifre', () => {
  assert.equal(phoneDigits('+39 333 123-4567'), '3331234567');
  assert.equal(phoneDigits('333 123 4567'), phoneDigits('+39 3331234567'));
  assert.equal(phoneDigits(null), '');
});

test('conservazione: 90 giorni', () => {
  assert.equal(retentionCutoff('2026-10-15'), '2026-07-17');
  assert.equal(MAX_PARTY, 10);
});

import { minutesUntilStart, cancelOption } from '../utils/bookingPortal.js';

test('annullo: una richiesta si ritira; una confermata si chiede, fino a un\'ora prima; poi si telefona', () => {
  const now = { date: '2026-10-15', minutes: 17 * 60 + 30 };                       // le 17:30
  assert.equal(minutesUntilStart('2026-10-15', '19:30', now), 120);
  assert.equal(cancelOption({ status: 'requested' }, '2026-10-15', '19:30', now), 'withdraw');
  assert.equal(cancelOption({ status: 'confirmed' }, '2026-10-15', '19:30', now), 'request');
  assert.equal(cancelOption({ status: 'confirmed' }, '2026-10-15', '18:30', now), 'request', 'esattamente un\'ora');
  assert.equal(cancelOption({ status: 'confirmed' }, '2026-10-15', '18:15', now), 'call');
  assert.equal(cancelOption({ status: 'confirmed', cancel_requested: true }, '2026-10-15', '19:30', now), 'requested');
  assert.equal(cancelOption({ status: 'confirmed' }, '2026-10-16', '12:00', now), 'request', 'domani');
  for (const status of ['declined', 'cancelled', 'seated', 'completed', 'no_show', 'expired']) assert.equal(cancelOption({ status }, '2026-10-15', '19:30', now), null);
});
