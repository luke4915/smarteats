// Magazzino, fase 1: la modalità la sceglie il master, le porzioni ripartono a ogni servizio, le opzioni tengono il loro id,
// e le tabelle nuove sono isolate fra locali.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { startServer, createTenant, deleteTenants, closePools, apiClient, adminDb } from './helpers.js';
import { pool } from '../../db.js';

process.env.MASTER_JWT_SECRET ||= 'segreto-master-di-prova-lungo-almeno-32-caratteri';
const masterCookie = { cookie: `master_token=${jwt.sign({ master: true }, process.env.MASTER_JWT_SECRET)}` };

describe('magazzino: fondamenta', () => {
  let server, t, other, api, master;

  before(async () => {
    server = await startServer();
    [t, other] = [await createTenant({ businessType: 'restaurant' }), await createTenant()];
    [api, master] = [apiClient(server.port, t.host), apiClient(server.port, t.host)];
    await api.login(t.username);
  });
  after(async () => {
    await deleteTenants(t, other);
    await server.close();
    await closePools();
  });

  const setModules = (body) => master.request('PUT', `/master/tenants/${t.id}/modules`, body, masterCookie);
  const restartService = async () => {
    await adminDb.query('UPDATE sessions SET end_time = now() WHERE tenant_id = $1 AND end_time IS NULL', [t.id]);
    return api.post('/sessions/start', { name: 'Cena' });
  };
  const dish = async (name, columns) => {
    const { rows: [p] } = await adminDb.query(
      `INSERT INTO products (name, price, category, tenant_id, stock, stock_enabled, portions_reset_rule, portions_start, visible) VALUES ($1, 5, 'Cibo', $2, $3, $4, $5, $6, $7) RETURNING id`,
      [name, t.id, columns.stock ?? null, columns.stock !== undefined && columns.stock !== null, columns.rule ?? 'unlimited', columns.start ?? null, columns.visible ?? true]);
    return p.id;
  };
  const readDish = async (id) => (await adminDb.query('SELECT stock, stock_enabled, visible FROM products WHERE id = $1', [id])).rows[0];

  it('il master accende il magazzino: parte da «porzioni» e «dalle ricette», lo vede l\'utente; spento si svuota', async () => {
    const on = await setModules({ modules: ['kds', 'stats', 'tables', 'inventory'] });
    assert.equal(on.status, 200);
    assert.deepEqual([on.body.inventory_mode, on.body.inventory_depletion], ['portions', 'recipes']);
    assert.deepEqual((await api.get('/auth/me')).body.inventory, { mode: 'portions', depletion: 'recipes' });
    assert.deepEqual((await apiClient(server.port, t.host).login(t.username)).body.inventory, { mode: 'portions', depletion: 'recipes' });

    const warehouse = await setModules({ modules: ['kds', 'stats', 'tables', 'inventory'], inventory: { mode: 'warehouse', depletion: 'simple' } });
    assert.deepEqual([warehouse.body.inventory_mode, warehouse.body.inventory_depletion], ['warehouse', 'simple']);

    const sameAgain = await setModules({ modules: ['kds', 'stats', 'tables', 'inventory'] });
    assert.deepEqual([sameAgain.body.inventory_mode, sameAgain.body.inventory_depletion], ['warehouse', 'simple'], 'senza dire altro si tiene ciò che c\'era');

    const off = await setModules({ modules: ['kds', 'stats', 'tables'] });
    assert.equal(off.body.inventory_mode, null);
    assert.equal((await api.get('/auth/me')).body.inventory, null);
  });

  it('una modalità inventata si rifiuta', async () => {
    assert.equal((await setModules({ modules: ['inventory'], inventory: { mode: 'ovunque' } })).status, 400);
  });

  it('col magazzino acceso, ogni piatto ripartisce all\'apertura del servizio secondo la sua regola', async () => {
    await setModules({ modules: ['kds', 'stats', 'tables', 'inventory'] });
    const restart = await dish('Lasagne', { stock: 3, rule: 'restart_each_service', start: 40 });
    const carry = await dish('Torta', { stock: 7, rule: 'carry_over' });
    const unlimited = await dish('Acqua', { stock: 2 });
    const soldOut = await dish('Tiramisù', { stock: 0, rule: 'restart_each_service', start: 12, visible: false });

    assert.equal((await restartService()).status, 200);
    assert.deepEqual(await readDish(restart), { stock: 40, stock_enabled: true, visible: true });
    assert.deepEqual(await readDish(carry), { stock: 7, stock_enabled: true, visible: true });
    assert.deepEqual(await readDish(unlimited), { stock: null, stock_enabled: false, visible: true });
    assert.deepEqual(await readDish(soldOut), { stock: 12, stock_enabled: true, visible: true }, 'il piatto finito torna disponibile');
  });

  it('a magazzino spento le regole non valgono: tutto torna illimitato come prima', async () => {
    await setModules({ modules: ['kds', 'stats', 'tables'] });
    const restart = await dish('Pizza', { stock: 5, rule: 'restart_each_service', start: 20 });
    assert.equal((await restartService()).status, 200);
    assert.deepEqual(await readDish(restart), { stock: null, stock_enabled: false, visible: true });
  });

  it('l\'admin salva la regola di un piatto: «riparti da N» serve il numero, e vale subito se il piatto era illimitato', async () => {
    const id = await dish('Risotto', {});
    const base = { name: 'Risotto', price: 9, category: 'Cibo' };
    const missing = await api.put(`/products/${id}`, { ...base, portions_reset_rule: 'restart_each_service' });
    assert.equal(missing.status, 400);
    const saved = await api.put(`/products/${id}`, { ...base, portions_reset_rule: 'restart_each_service', portions_start: 25 });
    assert.equal(saved.status, 200);
    assert.deepEqual([saved.body.portions_reset_rule, saved.body.portions_start, saved.body.stock, saved.body.stock_enabled], ['restart_each_service', 25, 25, true]);
    const untouched = await api.put(`/products/${id}`, base);
    assert.deepEqual([untouched.body.portions_reset_rule, untouched.body.stock], ['restart_each_service', 25], 'senza dire nulla la regola resta');

    // salvare di nuovo con la stessa regola (es. mostra/nascondi) non fa ripartire le porzioni
    await adminDb.query('UPDATE products SET stock = 11 WHERE id = $1', [id]);
    const sameRule = await api.put(`/products/${id}`, { ...base, visible: false, portions_reset_rule: 'restart_each_service', portions_start: 25 });
    assert.deepEqual([sameRule.body.stock, sameRule.body.visible], [11, false]);
  });

  it('modificando un gruppo di opzioni le opzioni che restano tengono il loro id', async () => {
    const created = await api.post('/modifier-groups', { name: 'Cottura', min_select: 0, max_select: 1, options: [{ name: 'Al sangue' }, { name: 'Media' }, { name: 'Ben cotta' }] });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const [rare, medium, well] = created.body.options;

    const edited = await api.put(`/modifier-groups/${created.body.id}`, {
      name: 'Cottura', min_select: 0, max_select: 1,
      options: [{ id: medium.id, name: 'Media', price_delta: 0.5 }, { id: rare.id, name: 'Al sangue' }, { name: 'Molto cotta' }],
    });
    assert.equal(edited.status, 200, JSON.stringify(edited.body));
    const byName = Object.fromEntries(edited.body.options.map(o => [o.name, o]));
    assert.equal(byName['Media'].id, medium.id);
    assert.equal(byName['Al sangue'].id, rare.id);
    assert.equal(byName['Media'].price_delta, 0.5);
    assert.ok(!edited.body.options.some(o => o.id === well.id), 'l\'opzione tolta non c\'è più');
    assert.equal(edited.body.options.length, 3);

    const foreign = await api.put(`/modifier-groups/${created.body.id}`, { name: 'Cottura', options: [{ id: 999999, name: 'Inventata' }] });
    assert.equal(foreign.status, 400);
    assert.equal(foreign.body.code, 'INVALID_OPTION');
  });

  it('le tabelle del magazzino sono isolate fra locali e il registro non si corregge dall\'app', async () => {
    const { rows: [ing] } = await adminDb.query(`INSERT INTO ingredients (name, base_unit, tenant_id) VALUES ('Farina', 'g', $1) RETURNING id`, [t.id]);
    await adminDb.query(`INSERT INTO ingredient_movements (ingredient_id, kind, quantity_change, tenant_id) VALUES ($1, 'receipt', 1000, $2)`, [ing.id, t.id]);

    const asTenant = async (tenantId, sql) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT set_config($1, $2, true)', ['app.tenant_id', String(tenantId)]);
        return await client.query(sql);
      } finally { await client.query('ROLLBACK'); client.release(); }
    };
    assert.equal((await asTenant(t.id, 'SELECT 1 FROM ingredients')).rowCount, 1);
    assert.equal((await asTenant(other.id, 'SELECT 1 FROM ingredients')).rowCount, 0);
    assert.equal((await asTenant(other.id, 'SELECT 1 FROM ingredient_movements')).rowCount, 0);
    await assert.rejects(asTenant(t.id, 'UPDATE ingredient_movements SET quantity_change = 0'), /permission denied/);
    await assert.rejects(asTenant(t.id, 'DELETE FROM ingredient_movements'), /permission denied/);
  });
});
