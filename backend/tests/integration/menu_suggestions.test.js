// Suggerimenti del menu con il QR: li imposta solo l'amministratore, i clienti li ricevono già filtrati (mai prodotti nascosti o eliminati).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { startServer, createTenant, deleteTenants, closePools, apiClient, adminDb, PASSWORD } from './helpers.js';

describe('menu QR: suggerimenti', () => {
  let server, t, admin, cashier, anon, beer, hidden;

  before(async () => {
    server = await startServer();
    t = await createTenant();
    const name = `cassa-${t.slug}`;
    await adminDb.query('INSERT INTO users (username, password_hash, role, tenant_id) VALUES ($1, $2, $3, $4)', [name, await bcrypt.hash(PASSWORD, 4), 'cashier', t.id]);
    admin = apiClient(server.port, t.host); cashier = apiClient(server.port, t.host); anon = apiClient(server.port, t.host);
    await admin.login(t.username); await cashier.login(name);
    const add = async (n, category, visible = true) => (await adminDb.query(`INSERT INTO products (tenant_id, name, price, category, color, print_destination, visible) VALUES ($1, $2, 4, $3, '#00f', 'bar', $4) RETURNING id`, [t.id, n, category, visible])).rows[0].id;
    beer = await add('Birra', 'Bevande'); hidden = await add('Amaro', 'Bevande', false);
  });
  after(async () => { await deleteTenants(t); await server.close(); await closePools(); });

  it('solo l\'amministratore li legge e li scrive; un prodotto che non esiste è un errore', async () => {
    assert.equal((await cashier.get('/menu-suggestions')).status, 403);
    assert.equal((await cashier.request('PUT', '/menu-suggestions', { rules: [] })).status, 403);
    assert.equal((await admin.request('PUT', '/menu-suggestions', { rules: [{ category: 'Cibo', suggest: 999999 }] })).status, 400);
    assert.equal((await admin.request('PUT', '/menu-suggestions', { rules: [{ category: 'Cibo', product: 1, suggest: beer }] })).status, 400, 'o la categoria o il prodotto');
    const ok = await admin.request('PUT', '/menu-suggestions', { rules: [{ category: 'Cibo', suggest: beer }, { product: t.productId, suggest: hidden }] });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal((await admin.get('/menu-suggestions')).body.rules.length, 2);
  });

  it('i clienti ricevono solo i suggerimenti con il prodotto proposto in menu', async () => {
    const menu = await anon.get('/products/menu');
    assert.equal(menu.status, 200, JSON.stringify(menu.body));
    assert.deepEqual(menu.body.suggestions, [{ category: 'Cibo', suggest: beer }], 'quello verso il prodotto nascosto non arriva');
    assert.ok(!JSON.stringify(menu.body).includes('Amaro'), 'il prodotto nascosto non esce');
    await adminDb.query('UPDATE products SET visible = false WHERE id = $1', [beer]);
    assert.deepEqual((await anon.get('/products/menu')).body.suggestions, [], 'se il prodotto proposto sparisce dal menu, sparisce anche il suggerimento');
  });
});
