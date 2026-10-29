import { pool } from '../db.js';
import logger from '../logger.js';
import { paymentsDriver, feePercent } from './payments/driver.js';
import { enqueue } from './whatsapp/outbox.js';

// Pagamento online dell'asporto (migrazione 058, docs/design-pagamenti.md). Il cliente autorizza la carta su una pagina Stripe quando
// invia la richiesta; il locale accetta (incasso) o rifiuta/scade (rilascio, nessun addebito). Le funzioni pure stanno in alto
// (tests/takeawayPayments.test.js); sotto, quelle che parlano col database e con il driver. Vanno chiamate con la connessione del locale.

export const PAYMENT_MODES = ['off', 'optional', 'required'];

export const toCents = (euro) => Math.round(Number(euro) * 100);

// La nostra commissione su un importo (in centesimi), dalla percentuale impostata sul server.
export const applicationFeeCents = (amountCents, percent) => Math.round((amountCents * percent) / 100);

// Come si paga un ordine nuovo. `setting` = scelta del locale (off, optional, required); `available` = pagamenti pronti (chiavi, modulo, conto
// collegato); `requested` = il cliente ha scelto «paga ora». Ritorna 'online' o 'on_pickup'; `null` se il locale lo pretende ma non è pronto.
export function paymentFor({ setting, available, requested }) {
  const mode = PAYMENT_MODES.includes(setting) ? setting : 'off';
  if (mode === 'required') return available ? 'online' : null;
  if (mode === 'optional' && available && requested) return 'online';
  return 'on_pickup';
}

// Il locale può incassare online? Serve il driver acceso, il modulo `payments` e il conto Stripe collegato (acct_…).
export async function tenantPayments(tenantId) {
  const { rows: [t] } = await pool.query('SELECT stripe_account_id, modules FROM tenants WHERE id = $1', [tenantId]);
  const accountId = t?.stripe_account_id ?? null;
  const available = paymentsDriver().kind !== 'off' && !!t?.modules?.includes('payments') && !!accountId;
  return { available, accountId };
}

// Crea la pagina di pagamento del cliente per un ordine in attesa e ne ricorda l'identificativo. Ritorna l'indirizzo a cui mandarlo.
// `origin` è l'indirizzo del sito da cui è arrivato il cliente (si torna lì, sulla pagina del suo ordine).
export async function startOnlinePayment(db, { tenantId, tenantName, order, token, origin }) {
  const { accountId } = await tenantPayments(tenantId);
  const amountCents = toCents(order.total);
  const session = await paymentsDriver().createCheckout({
    amountCents,
    productName: `Ordine da asporto · ${tenantName}`,
    description: order.summary,
    successUrl: `${origin}/order/${token}?pagamento=ok`,
    cancelUrl: `${origin}/order/${token}?pagamento=annullato`,
    metadata: { tenant_id: String(tenantId), takeaway_id: String(order.id) },
    destinationAccount: accountId,
    feeCents: applicationFeeCents(amountCents, feePercent()),
    customerEmail: order.email || undefined,
  });
  await db.query(`UPDATE takeaway_orders SET stripe_session_id = $2, payment_status = 'awaiting', payment_mode = 'online' WHERE id = $1`, [order.id, session.id]);
  return session.url;
}

// Stripe dice che il cliente ha autorizzato la carta: l'ordine diventa una richiesta vera (compare al locale, parte l'avviso al cliente).
// Si riconosce dalla pagina di pagamento che abbiamo creato noi; un avviso ripetuto o di un'altra pagina non fa nulla. Ritorna true se è cambiato.
export async function markAuthorized(db, { takeawayId, sessionId, paymentIntentId }) {
  const { rows } = await db.query(
    `UPDATE takeaway_orders SET payment_status = 'authorized', stripe_payment_intent_id = $3
     WHERE id = $1 AND stripe_session_id = $2 AND payment_status = 'awaiting' RETURNING id`, [takeawayId, sessionId, paymentIntentId]);
  if (!rows.length) return false;
  await enqueue(db, 'takeaway', takeawayId, 'received');
  return true;
}

// La pagina di pagamento è scaduta senza che il cliente pagasse: la richiesta non è mai esistita per il locale.
export async function markSessionExpired(db, { takeawayId, sessionId }) {
  const { rows } = await db.query(
    `UPDATE takeaway_orders SET payment_status = 'canceled', status = 'cancelled', decided_at = now()
     WHERE id = $1 AND stripe_session_id = $2 AND payment_status = 'awaiting' AND status = 'requested' RETURNING id`, [takeawayId, sessionId]);
  return rows.length > 0;
}

const intentOf = async (db, id) => (await db.query('SELECT stripe_payment_intent_id AS pi FROM takeaway_orders WHERE id = $1', [id])).rows[0]?.pi ?? null;

// Il locale accetta: si incassa quanto autorizzato. Se la carta non risponde l'errore sale e l'accettazione non avviene (resta tutto com'era).
export async function captureForAccept(db, row) {
  if (row.payment_status !== 'authorized') return false;
  await paymentsDriver().capture(await intentOf(db, row.id));
  await db.query(`UPDATE takeaway_orders SET payment_status = 'paid', paid_method = 'card' WHERE id = $1`, [row.id]);
  return true;
}

// Rifiuto, annullo o scadenza: l'autorizzazione si rilascia (nessun addebito); un importo già incassato si restituisce. Un errore di Stripe qui non
// deve impedire al locale di rifiutare: si scrive nel registro e si segnala, il rilascio si può fare dal pannello Stripe. Ritorna lo stato scritto.
export async function releasePayment(db, row) {
  if (!['authorized', 'paid'].includes(row.payment_status)) return null;
  const paid = row.payment_status === 'paid';
  try {
    const pi = await intentOf(db, row.id);
    if (paid) await paymentsDriver().refund(pi); else await paymentsDriver().cancel(pi);
  } catch (err) {
    logger.error({ err, takeawayId: row.id, paid }, 'Pagamento asporto: rilascio non riuscito, da fare dal pannello Stripe');
    return 'failed';
  }
  const next = paid ? 'refunded' : 'canceled';
  await db.query('UPDATE takeaway_orders SET payment_status = $2 WHERE id = $1', [row.id, next]);
  return next;
}
