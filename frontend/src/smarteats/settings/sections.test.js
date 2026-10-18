import test from 'node:test';
import assert from 'node:assert/strict';
import { settingsSections } from './sections.js';

const ids = (user) => settingsSections(user).map(s => s.id);

test('l\'admin di un ristorante completo vede tutte le sezioni', () => {
  assert.deepEqual(ids({ role: 'admin', modules: ['tables', 'bookings', 'takeaway'] }), ['service', 'rooms', 'bookings', 'takeaway', 'staff', 'notifications', 'account']);
});

test('chi gestisce un locale di solo asporto non vede sala né prenotazioni', () => {
  assert.deepEqual(ids({ role: 'admin', modules: ['takeaway'] }), ['takeaway', 'staff', 'notifications', 'account']);
});

test('un cameriere vede solo notifiche e account', () => {
  assert.deepEqual(ids({ role: 'waiter', modules: ['tables', 'bookings'] }), ['notifications', 'account']);
});

test('la cucina vede solo l\'account', () => {
  assert.deepEqual(ids({ role: 'kitchen', modules: ['kds', 'bookings'] }), ['account']);
});
