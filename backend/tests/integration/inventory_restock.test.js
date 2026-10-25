// Magazzino, fase 5: scorte da riordinare, giorni di scorta, spesa per fornitore e prezzi d'acquisto cambiati.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { startServer, createTenant, deleteTenants, closePools, apiClient, adminDb, PASSWORD } from './helpers.js';

describe('magazzino: riordino, spesa e prezzi', () => {
  let server, t, other, api, cashier, otherApi;
  const ids = {};
  const line = (ingredient, quantity, cost, vat) => ({ ingredient_id: ingredient, quantity, purchase_unit_name: 'Confezione', base_units_per_purchase_unit: 6000, unit_cost_cents: cost, vat_rate: vat });
  const report = async (from, to, client = api) => (await client.get(`/inventory/report?from=${from}&to=${to}`)).body;
  // Un movimento scritto direttamente, con la sua data (l'app non scrive nel passato)
  const move = async (ingredientId, kind, change, daysAgo) => {
    await adminDb.query(`INSERT INTO ingredient_movements (tenant_id, ingredient_id, kind, quantity_change, created_at) VALUES ($1, $2, $3, $4, now() - make_interval(days => $5))`, [t.id, ingredientId, kind, change, daysAgo]);
  };

  before(async () => {
    server = await startServer();
    [t, other] = [await createTenant({ businessType: 'restaurant' }), await createTenant({ businessType: 'restaurant' })];
    for (const x of [t, other]) await adminDb.query(`UPDATE tenants SET modules = array_append(modules, 'inventory'), inventory_mode = 'warehouse', inventory_depletion = 'recipes' WHERE id = $1`, [x.id]);
    const cashierName = `cashier-${t.slug}`;
    await adminDb.query(`INSERT INTO users (username, password_hash, role, tenant_id) VALUES ($1, $2, 'cashier', $3)`, [cashierName, await bcrypt.hash(PASSWORD, 4), t.id]);
    [api, cashier, otherApi] = [t, t, other].map(x => apiClient(server.port, x.host));
    await api.login(t.username); await cashier.login(cashierName); await otherApi.login(other.username);
    ids.oil = (await api.post('/ingredients', { name: 'Olio', base_unit: 'ml', reorder_level: 1500 })).body.id;
    ids.flour = (await api.post('/ingredients', { name: 'Farina', base_unit: 'g' })).body.id;
    ids.salt = (await api.post('/ingredients', { name: 'Sale', base_unit: 'g', reorder_level: 100 })).body.id;
    ids.supplier = (await api.post('/suppliers', { name: 'Rossi Alimentari' })).body.id;
  });
  after(async () => {
    await deleteTenants(t, other);
    await server.close();
    await closePools();
  });

  it('i giorni di scorta vengono dal consumo recente, non dal vecchio', async () => {
    await adminDb.query('UPDATE ingredients SET quantity_on_hand = 1000 WHERE id = $1', [ids.oil]);
    await move(ids.oil, 'sale', -700, 3);
    await move(ids.oil, 'sale', -5000, 30);      // fuori dai 7 giorni
    await move(ids.oil, 'sale_reversal', 100, 2);  // uno storno rimette in dispensa: consumo netto 600
    const oil = (await api.get('/inventory/restock?days=7')).body.find(i => i.id === ids.oil);
    assert.deepEqual([oil.used_in_period, oil.used_per_day, oil.days_of_stock], [600, 85.714, 11.7]);
    const flour = (await api.get('/inventory/restock?days=7')).body.find(i => i.id === ids.flour);
    assert.equal(flour.days_of_stock, null, 'senza consumo non si può dire quanto dura');
  });

  it('da riordinare: solo con una scorta minima e a quella soglia o sotto', async () => {
    await adminDb.query('UPDATE ingredients SET quantity_on_hand = 400 WHERE id = $1', [ids.salt]);
    const low = (await api.get('/inventory/restock?only=low')).body;
    assert.deepEqual(low.map(i => i.name).sort(), ['Olio']);   // l'olio ha 1000 ≤ 1500; il sale 400 > 100; la farina non ha soglia
    await adminDb.query('UPDATE ingredients SET quantity_on_hand = 50 WHERE id = $1', [ids.salt]);
    assert.deepEqual((await api.get('/inventory/restock?only=low')).body.map(i => i.name).sort(), ['Olio', 'Sale']);
    await api.put(`/ingredients/${ids.salt}`, { name: 'Sale', base_unit: 'g', yield_percent: 100, reorder_level: 100, active: false });
    assert.deepEqual((await api.get('/inventory/restock?only=low')).body.map(i => i.name), ['Olio'], 'un ingrediente disattivato non si riordina');
  });

  it('permessi e filtri: solo chi gestisce, i dati restano del locale', async () => {
    assert.equal((await cashier.get('/inventory/restock')).status, 403);
    assert.equal((await api.get('/inventory/restock?days=0')).status, 400);
    assert.equal((await api.get('/inventory/restock?only=tutto')).status, 400);
    assert.equal((await otherApi.get('/inventory/restock')).body.length, 0);
  });

  it('spesa per fornitore e prezzi cambiati nel report', async () => {
    assert.equal((await api.post('/goods-receipts', { supplier_id: ids.supplier, received_on: '2026-10-20', lines: [line(ids.oil, 2, 3600, 10), line(ids.flour, 4, 2500, 4)] })).status, 201);
    assert.equal((await api.post('/goods-receipts', { supplier_id: ids.supplier, received_on: '2026-10-22', lines: [line(ids.oil, 1, 5400, 10)] })).status, 201);

    const month = await report('2026-10-01', '2026-10-31');
    assert.equal(month.spending.total_cents, 7200 + 10000 + 5400);
    assert.deepEqual(month.spending.by_supplier.map(s => [s.name, s.receipts, s.net_cents, s.vat_cents]), [['Rossi Alimentari', 2, 22600, 720 + 400 + 540]]);
    assert.deepEqual(month.price_changes.map(c => [c.name, c.supplier_name, c.previous_per_unit, c.latest_per_unit, c.change_percent]), [['Olio', 'Rossi Alimentari', 0.6, 0.9, 50]]);

    assert.equal((await report('2026-10-01', '2026-10-21')).price_changes.length, 0, 'in quel periodo c\'è un solo carico: niente confronto');
    assert.equal((await report('2026-10-23', '2026-10-31')).price_changes.length, 0, 'l\'ultimo carico è prima del periodo');
    assert.equal((await report('2026-10-23', '2026-10-31')).spending.total_cents, 0);
    assert.equal((await report('2026-10-01', '2026-10-31', otherApi)).spending.by_supplier.length, 0, 'un altro locale non vede questa spesa');
  });

  it('un ribasso compare con il segno meno, e fornitori diversi non si confrontano', async () => {
    const second = (await api.post('/suppliers', { name: 'Bianchi' })).body.id;
    await api.post('/goods-receipts', { supplier_id: second, received_on: '2026-10-24', lines: [line(ids.flour, 1, 900, 4)] });
    assert.equal((await report('2026-10-23', '2026-10-31')).price_changes.length, 0, 'è il primo carico di Bianchi: niente confronto con Rossi');
    await api.post('/goods-receipts', { supplier_id: second, received_on: '2026-10-25', lines: [line(ids.flour, 1, 600, 4)] });
    const changes = (await report('2026-10-23', '2026-10-31')).price_changes;
    assert.deepEqual(changes.map(c => [c.name, c.supplier_name, c.change_percent]), [['Farina', 'Bianchi', -33.3]]);
  });
});
