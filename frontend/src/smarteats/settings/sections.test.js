import test from 'node:test';
import assert from 'node:assert/strict';
import { settingsSections } from './sections.js';

const ids = (user) => settingsSections(user).map(s => s.id);

test('l\'admin di un ristorante completo vede tutte le sezioni, l\'account per ultimo', () => {
  assert.deepEqual(ids({ role: 'admin', modules: ['tables', 'bookings', 'takeaway'] }), ['service', 'rooms', 'bookings', 'takeaway', 'notifications', 'feedback', 'account']);
});

test('chi gestisce un locale di solo asporto non vede sala né prenotazioni', () => {
  assert.deepEqual(ids({ role: 'admin', modules: ['takeaway'] }), ['takeaway', 'notifications', 'feedback', 'account']);
});

test('il responsabile ha le notifiche e l\'account, non la configurazione del locale', () => {
  assert.deepEqual(ids({ role: 'manager', modules: ['tables', 'bookings'] }), ['notifications', 'feedback', 'account']);
});

test('cameriere e cassa hanno solo le notifiche del dispositivo, e solo se servono', () => {
  assert.deepEqual(ids({ role: 'waiter', modules: ['tables', 'bookings'] }), ['notifications']);
  assert.deepEqual(ids({ role: 'cashier', modules: ['tables'] }), [], 'senza prenotazioni né asporto non c\'è nulla da impostare');
});

test('la cucina non ha impostazioni: la password gliela dà l\'admin', () => {
  assert.deepEqual(ids({ role: 'kitchen', modules: ['kds', 'bookings'] }), []);
});
