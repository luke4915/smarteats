// Il «Stripe» finto per sviluppo e test: non esce nulla verso internet, tiene un registro delle chiamate e accetta gli avvisi (webhook)
// firmati con `mock-valid`. Una carta con importo che finisce per 13 centesimi fallisce l'incasso (per provare l'errore).
export function createMockDriver() {
  const calls = [];
  let n = Date.now() * 1000;      // gli identificativi non si ripetono tra un avvio e l'altro (le righe del database restano)
  const log = (name, args) => { calls.push({ name, ...args }); };
  return {
    kind: 'mock',
    calls,
    async createCheckout(args) { n += 1; log('createCheckout', args); // l'indirizzo di ritorno sta nella pagina finta, come il pulsante «torna al sito» di una pagina di pagamento vera (utile ai test nel browser)
      return { id: `cs_mock_${n}`, url: `https://checkout.mock/pay/cs_mock_${n}?return=${encodeURIComponent(args.successUrl)}` }; },
    async capture(paymentIntentId) { log('capture', { paymentIntentId }); if (String(paymentIntentId).endsWith('_fail')) throw new Error('La carta non può essere addebitata'); return { ok: true }; },
    async cancel(paymentIntentId) { log('cancel', { paymentIntentId }); return { ok: true }; },
    async refund(paymentIntentId) { log('refund', { paymentIntentId }); return { ok: true }; },
    parseEvent(rawBody, signature) {
      if (signature !== 'mock-valid') throw new Error('Firma non valida');
      return JSON.parse(rawBody.toString('utf8'));
    },
    async createAccount({ name }) { n += 1; log('createAccount', { name }); return { id: `acct_mock${n}` }; },
    async accountLink({ accountId, returnUrl }) { log('accountLink', { accountId, returnUrl }); return `https://connect.mock/onboard/${accountId}`; },
    async accountStatus(accountId) { log('accountStatus', { accountId }); return { chargesEnabled: true, detailsSubmitted: true }; },
  };
}
