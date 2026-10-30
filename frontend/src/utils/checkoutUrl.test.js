import test from 'node:test';
import assert from 'node:assert/strict';
import { checkoutTarget } from './checkoutUrl.js';

test('la pagina di pagamento finta diventa la nostra pagina di prova, con gli stessi parametri', () => {
  assert.equal(checkoutTarget('https://checkout.mock/pay/cs_mock_12?return=https%3A%2F%2Fx.it%2Forder%2Fabc&tenant=3&order=9'),
    '/mock-checkout/cs_mock_12?return=https%3A%2F%2Fx.it%2Forder%2Fabc&tenant=3&order=9');
});

test('la pagina vera di Stripe (e qualsiasi altro indirizzo) non si tocca', () => {
  assert.equal(checkoutTarget('https://checkout.stripe.com/c/pay/cs_test_a1'), 'https://checkout.stripe.com/c/pay/cs_test_a1');
  assert.equal(checkoutTarget('/order/abc'), '/order/abc');
  assert.equal(checkoutTarget(undefined), undefined);
});
