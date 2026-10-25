// Magazzino, fase 4: scarti, rettifiche, controlli di magazzino, scarico semplificato e il report (food cost, margini, scarti, teorico/reale).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { startServer, createTenant, deleteTenants, closePools, apiClient, adminDb, PASSWORD } from './helpers.js';

describe('magazzino: controlli, scarti e report', () => {
  let server, t, simple, api, cashier, simpleApi;
  const ids = {};
  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
  const onHand = async (id) => Number((await adminDb.query('SELECT quantity_on_hand FROM ingredients WHERE id = $1', [id])).rows[0].quantity_on_hand);
  const report = async (client = api) => (await client.get(`/inventory/report?from=${today()}&to=${today()}`)).body;

  before(async () => {
    server = await startServer();
    [t, simple] = [await createTenant({ businessType: 'restaurant' }), await createTenant({ businessType: 'restaurant' })];
    await adminDb.query(`UPDATE tenants SET modules = array_append(modules, 'inventory'), inventory_mode = 'warehouse', inventory_depletion = 'recipes' WHERE id = $1`, [t.id]);
    await adminDb.query(`UPDATE tenants SET modules = array_append(modules, 'inventory'), inventory_mode = 'warehouse', inventory_depletion = 'simple' WHERE id = $1`, [simple.id]);
    const cashierName = `cashier-${t.slug}`;
    await adminDb.query(`INSERT INTO users (username, password_hash, role, tenant_id) VALUES ($1, $2, 'cashier', $3)`, [cashierName, await bcrypt.hash(PASSWORD, 4), t.id]);
    [api, cashier, simpleApi] = [t, t, simple].map(x => apiClient(server.port, x.host));
    await api.login(t.username); await cashier.login(cashierName); await simpleApi.login(simple.username);
    const make = async (client, name, unit, onHandQty, cost) => {
      const created = await client.post('/ingredients', { name, base_unit: unit });
      await adminDb.query('UPDATE ingredients SET quantity_on_hand = $2, weighted_average_cost = $3 WHERE id = $1', [created.body.id, onHandQty, cost]);
      return created.body.id;
    };
    ids.flour = await make(api, 'Farina', 'g', 10000, 0.2);
    ids.mozzarella = await make(api, 'Mozzarella', 'g', 5000, 0.8);
    ids.sFlour = await make(simpleApi, 'Farina', 'g', 1000, 0.2);
    ids.sOil = await make(simpleApi, 'Olio', 'ml', 500, 0.9);
    await api.put(`/products/${t.productId}/recipe`, { lines: [{ ingredient_id: ids.flour, quantity: 200 }, { ingredient_id: ids.mozzarella, quantity: 100 }] });
  });
  after(async () => {
    await deleteTenants(t, simple);
    await server.close();
    await closePools();
  });

  it('uno scarto toglie dalla dispensa col motivo e il costo del momento; solo chi gestisce', async () => {
    const res = await api.post('/inventory/movements', { type: 'waste', ingredient_id: ids.mozzarella, quantity: 500, reason: 'expired', note: 'scaduta ieri' });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(await onHand(ids.mozzarella), 4500);
    const { rows: [m] } = await adminDb.query(`SELECT kind, quantity_change, unit_cost, reason FROM ingredient_movements WHERE ingredient_id = $1`, [ids.mozzarella]);
    assert.deepEqual([m.kind, Number(m.quantity_change), Number(m.unit_cost), m.reason], ['waste', -500, 0.8, 'expired: scaduta ieri']);
    assert.equal((await api.post('/inventory/movements', { type: 'waste', ingredient_id: ids.mozzarella, quantity: 0, reason: 'expired' })).status, 400);
    assert.equal((await api.post('/inventory/movements', { type: 'waste', ingredient_id: ids.mozzarella, quantity: 5, reason: 'inventato' })).status, 400);
    assert.equal((await cashier.post('/inventory/movements', { type: 'waste', ingredient_id: ids.mozzarella, quantity: 5, reason: 'broken' })).status, 403);
    assert.equal((await api.post('/inventory/movements', { type: 'waste', ingredient_id: ids.sFlour, quantity: 5, reason: 'broken' })).body.code, 'INVALID_INGREDIENT', 'un ingrediente di un altro locale');
  });

  it('una rettifica ha il segno e vuole una nota', async () => {
    assert.equal((await api.post('/inventory/movements', { type: 'adjustment', ingredient_id: ids.flour, quantity_change: 250, note: '' })).status, 400);
    assert.equal((await api.post('/inventory/movements', { type: 'adjustment', ingredient_id: ids.flour, quantity_change: 0, note: 'niente' })).status, 400);
    assert.equal((await api.post('/inventory/movements', { type: 'adjustment', ingredient_id: ids.flour, quantity_change: -250, note: 'errore nel carico' })).status, 201);
    assert.equal(await onHand(ids.flour), 9750);
    const log = (await api.get(`/inventory/movements?ingredient_id=${ids.flour}`)).body;
    assert.deepEqual([log[0].kind, log[0].quantity_change, log[0].reason, log[0].created_by], ['adjustment', -250, 'errore nel carico', t.username]);
    assert.equal((await api.get('/inventory/movements?kind=waste')).body.length, 1);
  });

  it('un controllo di magazzino: la dispensa si allinea al conteggio e la differenza resta nel registro', async () => {
    const res = await api.post('/stock-levels', { kind: 'closing', notes: 'chiusura serata', lines: [{ ingredient_id: ids.flour, counted_quantity: 9500 }, { ingredient_id: ids.mozzarella, counted_quantity: 4500 }] });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.differences, 1, 'la mozzarella torna: una sola differenza');
    assert.equal(await onHand(ids.flour), 9500);
    const detail = (await api.get(`/stock-levels/${res.body.id}`)).body;
    const flour = detail.lines.find(l => l.name === 'Farina');
    assert.deepEqual([flour.expected_quantity, flour.counted_quantity, flour.difference, flour.difference_value_cents], [9750, 9500, -250, -50]);
    assert.equal((await api.get('/stock-levels')).body[0].differences, 1);
    assert.equal((await api.post('/stock-levels', { lines: [{ ingredient_id: ids.sFlour, counted_quantity: 1 }] })).body.code, 'INVALID_INGREDIENT');
    assert.equal((await api.post('/stock-levels', { lines: [] })).status, 400);
    assert.equal((await cashier.get('/stock-levels')).status, 403);
  });

  it('lo scarico semplificato: usato o rimasto; solo dove gli ingredienti si scalano a mano', async () => {
    assert.equal((await api.post('/inventory/usage', { lines: [{ ingredient_id: ids.flour, used: 100 }] })).body.code, 'NOT_SIMPLE_DEPLETION');
    const ok = await simpleApi.post('/inventory/usage', { lines: [{ ingredient_id: ids.sFlour, used: 300 }, { ingredient_id: ids.sOil, remaining: 200 }] });
    assert.equal(ok.status, 201, JSON.stringify(ok.body));
    assert.equal(await onHand(ids.sFlour), 700);
    assert.equal(await onHand(ids.sOil), 200);
    assert.equal((await simpleApi.post('/inventory/usage', { lines: [{ ingredient_id: ids.sOil, remaining: 900 }] })).body.code, 'REMAINING_ABOVE_STOCK');
    assert.equal((await simpleApi.post('/inventory/usage', { lines: [{ ingredient_id: ids.sOil, used: 1, remaining: 1 }] })).status, 400);
    const { rows } = await adminDb.query(`SELECT kind, quantity_change FROM ingredient_movements WHERE tenant_id = $1 AND kind = 'usage' ORDER BY id`, [simple.id]);
    assert.deepEqual(rows.map(r => [r.kind, Number(r.quantity_change)]), [['usage', -300], ['usage', -300]]);
  });

  it('nello scarico semplificato le vendite non toccano la dispensa', async () => {
    const { rows: [p] } = await adminDb.query(`SELECT id FROM products WHERE tenant_id = $1`, [simple.id]);
    await simpleApi.put(`/products/${p.id}/recipe`, { lines: [{ ingredient_id: ids.sFlour, quantity: 100 }] });
    assert.equal((await simpleApi.post('/orders', { items: [{ id: p.id, name: 'Panino', quantity: 2 }] })).status, 200);
    assert.equal(await onHand(ids.sFlour), 700);
  });

  it('il report: ricavo al netto dell\'IVA, costo teorico, margine e food cost; con l\'IVA predefinita e quella del piatto', async () => {
    // 3 panini a 5,00 € → 15,00 € lordi; ricetta: 200 g × 0,2 + 100 g × 0,8 = 120 centesimi a porzione
    const sale = await api.post('/orders', { status: 'completed', items: [{ id: t.productId, name: 'Panino', quantity: 3 }] });
    assert.equal(sale.status, 200, JSON.stringify(sale.body));
    let r = await report();
    const dish = r.dishes[0];
    assert.deepEqual([dish.name, dish.quantity, dish.vat_rate, dish.net_cents, dish.cost_cents, dish.margin_cents, dish.food_cost_percent, dish.has_recipe], ['Panino', 3, 10, 1364, 360, 1004, 26.4, true]);
    assert.deepEqual([r.totals.net_cents, r.totals.cost_cents, r.totals.margin_cents, r.totals.food_cost_percent, r.totals.recipe_coverage_percent], [1364, 360, 1004, 26.4, 100]);

    assert.equal((await api.put('/settings/default_vat_rate', { value: '22' })).status, 200);
    r = await report();
    assert.equal(r.dishes[0].vat_rate, 22);
    assert.equal(r.dishes[0].net_cents, 1230);
    await api.put(`/products/${t.productId}`, { name: 'Panino', price: 5, category: 'Cibo', vat_rate: 4 });
    r = await report();
    assert.deepEqual([r.dishes[0].vat_rate, r.dishes[0].net_cents], [4, 1442], 'l\'IVA del piatto vale più di quella predefinita');
    assert.equal((await api.put('/settings/default_vat_rate', { value: 'abc' })).status, 400);
  });

  it('il report: scarti per motivo, teorico contro reale, valore della dispensa', async () => {
    const r = await report();
    assert.equal(r.waste.total_cents, 400, '500 g di mozzarella a 0,8 c/g');
    assert.deepEqual(r.waste.by_reason, [{ reason: 'expired', value_cents: 400 }]);
    const flour = r.variance.find(v => v.name === 'Farina');
    assert.deepEqual([flour.difference, flour.difference_value_cents, flour.theoretical_used], [-250, -50, 600]);
    assert.equal(r.inventory_value_cents, Math.round(8900 * 0.2 + 4200 * 0.8), 'dispensa dopo le vendite: 9500-600 g di farina, 4500-300 g di mozzarella');
    assert.equal((await cashier.get(`/inventory/report?from=${today()}&to=${today()}`)).status, 403);
    assert.equal((await api.get('/inventory/report?from=2026-12-01&to=2026-11-01')).status, 400);
    assert.equal((await simpleApi.get(`/inventory/report?from=${today()}&to=${today()}`)).body.dishes.length, 0, 'un altro locale non vede le vendite di questo');
  });
});
