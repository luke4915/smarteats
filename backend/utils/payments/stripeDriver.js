import Stripe from 'stripe';

// Stripe vero (Connect). Il cliente paga su una pagina di Stripe (Checkout): la carta non passa mai da noi, niente PCI da gestire e
// Apple Pay / Google Pay si accendono da soli. Il pagamento è un'**autorizzazione** (`capture_method: manual`): si incassa quando il locale
// accetta; se rifiuta o la richiesta scade si rilascia e il cliente non vede nessun addebito. I soldi vanno al conto collegato del locale
// (`transfer_data.destination`) e la nostra commissione (`application_fee_amount`) resta alla piattaforma.
export function createStripeDriver({ secretKey, webhookSecret }) {
  const stripe = new Stripe(secretKey, { maxNetworkRetries: 2 });
  return {
    kind: 'stripe',
    async createCheckout({ amountCents, productName, description, successUrl, cancelUrl, metadata, destinationAccount, feeCents, customerEmail }) {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        locale: 'it',
        client_reference_id: metadata.takeaway_id,
        ...(customerEmail && { customer_email: customerEmail }),
        line_items: [{ quantity: 1, price_data: { currency: 'eur', unit_amount: amountCents, product_data: { name: productName, ...(description && { description }) } } }],
        payment_intent_data: {
          capture_method: 'manual',
          metadata,
          transfer_data: { destination: destinationAccount },
          ...(feeCents > 0 && { application_fee_amount: feeCents }),
        },
        metadata,
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      });
      return { id: session.id, url: session.url };
    },
    async capture(paymentIntentId) { await stripe.paymentIntents.capture(paymentIntentId); return { ok: true }; },
    async cancel(paymentIntentId) { await stripe.paymentIntents.cancel(paymentIntentId); return { ok: true }; },
    async refund(paymentIntentId) { await stripe.refunds.create({ payment_intent: paymentIntentId, reverse_transfer: true, refund_application_fee: true }); return { ok: true }; },
    parseEvent(rawBody, signature) { return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret); },
    async createAccount({ name }) { const a = await stripe.accounts.create({ type: 'express', country: 'IT', business_profile: { name }, capabilities: { card_payments: { requested: true }, transfers: { requested: true } } }); return { id: a.id }; },
    async accountLink({ accountId, returnUrl, refreshUrl }) { return (await stripe.accountLinks.create({ account: accountId, type: 'account_onboarding', return_url: returnUrl, refresh_url: refreshUrl ?? returnUrl })).url; },
    async accountStatus(accountId) { const a = await stripe.accounts.retrieve(accountId); return { chargesEnabled: !!a.charges_enabled, detailsSubmitted: !!a.details_submitted }; },
  };
}
