// Asporto pagato con carta (Stripe Connect, driver finto): la carta si autorizza al momento della richiesta, si incassa quando il locale
// accetta e si rilascia se rifiuta, annulla o la richiesta scade. Niente esce verso internet: il driver `mock` tiene il registro delle chiamate.
process.env.STRIPE_DRIVER = 'mock';

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, createTenant, deleteTenants, closePools, apiClient, adminDb } from './helpers.js';
import { localNow, addDays } from '../../utils/bookingPortal.js';
import { paymentsDriver } from '../../utils/payments/driver.js';

describe('asporto pagato online', () => {
  let server, t, admin, client, hook;
  const tomorrow = addDays(localNow().date, 1);
  let phoneSeq = 0;
  const driver = paymentsDriver();
  const callsOf = (name) => driver.calls.filter(c => c.name === name);
  const setting = (key, value) => admin.put(`/settings/${key}`, { value });
  const order = (extra = {}) => ({ date: tomorrow, time: '19:00', items: [{ id: t.productId, quantity: 2 }], customer_name: 'Bianchi', phone: `339${String(3000000 + ++phoneSeq)}`, email: '', notes: '', consent: true, website: '', pay_online: true, ...extra });
  const post = (extra) => client.post('/public/takeaway/orders', order(extra));
  const sessionOf = async (id) => (await adminDb.query('SELECT stripe_session_id AS s, payment_status AS ps, status FROM takeaway_orders WHERE id = $1', [id])).rows[0];
  // Stripe avvisa che il cliente ha autorizzato la carta
  const authorize = async (id, pi = `pi_test_${id}`) => {
    const { s } = await sessionOf(id);
    return hook.request('POST', '/webhooks/stripe', { id: `evt_${id}`, type: 'checkout.session.completed', data: { object: { id: s, payment_intent: pi, metadata: { tenant_id: String(t.id), takeaway_id: String(id) } } } }, { 'stripe-signature': 'mock-valid' });
  };
  const idOf = async (token) => (await adminDb.query('SELECT id FROM takeaway_orders WHERE public_token = $1', [token])).rows[0].id;

  before(async () => {
    server = await startServer();
    t = await createTenant({ businessType: 'restaurant' });
    await adminDb.query(`UPDATE tenants SET modules = modules || ARRAY['takeaway', 'payments']::text[], stripe_account_id = 'acct_prova123' WHERE id = $1`, [t.id]);
    admin = apiClient(server.port, t.host); await admin.login(t.username);
    client = apiClient(server.port, t.host);
    hook = apiClient(server.port, t.host);
    await admin.put('/takeaway/hours', { hours: [0, 1, 2, 3, 4, 5, 6].map(weekday => ({ weekday, open_time: '12:00', close_time: '23:00' })) });
    await setting('takeaway_portal_enabled', '1');
    await setting('takeaway_min_lead_minutes', '0');
    await setting('takeaway_payment_mode', 'optional');
  });
  after(async () => {
    await deleteTenants(t);
    await server.close();
    await closePools();
  });

  it('il sito dice come si può pagare; senza conto collegato o a pagamenti spenti si paga al ritiro', async () => {
    assert.deepEqual((await client.get('/public/takeaway/info')).body.payments, { mode: 'optional' });
    assert.equal((await admin.get('/takeaway/settings')).body.paymentsAvailable, true);
    assert.equal((await setting('takeaway_payment_mode', 'sempre')).status, 400);
    await adminDb.query(`UPDATE tenants SET stripe_account_id = NULL WHERE id = $1`, [t.id]);
    assert.deepEqual((await client.get('/public/takeaway/info')).body.payments, { mode: 'off' }, 'senza conto Stripe collegato i pagamenti non sono pronti');
    const noPay = await post({ pay_online: true });
    assert.equal(noPay.status, 201);
    assert.equal(noPay.body.checkout_url, undefined, 'si paga al ritiro, come sempre');
    await adminDb.query(`UPDATE tenants SET stripe_account_id = 'acct_prova123' WHERE id = $1`, [t.id]);
  });

  it('paga ora: la richiesta aspetta la carta e il locale non la vede finché non è autorizzata', async () => {
    const res = await post({ customer_name: 'Attesa carta' });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.match(res.body.checkout_url, /^https:\/\/checkout\.mock\/pay\/cs_mock_\d+\?return=/);
    const id = await idOf(res.body.token);
    const call = callsOf('createCheckout').at(-1);
    assert.equal(call.amountCents, 1000, '2 × 5,00 € ricalcolati dal server');
    assert.equal(call.destinationAccount, 'acct_prova123');
    assert.deepEqual(call.metadata, { tenant_id: String(t.id), takeaway_id: String(id) });
    assert.match(call.successUrl, new RegExp(`/order/${res.body.token}\\?pagamento=ok$`));

    assert.deepEqual((await admin.get('/takeaway/inbox')).body.filter(i => i.customer_name === 'Attesa carta'), [], 'nessuna notifica');
    assert.equal((await admin.get(`/takeaway/orders?date=${tomorrow}`)).body.some(o => o.id === id), false, 'nemmeno nell\'elenco');
    const mine = (await client.get(`/public/takeaway/orders/${res.body.token}`)).body;
    assert.deepEqual([mine.payment, mine.can_pay], [{ online: true, status: 'awaiting' }, true]);
    assert.equal((await admin.post(`/takeaway/orders/${id}/accept`, {})).body.code, 'AWAITING_PAYMENT', 'e non si accetta un ordine non pagato');
  });

  it('carta autorizzata → il locale vede la richiesta; accetta → si incassa; consegna senza scegliere il metodo', async () => {
    const res = await post({ customer_name: 'Pagante' });
    const id = await idOf(res.body.token);
    assert.equal((await authorize(id)).status, 200);
    assert.equal((await authorize(id)).status, 200, 'un avviso ripetuto non cambia nulla');
    assert.equal((await sessionOf(id)).ps, 'authorized');
    assert.equal((await admin.get('/takeaway/inbox')).body.some(i => i.id === id), true, 'ora compare nella campanella');

    const accepted = await admin.post(`/takeaway/orders/${id}/accept`, {});
    assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
    assert.deepEqual([accepted.body.status, accepted.body.payment_status, accepted.body.paid_method], ['accepted', 'paid', 'card']);
    assert.deepEqual(callsOf('capture').at(-1), { name: 'capture', paymentIntentId: `pi_test_${id}` });
    const mine = (await client.get(`/public/takeaway/orders/${res.body.token}`)).body;
    assert.deepEqual([mine.payment.status, mine.can_pay, /^\d{3}$/.test(mine.pickup_code)], ['paid', false, true]);
    assert.equal(JSON.stringify(mine).includes('pi_test'), false, 'mai identificativi di Stripe nelle risposte pubbliche');

    const delivered = await admin.post(`/takeaway/orders/${id}/picked-up`, {});
    assert.equal(delivered.status, 200, JSON.stringify(delivered.body));
    assert.equal(delivered.body.paid_method, 'card');
  });

  it('rifiuto, annullo del cliente e scadenza rilasciano la carta senza addebito', async () => {
    const rejected = await post({ customer_name: 'Rifiutato' });
    const rid = await idOf(rejected.body.token); await authorize(rid);
    assert.equal((await admin.post(`/takeaway/orders/${rid}/reject`, { reason: 'Finito' })).status, 200);
    assert.deepEqual(callsOf('cancel').at(-1), { name: 'cancel', paymentIntentId: `pi_test_${rid}` });
    assert.equal((await sessionOf(rid)).ps, 'canceled');

    const withdrawn = await post({ customer_name: 'Ritirato' });
    const wid = await idOf(withdrawn.body.token); await authorize(wid);
    assert.equal((await client.post(`/public/takeaway/orders/${withdrawn.body.token}/cancel`, {})).status, 200);
    assert.equal((await sessionOf(wid)).ps, 'canceled');

    const expired = await post({ customer_name: 'Scaduto' });
    const eid = await idOf(expired.body.token); await authorize(eid);
    await adminDb.query(`UPDATE takeaway_orders SET pickup_at = now() + interval '5 minutes' WHERE id = $1`, [eid]);
    await admin.get(`/takeaway/orders?date=${tomorrow}`);
    await client.get(`/public/takeaway/orders/${expired.body.token}`);
    const after = await sessionOf(eid);
    assert.deepEqual([after.status, after.ps], ['expired', 'canceled']);
    assert.equal(callsOf('cancel').some(c => c.paymentIntentId === `pi_test_${eid}`), true);
  });

  it('chi non finisce di pagare in mezz\'ora non ha mai fatto una richiesta, e libera la fascia', async () => {
    const res = await post({ customer_name: 'Distratto', time: '21:30' });
    const id = await idOf(res.body.token);
    await adminDb.query(`UPDATE takeaway_orders SET requested_at = now() - interval '31 minutes' WHERE id = $1`, [id]);
    await client.get(`/public/takeaway/orders/${res.body.token}`);
    const gone = await sessionOf(id);
    assert.deepEqual([gone.status, gone.ps], ['cancelled', 'canceled']);
    const expiredSession = await hook.request('POST', '/webhooks/stripe', { id: 'evt_x', type: 'checkout.session.expired', data: { object: { id: gone.s, metadata: { tenant_id: String(t.id), takeaway_id: String(id) } } } }, { 'stripe-signature': 'mock-valid' });
    assert.equal(expiredSession.status, 200, 'un avviso su un ordine già chiuso si ignora');
  });

  it('il cliente che chiude la pagina può riprendere il pagamento', async () => {
    const res = await post({ customer_name: 'Riprende', time: '22:00' });
    const again = await client.post(`/public/takeaway/orders/${res.body.token}/pay`, {});
    assert.equal(again.status, 200, JSON.stringify(again.body));
    assert.match(again.body.checkout_url, /^https:\/\/checkout\.mock\/pay\/cs_mock_\d+\?return=/);
    assert.notEqual(again.body.checkout_url, res.body.checkout_url, 'una pagina nuova');
    await authorize(await idOf(res.body.token));
    assert.equal((await client.post(`/public/takeaway/orders/${res.body.token}/pay`, {})).body.code, 'NOTHING_TO_PAY', 'pagato: non c\'è altro da fare');
  });

  it('se la carta non risponde all\'incasso l\'ordine resta da accettare', async () => {
    const res = await post({ customer_name: 'Carta rifiutata', time: '22:15' });
    const id = await idOf(res.body.token); await authorize(id, 'pi_test_fail');
    const failed = await admin.post(`/takeaway/orders/${id}/accept`, {});
    assert.deepEqual([failed.status, failed.body.code], [409, 'PAYMENT_FAILED']);
    assert.deepEqual([(await sessionOf(id)).status, (await sessionOf(id)).ps], ['requested', 'authorized']);
  });

  it('obbligatorio: si paga sempre online; senza conto collegato non si ordina', async () => {
    await setting('takeaway_payment_mode', 'required');
    const res = await post({ pay_online: false, customer_name: 'Obbligato', time: '22:30' });
    assert.equal(res.status, 201);
    assert.match(res.body.checkout_url, /^https:\/\/checkout\.mock/);
    await adminDb.query(`UPDATE tenants SET stripe_account_id = NULL WHERE id = $1`, [t.id]);
    assert.deepEqual((await client.get('/public/takeaway/info')).body.payments, { mode: 'unavailable' }, 'il sito lo sa e non fa ordinare');
    const blocked = await post({ customer_name: 'Senza conto', time: '22:45' });
    assert.deepEqual([blocked.status, blocked.body.code], [409, 'PAYMENTS_UNAVAILABLE'], 'meglio dirlo che far pagare al banco di nascosto');
    await adminDb.query(`UPDATE tenants SET stripe_account_id = 'acct_prova123' WHERE id = $1`, [t.id]);
    await setting('takeaway_payment_mode', 'optional');
  });

  it('il webhook vuole la firma e non conosce il locale dal chiamante', async () => {
    const bad = await hook.request('POST', '/webhooks/stripe', { id: 'e', type: 'checkout.session.completed', data: { object: {} } }, { 'stripe-signature': 'finta' });
    assert.equal(bad.status, 400);
    const none = await hook.request('POST', '/webhooks/stripe', { id: 'e', type: 'checkout.session.completed', data: { object: {} } });
    assert.equal(none.status, 400);
    // una pagina di pagamento che non è nostra non autorizza nulla, anche con la firma giusta
    const res = await post({ customer_name: 'Non toccare', time: '21:45' });
    const id = await idOf(res.body.token);
    const forged = await hook.request('POST', '/webhooks/stripe', { id: 'e2', type: 'checkout.session.completed', data: { object: { id: 'cs_altra_pagina', payment_intent: 'pi_x', metadata: { tenant_id: String(t.id), takeaway_id: String(id) } } } }, { 'stripe-signature': 'mock-valid' });
    assert.equal(forged.status, 200);
    assert.equal((await sessionOf(id)).ps, 'awaiting');
  });

  it('i contanti attesi non contano gli asporti pagati con carta', async () => {
    const { rows } = await adminDb.query(`SELECT COUNT(*)::int AS n FROM takeaway_orders WHERE tenant_id = $1 AND paid_method = 'card'`, [t.id]);
    assert.ok(rows[0].n >= 1);
    assert.equal((await admin.get('/sessions/expected-cash')).body.expected, 0, 'la carta non è nel cassetto');
  });
});
