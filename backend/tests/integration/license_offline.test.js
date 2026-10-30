// Licenza e lavoro senza rete: a licenza scaduta passa solo un ordine battuto offline entro le dieci ore di tolleranza; il resto è fermo.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { startServer, createTenant, deleteTenants, closePools, apiClient, adminDb } from './helpers.js';

describe('licenza scaduta e ordini offline', () => {
  let server, t, api;
  const HOUR = 3600 * 1000;
  const expireAt = (date) => adminDb.query('UPDATE tenants SET expires_at = $2 WHERE id = $1', [t.id, date]);
  const offlineOrder = (createdAt, extra = {}) => api.post('/orders', {
    items: [{ id: t.productId, name: 'Panino', quantity: 1 }], status: 'completed',
    session_id: t.sessionId, client_order_id: randomUUID(), client_created_at: new Date(createdAt).toISOString(), ...extra,
  });

  before(async () => {
    server = await startServer();
    t = await createTenant();
    api = apiClient(server.port, t.host);
    await expireAt(new Date(Date.now() + 30 * HOUR));
    await api.login(t.username);
  });
  after(async () => {
    await deleteTenants(t);
    await server.close();
    await closePools();
  });

  it('con la licenza valida il dispositivo sa quando scade e fino a quando può lavorare senza rete', async () => {
    const me = (await api.get('/auth/me')).body;
    assert.equal(me.license.expiresAt === null, false);
    assert.equal(new Date(me.license.offlineUntil) - new Date(me.license.expiresAt), 10 * HOUR);
    assert.ok(Math.abs(new Date(me.license.serverTime) - Date.now()) < 5000, 'porta l\'ora del server');
    assert.equal(typeof (await api.post('/auth/refresh', {})).body.license.offlineUntil, 'string');
  });

  it('scaduta da un\'ora: un ordine battuto offline prima della scadenza o nelle dieci ore passa, un ordine normale no', async () => {
    const expired = new Date(Date.now() - HOUR);
    await expireAt(expired);
    const before = await offlineOrder(expired.getTime() - 5 * 60_000);
    assert.equal(before.status, 200, JSON.stringify(before.body));
    const inGrace = await offlineOrder(expired.getTime() + 30 * 60_000);
    assert.equal(inGrace.status, 200, JSON.stringify(inGrace.body));
    const { rows } = await adminDb.query(`SELECT action FROM audit_logs WHERE tenant_id = $1 AND action = 'LATE_SYNC_AFTER_EXPIRY'`, [t.id]);
    assert.equal(rows.length, 2, 'ogni ordine accettato dopo la scadenza lascia una traccia');

    const normal = await api.post('/orders', { items: [{ id: t.productId, name: 'Panino', quantity: 1 }], status: 'completed' });
    assert.deepEqual([normal.status, normal.body.code], [402, 'LICENSE_EXPIRED']);
    assert.equal((await api.get('/products')).status, 402, 'il resto dell\'app è fermo');
  });

  it('oltre le dieci ore, o nel futuro, l\'ordine offline è rifiutato', async () => {
    const expired = new Date(Date.now() - 12 * HOUR);
    await expireAt(expired);
    const late = await offlineOrder(expired.getTime() + 11 * HOUR);
    assert.deepEqual([late.status, late.body.code], [402, 'LICENSE_EXPIRED']);
    const future = await offlineOrder(Date.now() + 3 * HOUR);
    assert.equal(future.status, 402);
    const ok = await offlineOrder(expired.getTime() + 9 * HOUR);
    assert.equal(ok.status, 200, 'dentro le dieci ore passa ancora');
  });

  it('un nuovo invio dello stesso ordine non si duplica nemmeno a licenza scaduta', async () => {
    const expired = new Date(Date.now() - 2 * HOUR);
    await expireAt(expired);
    const key = randomUUID();
    const first = await offlineOrder(expired.getTime() - 60_000, { client_order_id: key });
    const again = await offlineOrder(expired.getTime() - 60_000, { client_order_id: key });
    assert.deepEqual([first.status, again.status, again.body.duplicate], [200, 200, true]);
  });

  it('il login con la licenza scaduta resta rifiutato', async () => {
    const fresh = apiClient(server.port, t.host);
    const res = await fresh.login(t.username);
    assert.deepEqual([res.status, res.body.code], [402, 'LICENSE_EXPIRED']);
  });
});
