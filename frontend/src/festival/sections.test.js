import test from 'node:test';
import assert from 'node:assert/strict';
import { festivalSections } from './sections.js';

const ids = (user) => festivalSections(user).map(s => s.id);

test('l\'admin vede tutto, l\'asporto solo se il modulo è acceso', () => {
  assert.deepEqual(ids({ role: 'admin', modules: ['kds', 'stats'] }), ['device', 'menu', 'printing', 'staff', 'account']);
  assert.deepEqual(ids({ role: 'admin', modules: ['takeaway'] }), ['device', 'takeaway', 'menu', 'printing', 'staff', 'account']);
});

test('la cassa non gestisce il personale né l\'asporto', () => {
  assert.deepEqual(ids({ role: 'cashier', modules: ['takeaway'] }), ['device', 'menu', 'printing', 'account']);
});

test('la cucina vede solo il suo account', () => {
  assert.deepEqual(ids({ role: 'kitchen', modules: ['kds'] }), ['account']);
});
