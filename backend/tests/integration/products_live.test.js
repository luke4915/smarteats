// Disponibilità e visibilità dei prodotti in tempo reale: chi cambia la scorta (anche la cassa) o nasconde un prodotto (l'amministratore)
// lo fa sapere a tutti i dispositivi del locale, con scorta e visibilità complete, così nessuna tessera resta vecchia.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { startServer, createTenant, deleteTenants, closePools, apiClient, adminDb, connectWs, sleep, PASSWORD } from './helpers.js';

describe('prodotti: scorta e visibilità arrivano a tutti i dispositivi', () => {
  let server, t, admin, cashier, staff;

  before(async () => {
    server = await startServer();
    t = await createTenant();
    const cashierName = `cassa-${t.slug}`;
    await adminDb.query('INSERT INTO users (username, password_hash, role, tenant_id) VALUES ($1, $2, $3, $4)', [cashierName, await bcrypt.hash(PASSWORD, 4), 'cashier', t.id]);
    [admin, cashier] = [apiClient(server.port, t.host), apiClient(server.port, t.host)];
    await admin.login(t.username);
    await cashier.login(cashierName);
    staff = await connectWs(server.port, t.host, { cookie: admin.cookie });
  });
  after(async () => {
    staff?.ws.close();
    await deleteTenants(t);
    await server.close();
    await closePools();
  });

  const stockEvents = () => staff.messages.filter(m => m.type === 'product_stock_updated' && m.product.id === t.productId);

  it('la cassa segna un prodotto esaurito, poi con N porzioni: ogni cambio arriva a tutti, con visibilità e scorta complete', async () => {
    const out = await cashier.request('PATCH', `/products/${t.productId}/stock`, { stock_enabled: true, stock: 0 });
    assert.equal(out.status, 200, JSON.stringify(out.body));
    await sleep(150);
    assert.deepEqual(stockEvents().at(-1).product, { id: t.productId, stock: 0, stock_enabled: true, visible: true });

    assert.equal((await cashier.request('PATCH', `/products/${t.productId}/stock`, { stock_enabled: true, stock: 12 })).status, 200);
    await sleep(150);
    assert.deepEqual(stockEvents().at(-1).product, { id: t.productId, stock: 12, stock_enabled: true, visible: true });

    assert.equal((await cashier.request('PATCH', `/products/${t.productId}/stock`, { stock_enabled: false, stock: null })).status, 200);
    await sleep(150);
    assert.deepEqual(stockEvents().at(-1).product, { id: t.productId, stock: null, stock_enabled: false, visible: true });
  });

  it('la cassa cambia solo la disponibilità: prezzo e visibilità restano dell\'amministratore', async () => {
    assert.equal((await cashier.request('PUT', `/products/${t.productId}`, { name: 'Panino', price: 1, category: 'Cibo' })).status, 403);
    assert.equal((await cashier.request('PATCH', '/products/bulk-visibility', { ids: [t.productId], visible: false })).status, 403);
  });

  it('nascondere e mostrare: l\'avviso porta anche la scorta, così la tessera non perde il conteggio', async () => {
    await adminDb.query('UPDATE products SET stock_enabled = true, stock = 7 WHERE id = $1', [t.productId]);
    assert.equal((await admin.request('PATCH', '/products/bulk-visibility', { ids: [t.productId], visible: false })).status, 200);
    await sleep(150);
    assert.deepEqual(stockEvents().at(-1).product, { id: t.productId, stock: 7, stock_enabled: true, visible: false });
    assert.equal((await admin.request('PATCH', '/products/bulk-visibility', { ids: [t.productId], visible: true })).status, 200);
    await sleep(150);
    assert.equal(stockEvents().at(-1).product.visible, true);
  });

  it('creare, modificare ed eliminare un prodotto arriva a tutti, con chi l\'ha fatto; la cassa non può', async () => {
    const mark = staff.messages.length;
    const created = await admin.request('POST', '/products', { name: 'Gelato', price: 3.5, category: 'Dolci', color: '#ff8800', visible: true, print_destination: 'kitchen' });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const id = created.body.id;
    const changed = await admin.request('PUT', `/products/${id}`, { name: 'Gelato artigianale', price: 4, category: 'Dolci', color: '#ff8800', visible: true, print_destination: 'kitchen' });
    assert.equal(changed.status, 200, JSON.stringify(changed.body));
    assert.equal((await cashier.request('DELETE', `/products/${id}`)).status, 403);
    assert.equal((await admin.request('DELETE', `/products/${id}`)).status, 200);
    await sleep(200);
    const seen = staff.messages.slice(mark).filter(m => m.type.startsWith('product_') && m.type !== 'product_stock_updated');
    assert.deepEqual(seen.map(m => m.type), ['product_created', 'product_updated', 'product_deleted']);
    assert.equal(seen[0].product.id, id);
    assert.equal(seen[1].product.name, 'Gelato artigianale');
    assert.equal(seen[2].id, id);
    assert.ok(seen.every(m => m.by === t.userId), 'ogni avviso dice chi l\'ha fatto');
  });
});
