import test from 'node:test';
import assert from 'node:assert/strict';
import { portionsAtServiceStart, portionsAfterRuleSaved, portionsWhenBackInStock, portionsWhenSoldOut } from '../utils/inventory/portions.js';

// Un piatto di prova: le porzioni di adesso più la regola. Si cambia solo ciò che serve al singolo caso.
const dish = (changes = {}) => ({ visible: true, stock: 12, stock_enabled: true, portions_reset_rule: 'unlimited', portions_start: null, ...changes });

test('«riparti da N»: all\'apertura del servizio le porzioni tornano a N', () => {
  assert.deepEqual(portionsAtServiceStart(dish({ portions_reset_rule: 'restart_each_service', portions_start: 40, stock: 3 })), { stock: 40, stock_enabled: true, visible: true });
});

test('«riparti da N» vale anche per un piatto che non contava ancora le porzioni', () => {
  assert.deepEqual(portionsAtServiceStart(dish({ portions_reset_rule: 'restart_each_service', portions_start: 40, stock: null, stock_enabled: false })), { stock: 40, stock_enabled: true, visible: true });
});

test('«continua dal servizio prima»: non cambia nulla', () => {
  assert.deepEqual(portionsAtServiceStart(dish({ portions_reset_rule: 'carry_over', stock: 7 })), { stock: 7, stock_enabled: true, visible: true });
  assert.deepEqual(portionsAtServiceStart(dish({ portions_reset_rule: 'carry_over', stock: 0, visible: false })), { stock: 0, stock_enabled: true, visible: false }, 'un piatto finito resta finito');
});

test('«illimitato»: torna illimitato, come prima che esistesse il magazzino', () => {
  assert.deepEqual(portionsAtServiceStart(dish()), { stock: null, stock_enabled: false, visible: true });
});

test('un piatto nascosto perché finito ricompare; uno nascosto a mano dall\'admin resta nascosto', () => {
  assert.equal(portionsAtServiceStart(dish({ stock: 0, visible: false })).visible, true);
  assert.equal(portionsAtServiceStart(dish({ stock: 5, visible: false })).visible, false);
  assert.equal(portionsAtServiceStart(dish({ portions_reset_rule: 'restart_each_service', portions_start: 10, stock: 0, visible: false })).visible, true);
});

test('salvando «riparti da N» a servizio aperto, un piatto illimitato parte subito da N', () => {
  assert.deepEqual(portionsAfterRuleSaved(dish({ stock: null, stock_enabled: false }), 'restart_each_service', 30), { stock: 30, stock_enabled: true, visible: true });
});

test('salvando «riparti da N» su un piatto che contava già, il conto di adesso non si tocca', () => {
  assert.deepEqual(portionsAfterRuleSaved(dish({ stock: 9 }), 'restart_each_service', 30), { stock: 9, stock_enabled: true, visible: true });
});

test('salvando «illimitato» il piatto torna illimitato e, se era finito, ricompare', () => {
  assert.deepEqual(portionsAfterRuleSaved(dish({ stock: 0, visible: false }), 'unlimited', null), { stock: null, stock_enabled: false, visible: true });
});

test('salvando «continua dal servizio prima» non cambia nulla', () => {
  assert.deepEqual(portionsAfterRuleSaved(dish({ stock: 4 }), 'carry_over', null), { stock: 4, stock_enabled: true, visible: true });
});

test('un piatto esaurito: zero porzioni e nascosto; di nuovo disponibile riparte da N oppure illimitato', () => {
  assert.deepEqual(portionsWhenSoldOut(), { stock: 0, stock_enabled: true, visible: false });
  assert.deepEqual(portionsWhenBackInStock(dish({ portions_reset_rule: 'restart_each_service', portions_start: 30 })), { stock: 30, stock_enabled: true, visible: true });
  assert.deepEqual(portionsWhenBackInStock(dish({ portions_reset_rule: 'carry_over', stock: 0 })), { stock: null, stock_enabled: false, visible: true });
  assert.deepEqual(portionsWhenBackInStock(dish()), { stock: null, stock_enabled: false, visible: true });
});
