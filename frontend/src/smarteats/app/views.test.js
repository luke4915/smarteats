import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visibleViews, canViewSmartEats, smartEatsHome, usesSmartEats } from './views.js';

const ids = (role, modules, inventory) => visibleViews(role, modules, inventory).map(v => v.id);

test('ogni ruolo vede le sue pagine', () => {
  const all = ['kds', 'stats', 'tables'];
  assert.deepEqual(ids('admin', all), ['floor', 'kitchen', 'catalog', 'stats', 'settings']);
  assert.deepEqual(ids('admin', [...all, 'bookings']), ['floor', 'reservations', 'kitchen', 'catalog', 'stats', 'settings']);
  assert.deepEqual(ids('waiter', [...all, 'bookings']), ['floor', 'reservations', 'settings'], 'ha le notifiche del dispositivo');
  assert.deepEqual(ids('manager', all), ['floor', 'stats', 'settings']);
  assert.deepEqual(ids('cashier', all), ['floor'], 'senza prenotazioni né asporto non ha impostazioni');
  assert.deepEqual(ids('waiter', all), ['floor']);
  assert.deepEqual(ids('kitchen', all), ['kitchen'], 'la cucina non ha impostazioni');
});

test('i moduli spenti nascondono le pagine', () => {
  assert.deepEqual(ids('admin', ['tables']), ['floor', 'catalog', 'settings']);
  assert.equal(canViewSmartEats('kitchen', 'kitchen', ['stats']), false);
  assert.equal(smartEatsHome('kitchen', ['stats']), null, 'senza KDS la cucina non ha nessuna pagina');
});

test('senza elenco dei moduli (cache offline) non si nasconde nulla', () => {
  assert.equal(canViewSmartEats('kitchen', 'kitchen', undefined), true);
});

test('la home è la prima pagina visibile', () => {
  assert.equal(smartEatsHome('admin', ['kds', 'tables']), 'floor');
  assert.equal(smartEatsHome('admin', ['kds', 'takeaway']), 'takeaway', 'solo asporto: si parte dall\'asporto');
  assert.equal(smartEatsHome('kitchen', ['kds']), 'kitchen');
});

test('ristoranti e solo asporto usano SmartEats; lo street food ha la sua cassa', () => {
  assert.equal(usesSmartEats({ businessType: 'restaurant' }), true);
  assert.equal(usesSmartEats({ businessType: 'takeaway_shop' }), true, 'anche il solo asporto');
  assert.equal(usesSmartEats({ businessType: 'street_food' }), false);
  assert.equal(usesSmartEats({ businessType: 'takeaway_shop' }), true, 'anche il solo asporto');
  assert.equal(usesSmartEats({ businessType: 'street_food' }), false);
  assert.equal(usesSmartEats(null), false);
});

test('il magazzino con ingredienti e ricette: solo con la modalità «magazzino», per admin e responsabile', () => {
  const warehouse = { mode: 'warehouse', depletion: 'recipes' };
  const modules = ['kds', 'tables', 'inventory'];
  assert.equal(ids('admin', modules, warehouse).includes('inventory'), true);
  assert.equal(ids('manager', modules, warehouse).includes('inventory'), true);
  assert.equal(ids('admin', modules, { mode: 'portions', depletion: 'recipes' }).includes('inventory'), false, 'con le sole porzioni non c\'è');
  assert.equal(ids('admin', modules, null).includes('inventory'), false);
  assert.equal(ids('waiter', modules, warehouse).includes('inventory'), false);
  assert.equal(ids('admin', ['kds', 'tables'], warehouse).includes('inventory'), false, 'modulo spento');
});
