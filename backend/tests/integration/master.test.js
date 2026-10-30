// Pannello master: personalizzazione degli scontrini per tenant ed eliminazione completa di un tenant.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { startServer, createTenant, deleteTenants, closePools, apiClient, adminDb } from './helpers.js';
import { pool as appPool } from '../../db.js';
import { purgeAuditLogsOf } from '../../utils/auditRetention.js';

process.env.STRIPE_DRIVER ||= 'mock';
process.env.MASTER_JWT_SECRET ||= 'segreto-master-di-prova-lungo-almeno-32-caratteri';
const masterCookie = { cookie: `master_token=${jwt.sign({ master: true }, process.env.MASTER_JWT_SECRET)}` };

// PNG minimo valido (1x1) in data URL
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('pannello master', () => {
  let server, t1, t2, master, api1, api2;
  const mput = (t, body) => master.request('PUT', `/master/tenants/${t.id}/receipt`, body, masterCookie);
  const mget = (t) => master.request('GET', `/master/tenants/${t.id}/receipt`, undefined, masterCookie);

  before(async () => {
    server = await startServer();
    [t1, t2] = [await createTenant(), await createTenant()];
    master = apiClient(server.port, t1.host);
    api1 = apiClient(server.port, t1.host);
    api2 = apiClient(server.port, t2.host);
    await api1.login(t1.username);
    await api2.login(t2.username);
  });

  after(async () => {
    await deleteTenants(t1, t2);
    await server.close();
    await closePools();
  });

  it('senza sessione master la personalizzazione non si legge né si scrive', async () => {
    assert.equal((await master.get(`/master/tenants/${t1.id}/receipt`)).status, 401);
    assert.equal((await master.request('PUT', `/master/tenants/${t1.id}/receipt`, {})).status, 401);
    // il token di un tenant non vale come sessione master
    assert.equal((await api1.get(`/master/tenants/${t1.id}/receipt`)).status, 401);
  });

  it('testi e immagini si salvano per tenant e la cassa li legge; i campi vuoti tornano al predefinito', async () => {
    const res = await mput(t1, { receipt_org_name: '  Pro Loco Prova ', receipt_total_label: 'TOTALE OFFERTA', receipt_logo: PNG, receipt_side_image: PNG, receipt_title: '' });
    assert.equal(res.status, 200);

    assert.deepEqual(Object.keys((await mget(t1)).body).sort(), ['receipt_logo', 'receipt_org_name', 'receipt_side_image', 'receipt_total_label']);
    const seenByCassa = (await api1.get('/settings/all')).body;
    assert.equal(seenByCassa.receipt_org_name, 'Pro Loco Prova');
    assert.equal(seenByCassa.receipt_logo, PNG);

    // un altro tenant non vede nulla
    assert.deepEqual((await mget(t2)).body, {});
    assert.deepEqual((await api2.get('/settings/all')).body, {});

    // il salvataggio sostituisce l'insieme: ciò che manca viene tolto
    await mput(t1, { receipt_org_name: 'Nuovo nome' });
    assert.deepEqual((await mget(t1)).body, { receipt_org_name: 'Nuovo nome' });
  });

  it('valida immagini e lunghezze; tenant inesistente: 404', async () => {
    assert.equal((await mput(t1, { receipt_logo: 'http://esempio.it/logo.png' })).status, 400);
    assert.equal((await mput(t1, { receipt_logo: 'data:image/svg+xml;base64,AAAA' })).status, 400);
    assert.equal((await mput(t1, { receipt_logo: `data:image/png;base64,${'A'.repeat(150_001)}` })).status, 400);
    assert.equal((await mput(t1, { receipt_item_header: 'x'.repeat(31) })).status, 400);
    assert.equal((await master.request('GET', '/master/tenants/999999999/receipt', undefined, masterCookie)).status, 404);
  });

  it('eliminare un tenant con dispositivi, ordini e personalizzazione cancella tutto', async () => {
    const doomed = await createTenant();
    const api = apiClient(server.port, doomed.host);
    await api.login(doomed.username);
    const device = (await api.post('/devices')).body;
    const order = await api.post('/orders', { items: [{ id: doomed.productId, name: 'Panino', quantity: 1 }], status: 'completed', device_id: device.id, device_seq: 1 });
    assert.equal(order.status, 200);
    await master.request('PUT', `/master/tenants/${doomed.id}/receipt`, { receipt_org_name: 'Da eliminare' }, masterCookie);

    const res = await master.request('DELETE', `/master/tenants/${doomed.id}`, { confirmSlug: doomed.slug }, masterCookie);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    for (const table of ['devices', 'orders', 'settings', 'users']) {
      const { rows } = await adminDb.query(`SELECT 1 FROM ${table} WHERE tenant_id = $1`, [doomed.id]);
      assert.equal(rows.length, 0, table);
    }
    assert.equal((await adminDb.query('SELECT 1 FROM tenants WHERE id = $1', [doomed.id])).rows.length, 0);
  });

  it('l\'utente applicativo non può scrivere sui tenant né cancellare l\'audit; il master non scavalca la RLS', async () => {
    await assert.rejects(appPool.query('DELETE FROM tenants WHERE id = $1', [t1.id]), /permission denied|permesso negato/i);
    await assert.rejects(appPool.query(`UPDATE tenants SET active = false WHERE id = $1`, [t1.id]), /permission denied|permesso negato/i);
    await assert.rejects(appPool.query(`INSERT INTO tenants (slug, name) VALUES ('abusivo', 'x')`), /permission denied|permesso negato/i);
    await assert.rejects(appPool.query('DELETE FROM audit_logs'), /permission denied|permesso negato/i);
    await assert.rejects(appPool.query(`UPDATE audit_logs SET action = 'x'`), /permission denied|permesso negato/i);
    await assert.rejects(appPool.query('TRUNCATE orders'), /permission denied|permesso negato/i);
    // letture del tenant restano possibili (login, licenza)
    assert.equal((await appPool.query('SELECT 1 FROM tenants WHERE id = $1', [t1.id])).rows.length, 1);
  });

  it('disattivare un tenant blocca subito le pagine pubbliche, senza aspettare la cache dei sottodomini', async () => {
    const t = await createTenant();
    const pub = apiClient(server.port, t.host);
    try {
      assert.equal((await pub.get('/products/menu')).status, 200); // ora il sottodominio è in cache
      assert.equal((await master.request('PATCH', `/master/tenants/${t.id}/active`, { active: false }, masterCookie)).status, 200);
      const blocked = await pub.get('/products/menu');
      assert.equal(blocked.status, 403);
      assert.equal(blocked.body.code, 'TENANT_INACTIVE');
      assert.equal((await master.request('PATCH', `/master/tenants/${t.id}/active`, { active: true }, masterCookie)).status, 200);
      assert.equal((await pub.get('/products/menu')).status, 200);
    } finally {
      await deleteTenants(t);
    }
  });

  it('rinominare un locale: cambia il nome, non l\'indirizzo, e lascia traccia nell\'audit del locale', async () => {
    const t = await createTenant();
    try {
      const before = (await master.request('GET', '/master/tenants', undefined, masterCookie)).body.find(x => x.id === t.id);
      const res = await master.request('PATCH', `/master/tenants/${t.id}/name`, { name: '  Sagra del Calzone ' }, masterCookie);
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(res.body.name, 'Sagra del Calzone', 'il nome si salva senza spazi ai lati');
      assert.equal(res.body.slug, before.slug, 'l\'indirizzo non cambia');
      assert.equal((await master.request('PATCH', `/master/tenants/${t.id}/name`, { name: '   ' }, masterCookie)).status, 400);
      assert.equal((await master.request('PATCH', '/master/tenants/999999999/name', { name: 'X' }, masterCookie)).status, 404);
      const { rows } = await adminDb.query(`SELECT details FROM audit_logs WHERE tenant_id = $1 AND action = 'MASTER_RENAME_TENANT'`, [t.id]);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].details.name, 'Sagra del Calzone');
    } finally {
      await deleteTenants(t);
    }
  });

  it('registro di audit: le righe oltre i 30 giorni si cancellano (solo di quel locale), le recenti restano; l\'app non può cancellarle da sola', async () => {
    const [t, other] = [await createTenant(), await createTenant()];
    try {
      const put = (tenant, action, days) => adminDb.query(`INSERT INTO audit_logs (tenant_id, action, details, created_at) VALUES ($1, $2, '{}', now() - make_interval(days => $3))`, [tenant.id, action, days]);
      await put(t, 'VECCHIA', 45); await put(t, 'DI_UN_MESE', 31); await put(t, 'RECENTE', 29); await put(t, 'OGGI', 0);
      await put(other, 'ALTRO_LOCALE_VECCHIA', 45);
      assert.equal(await purgeAuditLogsOf(t.id, 30), 2, 'cancellate solo le due oltre i 30 giorni');
      const left = async (tenant) => (await adminDb.query('SELECT action FROM audit_logs WHERE tenant_id = $1 AND action NOT IN (\'CREATE_PRODUCT\') ORDER BY action', [tenant.id])).rows.map(r => r.action);
      assert.deepEqual((await left(t)).filter(a => ['VECCHIA', 'DI_UN_MESE', 'RECENTE', 'OGGI'].includes(a)), ['OGGI', 'RECENTE']);
      assert.ok((await left(other)).includes('ALTRO_LOCALE_VECCHIA'), 'un altro locale non si tocca: ogni pulizia è sul suo locale');
      assert.equal(await purgeAuditLogsOf(t.id, 30), 0, 'rilanciarla non fa niente');
      await assert.rejects(appPool.query('DELETE FROM audit_logs'), /permission denied|permesso negato/i);
    } finally {
      await deleteTenants(t, other);
    }
  });

  it('messaggio del menu pubblico: lo scrive solo il master, per locale, e il QR lo mostra ai clienti', async () => {
    const menu = (t) => `/master/tenants/${t.id}/menu`;
    assert.equal((await master.get(menu(t1))).status, 401, 'serve il master');
    assert.equal((await api1.request('PUT', menu(t1), { welcome_message: 'x' })).status, 401, 'nemmeno l\'admin del locale');
    assert.deepEqual((await master.request('GET', menu(t1), undefined, masterCookie)).body, { welcome_message: '' });

    const saved = await master.request('PUT', menu(t1), { welcome_message: '  Benvenuti alla sagra!  ' }, masterCookie);
    assert.deepEqual([saved.status, saved.body.welcome_message], [200, 'Benvenuti alla sagra!']);
    assert.deepEqual((await apiClient(server.port, t1.host).get('/settings')).body, { welcome_message: 'Benvenuti alla sagra!' }, 'i clienti lo leggono dal menu pubblico');
    assert.deepEqual((await apiClient(server.port, t2.host).get('/settings')).body, {}, 'un altro locale non lo vede');
    assert.equal((await api1.put('/settings/welcome_message', { value: 'Cambiato dal locale' })).status, 400, 'il locale non lo cambia');

    assert.equal((await master.request('PUT', menu(t1), { welcome_message: 'a'.repeat(301) }, masterCookie)).status, 400);
    assert.equal((await master.request('GET', '/master/tenants/999999999/menu', undefined, masterCookie)).status, 404);
    assert.equal((await master.request('PUT', menu(t1), { welcome_message: '' }, masterCookie)).status, 200);
    assert.deepEqual((await apiClient(server.port, t1.host).get('/settings')).body, {}, 'vuoto = nessun messaggio');
  });

  it('pagamenti con carta: il master collega il conto Stripe del locale, a mano o con il collegamento guidato', async () => {
    const pay = (t) => `/master/tenants/${t.id}/payments`;
    assert.equal((await master.get(pay(t1))).status, 401);
    assert.equal((await api1.request('PUT', pay(t1), { stripe_account_id: 'acct_x' }, undefined)).status, 401, 'nemmeno l\'admin del locale');
    const start = (await master.request('GET', pay(t1), undefined, masterCookie)).body;
    assert.deepEqual([start.driver, start.stripe_account_id, start.account, start.module_enabled], ['mock', null, null, false]);

    assert.equal((await master.request('PUT', pay(t1), { stripe_account_id: 'non-un-conto' }, masterCookie)).status, 400);
    const linked = await master.request('PUT', pay(t1), { stripe_account_id: 'acct_1AbCdEf' }, masterCookie);
    assert.deepEqual([linked.status, linked.body.stripe_account_id, linked.body.account.chargesEnabled], [200, 'acct_1AbCdEf', true]);
    assert.equal((await master.request('PUT', pay(t1), { stripe_account_id: null }, masterCookie)).body.stripe_account_id, null, 'si può scollegare');

    const guided = await master.request('POST', `${pay(t2)}/onboard`, {}, masterCookie);
    assert.equal(guided.status, 200, JSON.stringify(guided.body));
    assert.match(guided.body.stripe_account_id, /^acct_mock\d+$/);
    assert.match(guided.body.url, /^https:\/\/connect\.mock\/onboard\/acct_mock/);
    assert.equal((await master.request('GET', pay(t2), undefined, masterCookie)).body.stripe_account_id, guided.body.stripe_account_id, 'il conto creato resta salvato');
    assert.equal((await master.request('GET', '/master/tenants/999999999/payments', undefined, masterCookie)).status, 404);
  });

  it('elenco tenant del master con il numero di utenti', async () => {
    const res = await master.request('GET', '/master/tenants', undefined, masterCookie);
    assert.equal(res.status, 200);
    const mine = res.body.find(x => x.id === t1.id);
    assert.equal(Number(mine.user_count), 1);
  });
});
