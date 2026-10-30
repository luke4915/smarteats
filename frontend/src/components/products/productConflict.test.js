import test from 'node:test';
import assert from 'node:assert/strict';
import { productConflict } from './productConflict.js';

const p = { id: 1, name: 'Margherita', price: 8, category: 'Pizze', color: '#ff0000', visible: true, print_destination: 'kitchen', course_id: 2, prep_minutes: 5, vat_rate: null, portions_reset_rule: 'unlimited', portions_start: null, stock_enabled: false, stock: null };

test('nessun conflitto se il prodotto è com\'era; il numero scritto come testo o come numero è lo stesso', () => {
  assert.equal(productConflict(p, { ...p }), null);
  assert.equal(productConflict(p, { ...p, price: '8.00' }), null);
  assert.equal(productConflict(null, p), null, 'si sta creando un prodotto nuovo: niente da confrontare');
});

test('la scorta cambia a ogni vendita e non è un conflitto', () => {
  assert.equal(productConflict({ ...p, stock_enabled: true, stock: 10 }, { ...p, stock_enabled: true, stock: 7 }), null);
});

test('un altro ha cambiato qualcosa: si dice cosa, senza ripetere', () => {
  assert.deepEqual(productConflict(p, { ...p, price: 9, name: 'Margherita DOP' }), { removed: false, fields: ['nome', 'prezzo'] });
  assert.deepEqual(productConflict(p, { ...p, portions_reset_rule: 'carry_over', portions_start: 20 }), { removed: false, fields: ['porzioni'] });
  assert.deepEqual(productConflict(p, { ...p, visible: false }), { removed: false, fields: ['visibilità'] });
  assert.deepEqual(productConflict(p, { ...p, course_id: null }), { removed: false, fields: ['portata'] });
});

test('un altro l\'ha eliminato', () => {
  assert.deepEqual(productConflict(p, undefined), { removed: true, fields: [] });
});
