// Dati riservati: con il blocco acceso costi, margini e statistiche non partono dal server finché un amministratore non sblocca.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { startServer, createTenant, deleteTenants, closePools, apiClient, adminDb, signToken, PASSWORD } from './helpers.js';

describe('dati riservati', () => {
  let server, t, other, admin, manager, cashier, otherAdmin;
  const ids = {};
  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
  const addUser = async (tenant, name, role) => {
    await adminDb.query(`INSERT INTO users (username, password_hash, role, tenant_id) VALUES ($1, $2, $3, $4)`, [name, await bcrypt.hash(PASSWORD, 4), role, tenant.id]);
    return name;
  };
  const setLock = (value, client = admin) => client.put('/settings/reserved_data_lock', { value });

  before(async () => {
    server = await startServer();
    [t, other] = [await createTenant({ businessType: 'restaurant' }), await createTenant({ businessType: 'restaurant' })];
    for (const x of [t, other]) await adminDb.query(`UPDATE tenants SET modules = modules || ARRAY['inventory', 'stats']::text[], inventory_mode = 'warehouse', inventory_depletion = 'recipes' WHERE id = $1`, [x.id]);
    const managerName = await addUser(t, `manager-${t.slug}`, 'manager');
    const cashierName = await addUser(t, `cashier-${t.slug}`, 'cashier');
    [admin, manager, cashier, otherAdmin] = [t, t, t, other].map(x => apiClient(server.port, x.host));
    await admin.login(t.username); await manager.login(managerName); await cashier.login(cashierName); await otherAdmin.login(other.username);

    ids.oil = (await admin.post('/ingredients', { name: 'Olio', base_unit: 'ml' })).body.id;
    ids.supplier = (await admin.post('/suppliers', { name: 'Rossi Alimentari' })).body.id;
    const receipt = await admin.post('/goods-receipts', { supplier_id: ids.supplier, received_on: today(), lines: [
      { ingredient_id: ids.oil, quantity: 2, purchase_unit_name: 'Cassa', base_units_per_purchase_unit: 6000, unit_cost_cents: 3600, vat_rate: 10 }] });
    ids.receipt = receipt.body.id;
    await admin.put(`/products/${t.productId}/recipe`, { lines: [{ ingredient_id: ids.oil, quantity: 50 }] });
  });
  after(async () => {
    await deleteTenants(t, other);
    await server.close();
    await closePools();
  });

  const reserved = async (client = admin) => ({
    report: await client.get(`/inventory/report?from=${today()}&to=${today()}`),
    stats: await client.get(`/stats?sessions=${t.sessionId}&tz=Europe/Rome`),
    csv: await client.get(`/exports/session/${t.sessionId}/csv`),
  });

  it('di partenza il blocco è spento e tutto si vede', async () => {
    assert.deepEqual((await admin.get('/reserved-data/status')).body, { enabled: false, unlocked: false, locked: false, unlockedUntil: null });
    const r = await reserved();
    assert.deepEqual([r.report.status, r.stats.status, r.csv.status], [200, 200, 200]);
    assert.equal((await admin.get('/ingredients')).body[0].weighted_average_cost, 0.6);
    assert.equal((await manager.post('/reserved-data/unlock', { password: PASSWORD })).body.code, 'LOCK_DISABLED', 'senza blocco non serve sbloccare');
  });

  it('il blocco lo accende solo l\'amministratore, con 1 o 0', async () => {
    assert.equal((await setLock('1', manager)).status, 403);
    assert.equal((await setLock('forse')).status, 400);
    assert.equal((await setLock('1')).status, 200);
    assert.equal((await manager.get('/reserved-data/status')).body.locked, true);
  });

  it('bloccato: report, statistiche ed esportazioni sono rifiutati e non mandano nulla', async () => {
    const r = await reserved();
    for (const res of [r.report, r.stats, r.csv]) {
      assert.equal(res.status, 403);
      assert.equal(res.body.code, 'RESERVED_LOCKED');
      assert.deepEqual(Object.keys(res.body).sort(), ['code', 'error'], 'nessun dato nella risposta');
    }
  });

  it('bloccato: i costi diventano null in ogni risposta, il resto passa', async () => {
    const ingredient = (await manager.get('/ingredients')).body[0];
    assert.deepEqual([ingredient.name, ingredient.quantity_on_hand, ingredient.weighted_average_cost], ['Olio', 12000, null]);
    const supplier = (await manager.get('/suppliers')).body[0];
    assert.equal(supplier.items[0].unit_cost_cents, null);
    assert.equal(supplier.items[0].purchase_unit_name, 'Cassa');
    assert.equal((await manager.get('/goods-receipts')).body[0].total_cost_cents, null);
    const detail = (await manager.get(`/goods-receipts/${ids.receipt}`)).body;
    assert.deepEqual([detail.total_cost_cents, detail.lines[0].unit_cost_cents, detail.lines[0].line_cost_cents, detail.lines[0].base_quantity], [null, null, null, 12000]);
    assert.equal((await manager.get('/inventory/movements')).body[0].unit_cost, null);
    const recipe = (await manager.get(`/products/${t.productId}/recipe`)).body;
    assert.equal(recipe.cost_cents_per_portion, null);
    assert.equal(recipe.lines.length, 1);
    const created = await admin.post('/goods-receipts', { supplier_id: ids.supplier, received_on: today(), lines: [
      { ingredient_id: ids.oil, quantity: 1, purchase_unit_name: 'Cassa', base_units_per_purchase_unit: 6000, unit_cost_cents: 5400 }] });
    assert.equal(created.status, 201);
    assert.equal(created.body.totalCostCents, null, 'anche la risposta di una scrittura non rivela i costi');
    assert.equal(Number((await adminDb.query('SELECT weighted_average_cost FROM ingredients WHERE id = $1', [ids.oil])).rows[0].weighted_average_cost) > 0, true, 'ma il costo medio si è aggiornato davvero');
  });

  it('lo sblocco chiede la password di un amministratore: sbagliata, di un altro locale o senza permessi no', async () => {
    const wrong = await manager.post('/reserved-data/unlock', { password: 'sbagliata123' });
    assert.deepEqual([wrong.status, wrong.body.code], [403, 'WRONG_ADMIN_PASSWORD']);
    assert.equal((await manager.post('/reserved-data/unlock', {})).status, 400);
    assert.equal((await cashier.post('/reserved-data/unlock', { password: PASSWORD })).status, 403, 'la cassa non sblocca');
    // la password del responsabile non vale: serve quella di un admin
    await adminDb.query('UPDATE users SET password_hash = $2 WHERE username = $1', [`manager-${t.slug}`, await bcrypt.hash('altra-password-1', 4)]);
    assert.equal((await manager.post('/reserved-data/unlock', { password: 'altra-password-1' })).status, 403);
    await adminDb.query('UPDATE users SET password_hash = $2 WHERE username = $1', [`manager-${t.slug}`, await bcrypt.hash(PASSWORD, 4)]);
    assert.equal((await manager.get('/inventory/report?from=2026-01-01&to=2026-01-02')).status, 403, 'i tentativi falliti non sbloccano');
  });

  it('sbloccato: i dati tornano per 10 minuti, solo a chi ha sbloccato, e lo sblocco è registrato', async () => {
    const res = await manager.post('/reserved-data/unlock', { password: PASSWORD });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual([res.body.unlocked, res.body.locked], [true, false]);
    const minutes = (new Date(res.body.unlockedUntil) - Date.now()) / 60_000;
    assert.ok(minutes > 9 && minutes <= 10, `dura 10 minuti (${minutes})`);

    assert.equal((await manager.get(`/inventory/report?from=${today()}&to=${today()}`)).status, 200);
    assert.ok((await manager.get('/ingredients')).body[0].weighted_average_cost > 0);
    assert.equal((await manager.get('/reserved-data/status')).body.unlocked, true);
    assert.equal((await admin.get(`/inventory/report?from=${today()}&to=${today()}`)).status, 403, 'un\'altra sessione, anche dell\'admin, resta bloccata');

    const { rows } = await adminDb.query(`SELECT action, details FROM audit_logs WHERE tenant_id = $1 AND action LIKE 'UNLOCK_RESERVED_DATA%' ORDER BY id`, [t.id]);
    assert.ok(rows.some(r => r.action === 'UNLOCK_RESERVED_DATA_FAILED'));
    const ok = rows.find(r => r.action === 'UNLOCK_RESERVED_DATA');
    assert.equal(ok.details.authorizedBy, t.username);
    assert.ok(!JSON.stringify(rows).includes(PASSWORD), 'la password non finisce nell\'audit');
  });

  it('si richiude subito, e allo scadere dello sblocco', async () => {
    assert.equal((await manager.post('/reserved-data/lock')).body.locked, true);
    assert.equal((await manager.get(`/inventory/report?from=${today()}&to=${today()}`)).status, 403);

    const now = Math.floor(Date.now() / 1000);
    const forged = apiClient(server.port, t.host);
    forged.setToken(signToken(t, { reservedUntil: now - 5 }));
    assert.equal((await forged.get(`/inventory/report?from=${today()}&to=${today()}`)).status, 403, 'sblocco scaduto');
    forged.setToken(signToken(t, { reservedUntil: now + 300 }));
    assert.equal((await forged.get(`/inventory/report?from=${today()}&to=${today()}`)).status, 200, 'sblocco ancora valido');
    forged.setToken(signToken(t, { reservedUntil: now + 300 }).slice(0, -3) + 'abc');
    assert.equal((await forged.get('/inventory/report')).status, 403, 'un token alterato non vale');
  });

  it('il blocco è di ogni locale: un altro locale non lo vede e non ne è toccato', async () => {
    assert.equal((await otherAdmin.get('/reserved-data/status')).body.enabled, false);
    assert.equal((await otherAdmin.get(`/inventory/report?from=${today()}&to=${today()}`)).status, 200);
  });

  it('spento, tutto torna visibile anche senza sbloccare', async () => {
    assert.equal((await setLock('0')).status, 200);
    assert.equal((await manager.get(`/inventory/report?from=${today()}&to=${today()}`)).status, 200);
    assert.ok((await manager.get('/ingredients')).body[0].weighted_average_cost > 0);
  });
});
