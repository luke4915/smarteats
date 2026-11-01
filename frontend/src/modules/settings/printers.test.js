import test from 'node:test';
import assert from 'node:assert/strict';
import { PRINTERS, settingFor, isReady } from './printers.js';

test('ogni stampante ha una copia diversa e le tre sono cucina, bar e conto', () => {
  assert.deepEqual(PRINTERS.map(p => p.id), ['kitchen', 'bar', 'check']);
  assert.equal(new Set(PRINTERS.map(p => p.template)).size, 3);
});

test('si trova la riga di una stampante dal nome della copia', () => {
  const settings = [{ copy_type_name: 'Cucina', printer_address: '10.0.0.5', enabled: true }, { copy_type_name: 'Conto', printer_address: null, enabled: false }];
  assert.equal(settingFor(PRINTERS[0], settings).printer_address, '10.0.0.5');
  assert.equal(settingFor(PRINTERS[1], settings), undefined);
});

test('è pronta solo con indirizzo e interruttore acceso', () => {
  assert.equal(isReady({ enabled: true, printer_address: '10.0.0.5' }), true);
  assert.equal(isReady({ enabled: false, printer_address: '10.0.0.5' }), false);
  assert.equal(isReady({ enabled: true, printer_address: '' }), false);
  assert.equal(isReady(undefined), false);
});
