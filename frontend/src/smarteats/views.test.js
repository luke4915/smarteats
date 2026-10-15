import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visibleViews, canViewSmartEats, smartEatsHome, usesSmartEats } from './views.js';

const ids = (role, modules) => visibleViews(role, modules).map(v => v.id);

test('ogni ruolo vede le sue pagine', () => {
  const all = ['kds', 'stats', 'tables'];
  assert.deepEqual(ids('admin', all), ['floor', 'kitchen', 'catalog', 'stats', 'settings']);
  assert.deepEqual(ids('admin', [...all, 'bookings']), ['floor', 'reservations', 'kitchen', 'catalog', 'stats', 'settings']);
  assert.deepEqual(ids('cameriere', [...all, 'bookings']), ['floor', 'reservations']);
  assert.deepEqual(ids('responsabile', all), ['floor', 'stats']);
  assert.deepEqual(ids('cassa', all), ['floor']);
  assert.deepEqual(ids('cameriere', all), ['floor']);
  assert.deepEqual(ids('cucina', all), ['kitchen']);
});

test('i moduli spenti nascondono le pagine', () => {
  assert.deepEqual(ids('admin', ['tables']), ['floor', 'catalog', 'settings']);
  assert.equal(canViewSmartEats('cucina', 'kitchen', ['stats']), false);
  assert.equal(smartEatsHome('cucina', ['stats']), null);
});

test('senza elenco dei moduli (cache offline) non si nasconde nulla', () => {
  assert.equal(canViewSmartEats('cucina', 'kitchen', undefined), true);
});

test('la home è la prima pagina visibile', () => {
  assert.equal(smartEatsHome('admin', ['kds']), 'floor');
  assert.equal(smartEatsHome('cucina', ['kds']), 'kitchen');
});

test('solo il tipo ristorante usa SmartEats', () => {
  assert.equal(usesSmartEats({ businessType: 'ristorante' }), true);
  assert.equal(usesSmartEats({ businessType: 'sagra' }), false);
  assert.equal(usesSmartEats({ businessType: 'paninaro' }), false);
  assert.equal(usesSmartEats(null), false);
});
