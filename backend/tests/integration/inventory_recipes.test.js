// Magazzino, fase 2: ingredienti, preparazioni, ricette; la vendita scala la dispensa, lo storno la rimette (o la segna scarto).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { startServer, createTenant, deleteTenants, closePools, apiClient, adminDb, connectWs, sleep, PASSWORD } from './helpers.js';

describe('magazzino: ingredienti e ricette', () => {
  let server, t, portionsOnly, api, kitchen, cashier, portionsApi;
  const ids = {};

  const addUser = async (tenant, role) => {
    const username = `${role}-${tenant.slug}`;
    await adminDb.query('INSERT INTO users (username, password_hash, role, tenant_id) VALUES ($1, $2, $3, $4)', [username, await bcrypt.hash(PASSWORD, 4), role, tenant.id]);
    return username;
  };
  const onHand = async (id) => Number((await adminDb.query('SELECT quantity_on_hand FROM ingredients WHERE id = $1', [id])).rows[0].quantity_on_hand);
  const movements = async (orderId) => (await adminDb.query('SELECT ingredient_id, kind, quantity_change FROM ingredient_movements WHERE order_id = $1 ORDER BY id', [orderId])).rows
    .map(r => ({ ...r, quantity_change: Number(r.quantity_change) }));
  const sell = (client, quantity, extra = {}) => client.post('/orders', { items: [{ id: ids.pizza, name: 'Pizza', quantity, ...extra.item }], ...extra.body });

  before(async () => {
    server = await startServer();
    t = await createTenant({ businessType: 'restaurant' });
    portionsOnly = await createTenant({ businessType: 'restaurant' });
    await adminDb.query(`UPDATE tenants SET modules = array_append(modules, 'inventory'), inventory_mode = 'warehouse', inventory_depletion = 'recipes' WHERE id = $1`, [t.id]);
    await adminDb.query(`UPDATE tenants SET modules = array_append(modules, 'inventory'), inventory_mode = 'portions' WHERE id = $1`, [portionsOnly.id]);
    const kitchenName = await addUser(t, 'kitchen');
    const cashierName = await addUser(t, 'cashier');
    [api, kitchen, cashier, portionsApi] = [t, t, t, portionsOnly].map(x => apiClient(server.port, x.host));
    await api.login(t.username); await kitchen.login(kitchenName); await cashier.login(cashierName); await portionsApi.login(portionsOnly.username);
    ids.pizza = t.productId;
  });
  after(async () => {
    await deleteTenants(t, portionsOnly);
    await server.close();
    await closePools();
  });

  it('solo con la modalità «magazzino»: con le sole porzioni gli ingredienti non esistono', async () => {
    const res = await portionsApi.get('/ingredients');
    assert.deepEqual([res.status, res.body.code], [403, 'MODULE_DISABLED']);
  });

  it('amministratore e responsabile gestiscono gli ingredienti; la cucina li vede senza costi; la cassa no', async () => {
    for (const [key, name, unit, yieldPercent] of [['flour', 'Farina', 'g', 100], ['tomato', 'Pomodoro', 'g', 100], ['mozzarella', 'Mozzarella', 'g', 100], ['beef', 'Manzo', 'g', 80]]) {
      const res = await api.post('/ingredients', { name, base_unit: unit, yield_percent: yieldPercent });
      assert.equal(res.status, 201, JSON.stringify(res.body));
      ids[key] = res.body.id;
    }
    assert.equal((await api.post('/ingredients', { name: 'farina', base_unit: 'g' })).status, 409, 'nome già usato, senza distinguere le maiuscole');
    assert.equal((await api.post('/ingredients', { name: 'Olio', base_unit: 'litri' })).status, 400);
    assert.equal((await cashier.post('/ingredients', { name: 'Olio', base_unit: 'ml' })).status, 403);
    assert.equal((await cashier.get('/ingredients')).status, 403);

    const list = (await kitchen.get('/ingredients')).body;
    assert.equal(list.length, 4);
    assert.equal(list[0].weighted_average_cost, undefined, 'la cucina non vede i costi');
    assert.equal((await api.get('/ingredients')).body[0].weighted_average_cost, 0);

    await adminDb.query('UPDATE ingredients SET quantity_on_hand = 10000, weighted_average_cost = 0.2 WHERE id = $1', [ids.flour]);
    await adminDb.query('UPDATE ingredients SET quantity_on_hand = 5000, weighted_average_cost = 0.1 WHERE id = $1', [ids.tomato]);
    await adminDb.query('UPDATE ingredients SET quantity_on_hand = 2000, weighted_average_cost = 0.8 WHERE id = $1', [ids.mozzarella]);
  });

  it('una preparazione con la sua ricetta; non può usare se stessa, nemmeno passando da un\'altra', async () => {
    const sauce = await api.post('/preparations', { name: 'Sugo', base_unit: 'g', output_quantity: 1000, lines: [{ ingredient_id: ids.tomato, quantity: 900 }] });
    assert.equal(sauce.status, 201, JSON.stringify(sauce.body));
    ids.sauce = sauce.body.id;
    assert.deepEqual(sauce.body.lines, [{ ingredient_id: ids.tomato, component_preparation_id: null, quantity: 900 }]);

    const base = await api.post('/preparations', { name: 'Base', base_unit: 'g', output_quantity: 500, lines: [{ component_preparation_id: ids.sauce, quantity: 100 }] });
    assert.equal(base.status, 201);
    const loop = await api.put(`/preparations/${ids.sauce}`, { name: 'Sugo', base_unit: 'g', output_quantity: 1000, lines: [{ component_preparation_id: base.body.id, quantity: 10 }] });
    assert.deepEqual([loop.status, loop.body.code], [400, 'RECIPE_LOOP']);
    assert.equal((await api.request('DELETE', `/preparations/${ids.sauce}`)).status, 409, 'usata da un\'altra preparazione: non si elimina');
    await adminDb.query('DELETE FROM recipe_lines WHERE preparation_id = $1', [base.body.id]);
    await adminDb.query('DELETE FROM preparations WHERE id = $1', [base.body.id]);
  });

  it('la ricetta di un piatto: ingredienti e preparazione; costo e porzioni possibili', async () => {
    const bad = await api.put(`/products/${ids.pizza}/recipe`, { lines: [{ ingredient_id: 999999, quantity: 5 }] });
    assert.deepEqual([bad.status, bad.body.code], [400, 'INVALID_INGREDIENT']);
    const saved = await api.put(`/products/${ids.pizza}/recipe`, { lines: [
      { ingredient_id: ids.flour, quantity: 200 }, { ingredient_id: ids.mozzarella, quantity: 100 }, { component_preparation_id: ids.sauce, quantity: 100 }] });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const recipe = (await api.get(`/products/${ids.pizza}/recipe`)).body;
    assert.equal(recipe.lines.length, 3);
    // 200 g × 0,2 + 100 g × 0,8 + (100/1000 × 900 g = 90 g) × 0,1 = 40 + 80 + 9 = 129 centesimi
    assert.equal(recipe.cost_cents_per_portion, 129);
    assert.equal(recipe.portions_from_ingredients, 20, 'la mozzarella: 2000 g / 100 g');
    assert.equal((await cashier.get(`/products/${ids.pizza}/recipe`)).status, 403);
    const summary = (await api.get('/products/recipes-summary')).body;
    assert.deepEqual(summary, [{ product_id: ids.pizza, lines: 3, cost_cents_per_portion: 129, portions_from_ingredients: 20 }]);
    assert.equal((await api.put(`/products/${ids.pizza}/recipe`, { lines: [{ ingredient_id: ids.flour, quantity: 5 }, { ingredient_id: ids.flour, quantity: 6 }] })).status, 400, 'ingrediente ripetuto');
    await api.put(`/products/${ids.pizza}/recipe`, { lines: saved.body.lines });
  });

  it('la vendita scala la dispensa e salva il costo della riga; lo storno prima della cucina la rimette a posto', async () => {
    const res = await sell(api, 2);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(await onHand(ids.flour), 9600);
    assert.equal(await onHand(ids.mozzarella), 1800);
    assert.equal(await onHand(ids.tomato), 5000 - 180);
    const sold = await movements(res.body.orderId);
    assert.deepEqual(sold.map(m => m.kind), ['sale', 'sale', 'sale']);
    assert.equal((await adminDb.query('SELECT cost_cents FROM order_items WHERE order_id = $1', [res.body.orderId])).rows[0].cost_cents, 258, 'due pizze × 129');

    const cancel = await api.request('PUT', `/orders/${res.body.orderId}`, { status: 'canceled' });
    assert.equal(cancel.status, 200, JSON.stringify(cancel.body));
    assert.equal(await onHand(ids.flour), 10000);
    assert.equal(await onHand(ids.tomato), 5000);
    assert.ok((await movements(res.body.orderId)).some(m => m.kind === 'sale_reversal'));
    // storno ripetuto: non rimette due volte
    await api.request('PUT', `/orders/${res.body.orderId}`, { status: 'canceled' });
    assert.equal(await onHand(ids.flour), 10000);
  });

  it('se la cucina aveva già iniziato, lo storno è uno scarto: la dispensa non torna, e si può scegliere', async () => {
    const started = await sell(api, 1);
    await adminDb.query(`UPDATE orders SET status = 'preparing' WHERE id = $1`, [started.body.orderId]);
    await adminDb.query(`UPDATE order_items SET prep_status = 'preparing' WHERE order_id = $1`, [started.body.orderId]);
    const before = await onHand(ids.flour);
    assert.equal((await api.request('PUT', `/orders/${started.body.orderId}`, { status: 'canceled' })).status, 200);
    assert.equal(await onHand(ids.flour), before, 'è scarto: la farina non torna');
    const kinds = (await movements(started.body.orderId)).map(m => m.kind);
    assert.ok(kinds.includes('waste') && kinds.includes('sale_reversal'));

    const chosen = await sell(api, 1);
    await adminDb.query(`UPDATE orders SET status = 'preparing' WHERE id = $1`, [chosen.body.orderId]);
    const beforeChosen = await onHand(ids.flour);
    await api.request('PUT', `/orders/${chosen.body.orderId}`, { status: 'canceled', ingredients: 'return' });
    assert.equal(await onHand(ids.flour), beforeChosen + 200, 'chi storna può scegliere di rimetterla in dispensa');
  });

  it('se un ingrediente non basta l\'ordine si rifiuta; solo amministratore e responsabile possono forzare', async () => {
    await adminDb.query('UPDATE ingredients SET quantity_on_hand = 150 WHERE id = $1', [ids.mozzarella]);     // basta per una pizza
    const refused = await sell(api, 2);
    assert.deepEqual([refused.status, refused.body.code], [409, 'INGREDIENT_SHORTAGE']);
    assert.match(refused.body.error, /Mozzarella/);
    const cashierForcing = await sell(cashier, 2, { body: { force_stock: true } });
    assert.equal(cashierForcing.status, 409, 'la cassa non forza');

    const before = await onHand(ids.mozzarella);
    const forced = await sell(api, 2, { body: { force_stock: true } });
    assert.equal(forced.status, 200, JSON.stringify(forced.body));
    assert.equal(await onHand(ids.mozzarella), before - 200, 'la dispensa va in negativo, ed è tracciato');
  });

  it('un ingrediente segnato esaurito dalla cucina blocca i piatti che lo usano; si rimette con un tocco', async () => {
    await adminDb.query('UPDATE ingredients SET quantity_on_hand = 5000 WHERE id = $1', [ids.mozzarella]);
    assert.equal((await kitchen.request('PUT', `/ingredients/${ids.mozzarella}/availability`, { available: false })).status, 200);
    assert.equal((await sell(api, 1)).body.code, 'INGREDIENT_SHORTAGE');
    const availability = (await api.get('/inventory/availability')).body.products.find(p => p.product_id === ids.pizza);
    assert.equal(availability.ingredient_portions, 0);
    assert.equal((await cashier.request('PUT', `/ingredients/${ids.mozzarella}/availability`, { available: true })).status, 403);
    await kitchen.request('PUT', `/ingredients/${ids.mozzarella}/availability`, { available: true });
    assert.equal((await sell(api, 1)).status, 200);
  });

  it('un\'opzione aggiunge ingredienti: se scala il magazzino la vendita li consuma', async () => {
    const group = await api.post('/modifier-groups', { name: 'Aggiunte', min_select: 0, max_select: 2, options: [{ name: 'Extra mozzarella', price_delta: 1.5 }, { name: 'Senza farina', price_delta: 0 }] });
    assert.equal(group.status, 201, JSON.stringify(group.body));
    const [extra] = group.body.options;
    await api.request('PUT', `/products/${ids.pizza}/modifier-groups`, { group_ids: [group.body.id] });
    const set = await api.request('PUT', `/modifiers/${extra.id}/recipe`, { affects_stock: true, lines: [{ ingredient_id: ids.mozzarella, quantity_change: 50 }] });
    assert.equal(set.status, 200, JSON.stringify(set.body));

    const before = await onHand(ids.mozzarella);
    assert.equal((await sell(api, 1, { item: { modifiers: [extra.id] } })).status, 200);
    assert.equal(await onHand(ids.mozzarella), before - 100 - 50);

    await api.request('PUT', `/modifiers/${extra.id}/recipe`, { affects_stock: false, lines: [{ ingredient_id: ids.mozzarella, quantity_change: 50 }] });
    const beforeOff = await onHand(ids.mozzarella);
    assert.equal((await sell(api, 1, { item: { modifiers: [extra.id] } })).status, 200);
    assert.equal(await onHand(ids.mozzarella), beforeOff - 100, 'con l\'opzione spenta scala solo il piatto');
  });

  it('la cucina segna un piatto esaurito e lo rimette in vendita; la cassa no', async () => {
    const out = await kitchen.request('PUT', `/products/${ids.pizza}/availability`, { available: false });
    assert.equal(out.status, 200);
    assert.deepEqual([out.body.stock, out.body.stock_enabled, out.body.visible], [0, true, true]);
    assert.equal((await cashier.request('PUT', `/products/${ids.pizza}/availability`, { available: true })).status, 403);
    const back = await kitchen.request('PUT', `/products/${ids.pizza}/availability`, { available: true });
    assert.deepEqual([back.body.stock, back.body.stock_enabled, back.body.visible], [null, false, true]);
  });

  it('esaurito e di nuovo disponibile arrivano a tutti i dispositivi, e due cambi insieme lasciano un solo stato coerente', async () => {
    const staff = await connectWs(server.port, t.host, { cookie: api.cookie });
    await kitchen.request('PUT', `/products/${ids.pizza}/availability`, { available: false });
    await sleep(150);
    const out = staff.messages.find(m => m.type === 'product_stock_updated' && m.product.id === ids.pizza);
    assert.deepEqual([out.product.stock, out.product.stock_enabled, out.product.visible], [0, true, true], 'esaurito ma ancora in carta');
    // la cucina e l'amministratore lo cambiano nello stesso momento: vince l'ultimo, ma lo stato resta coerente e l'ultimo avviso lo dice
    const [a, b] = await Promise.all([kitchen.request('PUT', `/products/${ids.pizza}/availability`, { available: true }), api.request('PUT', `/products/${ids.pizza}/availability`, { available: false })]);
    assert.deepEqual([a.status, b.status], [200, 200]);
    await sleep(150);
    const last = staff.messages.filter(m => m.type === 'product_stock_updated' && m.product.id === ids.pizza).at(-1).product;
    const { rows: [row] } = await adminDb.query('SELECT stock, stock_enabled, visible FROM products WHERE id = $1', [ids.pizza]);
    assert.deepEqual({ stock: last.stock, stock_enabled: last.stock_enabled, visible: last.visible }, row, 'l\'ultimo avviso coincide con ciò che c\'è nel database');
    assert.ok((row.stock_enabled && row.stock === 0) || (!row.stock_enabled && row.stock === null), 'o esaurito o illimitato, mai a metà');
    staff.ws.close();
    await kitchen.request('PUT', `/products/${ids.pizza}/availability`, { available: true });
  });

  it('anche le comande dei tavoli per portata scalano gli ingredienti, e il giro si rifiuta se non bastano', async () => {
    await adminDb.query('UPDATE ingredients SET quantity_on_hand = 1000, marked_out = false WHERE id = $1', [ids.mozzarella]);
    const room = (await api.post('/rooms', { name: 'Sala' })).body;
    const tables = (await api.post(`/rooms/${room.id}/tables/bulk`, { prefix: 'T', from: 1, to: 2 })).body.created;
    const checkId = (await api.post('/checks', { table_id: tables[0].id, covers: 2 })).body.id;
    const round = (quantity, extra = {}) => api.post(`/checks/${checkId}/courses`, { groups: [{ course_id: null, seq: 1, items: [{ id: ids.pizza, name: 'Pizza', quantity }] }], ...extra });

    const before = await onHand(ids.mozzarella);
    const ok = await round(3);
    assert.equal(ok.status, 201, JSON.stringify(ok.body));
    assert.equal(await onHand(ids.mozzarella), before - 300);

    const refused = await round(20);                                                       // ne servirebbero 2000 g
    assert.deepEqual([refused.status, refused.body.code], [409, 'INGREDIENT_SHORTAGE']);
    assert.equal(await onHand(ids.mozzarella), before - 300, 'un giro rifiutato non scala nulla');

    const orderId = ok.body.orders[0].id;
    await api.post(`/checks/${checkId}/void`, { cancel_orders: true });
    assert.equal(await onHand(ids.mozzarella), before, 'annullando il conto gli ingredienti tornano (la cucina non era partita)');
    assert.ok((await movements(orderId)).some(m => m.kind === 'sale_reversal'));
  });

  it('i movimenti sono isolati fra locali: l\'altro locale non vede gli ingredienti', async () => {
    assert.equal((await portionsApi.get('/ingredients')).status, 403);
    const { rows } = await adminDb.query('SELECT count(*)::int AS n FROM ingredients WHERE tenant_id = $1', [portionsOnly.id]);
    assert.equal(rows[0].n, 0);
  });
});
