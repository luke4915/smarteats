import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentNote, totalLabel, paymentChoices } from './paymentText.js';

test('si paga al ritiro: nessuna nota sul pagamento', () => {
  assert.equal(paymentNote({ online: false, status: 'none' }, 'accepted'), null);
  assert.equal(paymentNote(undefined, 'requested'), null);
});

test('ogni passo del pagamento online ha la sua frase', () => {
  assert.deepEqual([paymentNote({ online: true, status: 'awaiting' }, 'requested').title, paymentNote({ online: true, status: 'awaiting' }, 'requested').canPay], ['Manca il pagamento', true]);
  assert.equal(paymentNote({ online: true, status: 'authorized' }, 'requested').title, 'Carta autorizzata');
  assert.match(paymentNote({ online: true, status: 'authorized' }, 'requested').body, /solo se il locale accetta/);
  assert.equal(paymentNote({ online: true, status: 'paid' }, 'accepted').tone, 'good');
  assert.match(paymentNote({ online: true, status: 'paid' }, 'accepted').body, /dici solo il tuo codice/);
  assert.equal(paymentNote({ online: true, status: 'canceled' }, 'rejected').tone, 'bad');
  assert.equal(paymentNote({ online: true, status: 'refunded' }, 'cancelled').title, 'Importo restituito');
});

test('l\'etichetta del totale cambia con il pagamento', () => {
  assert.equal(totalLabel({ online: false }, 'accepted'), 'Totale da pagare al ritiro');
  assert.equal(totalLabel({ online: true, status: 'paid' }, 'accepted'), 'Totale pagato');
  assert.equal(totalLabel({ online: true, status: 'authorized' }, 'requested'), 'Totale (carta)');
  assert.equal(totalLabel({ online: true, status: 'canceled' }, 'rejected'), 'Totale');
});

test('le scelte offerte dal sito', () => {
  assert.deepEqual(paymentChoices('required'), ['online']);
  assert.deepEqual(paymentChoices('optional'), ['online', 'on_pickup']);
  assert.deepEqual(paymentChoices('off'), ['on_pickup']);
  assert.deepEqual(paymentChoices('unavailable'), ['on_pickup']);
  assert.deepEqual(paymentChoices(undefined), ['on_pickup']);
});
