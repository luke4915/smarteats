import test from 'node:test';
import assert from 'node:assert/strict';
import { settingsSections } from './sections.js';

const ids = (user) => settingsSections(user).map(s => s.id);

test('l\'admin di un ristorante completo vede tutte le sezioni, l\'account per ultimo', () => {
  assert.deepEqual(ids({ role: 'admin', modules: ['tables', 'bookings', 'takeaway'] }), ['service', 'rooms', 'bookings', 'takeaway', 'notifications', 'reserved', 'account']);
});

test('chi gestisce un locale di solo asporto non vede sala né prenotazioni', () => {
  assert.deepEqual(ids({ role: 'admin', modules: ['takeaway'] }), ['takeaway', 'notifications', 'reserved', 'account']);
});

test('il responsabile ha le notifiche e l\'account, non la configurazione del locale', () => {
  assert.deepEqual(ids({ role: 'manager', modules: ['tables', 'bookings'] }), ['notifications', 'account']);
});

test('cameriere e cassa hanno solo le notifiche del dispositivo, e solo se servono', () => {
  assert.deepEqual(ids({ role: 'waiter', modules: ['tables', 'bookings'] }), ['notifications']);
  assert.deepEqual(ids({ role: 'cashier', modules: ['tables'] }), [], 'senza prenotazioni né asporto non c\'è nulla da impostare');
});

test('la cucina non ha impostazioni: la password gliela dà l\'admin', () => {
  assert.deepEqual(ids({ role: 'kitchen', modules: ['kds', 'bookings'] }), []);
});

test('l\'IVA predefinita compare solo all\'admin nella modalità magazzino', () => {
  const warehouse = { mode: 'warehouse', depletion: 'recipes' };
  assert.equal(ids({ role: 'admin', modules: ['inventory'], inventory: warehouse }).includes('inventory'), true);
  assert.equal(ids({ role: 'admin', modules: ['inventory'], inventory: { mode: 'portions' } }).includes('inventory'), false);
  assert.equal(ids({ role: 'manager', modules: ['inventory'], inventory: warehouse }).includes('inventory'), false);
});

test('il blocco dei dati riservati lo gestisce solo l\'amministratore', () => {
  assert.equal(ids({ role: 'admin', modules: ['takeaway'] }).includes('reserved'), true);
  assert.equal(ids({ role: 'manager', modules: ['tables'] }).includes('reserved'), false);
});
