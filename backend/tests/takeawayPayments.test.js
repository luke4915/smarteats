import test from 'node:test';
import assert from 'node:assert/strict';
import { PAYMENT_MODES, toCents, applicationFeeCents, paymentFor } from '../utils/takeawayPayments.js';

test('i tre modi di pagare e gli importi in centesimi interi', () => {
  assert.deepEqual(PAYMENT_MODES, ['off', 'optional', 'required']);
  assert.equal(toCents(12.5), 1250);
  assert.equal(toCents('19.99'), 1999);
  assert.equal(toCents(0.1 + 0.2), 30, 'niente errori di virgola mobile');
});

test('la nostra commissione è una percentuale arrotondata al centesimo', () => {
  assert.equal(applicationFeeCents(1000, 0), 0);
  assert.equal(applicationFeeCents(1000, 2.5), 25);
  assert.equal(applicationFeeCents(1999, 1.5), 30);
});

test('come si paga: spento e facoltativo lasciano la scelta, obbligatorio no', () => {
  assert.equal(paymentFor({ setting: 'off', available: true, requested: true }), 'on_pickup');
  assert.equal(paymentFor({ setting: 'optional', available: true, requested: true }), 'online');
  assert.equal(paymentFor({ setting: 'optional', available: true, requested: false }), 'on_pickup');
  assert.equal(paymentFor({ setting: 'required', available: true, requested: false }), 'online');
});

test('se i pagamenti non sono pronti si paga al ritiro, tranne se il locale li pretende', () => {
  assert.equal(paymentFor({ setting: 'optional', available: false, requested: true }), 'on_pickup');
  assert.equal(paymentFor({ setting: 'required', available: false, requested: true }), null, 'non si può ordinare: meglio dirlo che far pagare al banco di nascosto');
  assert.equal(paymentFor({ setting: 'boh', available: true, requested: true }), 'on_pickup', 'un valore sconosciuto vale spento');
  assert.equal(paymentFor({ setting: undefined, available: true, requested: true }), 'on_pickup');
});
