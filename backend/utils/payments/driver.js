import { createStripeDriver } from './stripeDriver.js';
import { createMockDriver } from './mockDriver.js';

// Chi muove davvero i soldi. `STRIPE_DRIVER`: `stripe` (le chiavi della piattaforma in STRIPE_SECRET_KEY e STRIPE_WEBHOOK_SECRET; con la
// chiave di prova `sk_test_…` non si muove un euro), `mock` (sviluppo e test), `off` (pagamenti spenti: è il valore di partenza se
// non c'è nessuna chiave). Un solo driver per processo, creato alla prima richiesta. Le chiavi stanno solo nelle variabili d'ambiente.
let cached = null;

export function paymentsDriver(env = process.env) {
  if (cached) return cached;
  const kind = env.STRIPE_DRIVER || (env.STRIPE_SECRET_KEY ? 'stripe' : 'off');
  if (kind === 'mock') cached = createMockDriver();
  else if (kind === 'stripe' && env.STRIPE_SECRET_KEY) cached = createStripeDriver({ secretKey: env.STRIPE_SECRET_KEY, webhookSecret: env.STRIPE_WEBHOOK_SECRET ?? '' });
  else cached = { kind: 'off' };
  return cached;
}

// Solo per i test: si ricomincia da zero (registro delle chiamate vuoto).
export const resetPaymentsDriver = () => { cached = null; };

// La nostra commissione sui pagamenti dei locali, in percentuale (0 di partenza). Copre le spese di Stripe e il margine.
export const feePercent = (env = process.env) => {
  const n = Number(env.STRIPE_FEE_PERCENT ?? 0);
  return Number.isFinite(n) && n >= 0 && n <= 30 ? n : 0;
};
