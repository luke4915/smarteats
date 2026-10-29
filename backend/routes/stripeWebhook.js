import express from 'express';
import { withTenantClient } from '../middleware/tenantScope.js';
import logger from '../logger.js';
import { paymentsDriver } from '../utils/payments/driver.js';
import { markAuthorized, markSessionExpired } from '../utils/takeawayPayments.js';

// Gli avvisi di Stripe (webhook), senza login né locale: vale solo la firma sul corpo grezzo (`req.rawBody`, conservato da express.json per
// /api/webhooks/) con STRIPE_WEBHOOK_SECRET. Il locale si ricava dai dati che abbiamo scritto noi nella pagina di pagamento (`metadata`), che
// arrivano firmati da Stripe. Ogni avviso si applica una volta sola: uno ripetuto o di una pagina che non conosciamo non cambia nulla.
export default function (broadcast) {
  const router = express.Router();

  router.post('/', async (req, res) => {
    const driver = paymentsDriver();
    if (driver.kind === 'off') return res.status(404).json({ error: 'Pagamenti non attivi' });
    let event;
    try { event = driver.parseEvent(req.rawBody, req.get('stripe-signature')); }
    catch (err) {
      logger.warn({ err }, 'Webhook Stripe: firma non valida');
      return res.status(400).json({ error: 'Firma non valida' });
    }
    try {
      const session = event.data?.object;
      const tenantId = Number(session?.metadata?.tenant_id);
      const takeawayId = Number(session?.metadata?.takeaway_id);
      if (['checkout.session.completed', 'checkout.session.expired'].includes(event.type) && tenantId > 0 && takeawayId > 0) {
        const changed = await withTenantClient(tenantId, (db) => (event.type === 'checkout.session.completed'
          ? markAuthorized(db, { takeawayId, sessionId: session.id, paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null })
          : markSessionExpired(db, { takeawayId, sessionId: session.id })));
        if (changed && event.type === 'checkout.session.completed') broadcast?.(tenantId, { type: 'takeaway_updated', order: { id: takeawayId, status: 'requested' } });
      }
      res.json({ received: true });
    } catch (err) {
      logger.error({ err, type: event.type }, 'Errore webhook Stripe');
      res.status(500).json({ error: 'Errore elaborazione avviso' });
    }
  });

  return router;
}
