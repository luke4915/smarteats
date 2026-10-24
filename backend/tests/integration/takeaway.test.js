// Asporto (modulo `takeaway`): fasce e carico, ordini dal sito pubblico, approvazione, cucina, ritiro, isolamento.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { startServer, createTenant, deleteTenants, closePools, apiClient, adminDb, connectWs, sleep, PASSWORD } from './helpers.js';
import { localNow, addDays } from '../../utils/bookingPortal.js';

describe('asporto', () => {
  let server, t, other, street, admin, cashier, otherApi, client, drink;
  const today = localNow().date;
  const tomorrow = addDays(today, 1);
  let phoneSeq = 0;
  const phone = () => `339${String(2000000 + ++phoneSeq)}`;
  const order = (items, extra = {}) => ({ date: tomorrow, time: '19:00', items, customer_name: 'Bianchi', phone: phone(), email: '', notes: '', consent: true, website: '', ...extra });
  const post = (items, extra) => client.post('/public/takeaway/orders', order(items, extra));
  const setting = (key, value) => admin.put(`/settings/${key}`, { value });
  const pizza = (n = 1) => ({ id: t.productId, quantity: n });

  before(async () => {
    server = await startServer();
    [t, other, street] = [await createTenant({ businessType: 'restaurant' }), await createTenant({ businessType: 'restaurant' }), await createTenant()];
    for (const x of [t, other]) await adminDb.query(`UPDATE tenants SET modules = array_append(modules, 'takeaway') WHERE id = $1`, [x.id]);
    admin = apiClient(server.port, t.host); await admin.login(t.username);
    otherApi = apiClient(server.port, other.host); await otherApi.login(other.username);
    client = apiClient(server.port, t.host);
    const username = `cashier-${t.slug}`;
    await adminDb.query(`INSERT INTO users (username, password_hash, role, tenant_id) VALUES ($1, $2, 'cashier', $3)`, [username, await bcrypt.hash(PASSWORD, 4), t.id]);
    cashier = apiClient(server.port, t.host); await cashier.login(username);
    // la bibita non occupa il forno
    ({ rows: [{ id: drink }] } = await adminDb.query(`INSERT INTO products (name, price, category, takeaway_load, tenant_id) VALUES ('Acqua', 2, 'Bevande', 0, $1) RETURNING id`, [t.id]));
    await admin.put('/takeaway/hours', { hours: [0, 1, 2, 3, 4, 5, 6].map(weekday => ({ weekday, open_time: '12:00', close_time: '23:00' })) });
    await setting('takeaway_slot_capacity', '6');
    await setting('takeaway_min_lead_minutes', '0');
  });
  after(async () => {
    await deleteTenants(t, other, street);
    await server.close();
    await closePools();
  });

  it('spento di fabbrica; senza il modulo nemmeno; poi si accende dalle impostazioni', async () => {
    const off = await client.get('/public/takeaway/info');
    assert.deepEqual([off.status, off.body.code], [404, 'PORTAL_OFF']);
    assert.equal((await apiClient(server.port, street.host).get('/public/takeaway/info')).body.code, 'MODULE_DISABLED');
    assert.equal((await post([pizza()])).status, 404);
    assert.equal((await setting('takeaway_portal_enabled', 'forse')).status, 400);
    assert.equal((await setting('takeaway_slot_minutes', '7')).status, 400);
    assert.equal((await setting('takeaway_slot_capacity', '0')).status, 400);
    assert.equal((await setting('takeaway_phone', '+39 0123 456789')).status, 200);
    assert.equal((await setting('takeaway_portal_enabled', '1')).status, 200);
    assert.equal((await cashier.put('/takeaway/hours', { hours: [] })).status, 403, 'gli orari li scrive solo l\'admin');
  });

  it('info, giorni e fasce: prodotti ordinabili e nessun numero di carico', async () => {
    const info = (await client.get('/public/takeaway/info')).body;
    assert.deepEqual(Object.keys(info).sort(), ['categories', 'max_days', 'max_items', 'name', 'phone', 'products', 'today', 'welcome']);
    assert.deepEqual(Object.keys(info.products[0]).sort(), ['category', 'id', 'name', 'price']);
    assert.equal(info.phone, '+39 0123 456789');
    const days = (await client.get('/public/takeaway/days')).body.days;
    assert.equal(days.length, 8);
    assert.equal(days.find(d => d.date === tomorrow).available, true);
    const slots = (await client.get(`/public/takeaway/slots?date=${tomorrow}&load=1`)).body;
    assert.deepEqual(Object.keys(slots.slots[0]).sort(), ['available', 'time']);
    assert.ok(slots.slots.some(s => s.time === '19:00' && s.available));
    assert.equal(slots.slots.at(-1).time, '22:45', 'l\'ultima fascia comincia prima della chiusura');
  });

  it('richiesta dal sito: nasce «da approvare», il locale la vede nella campanella, il cliente ha il suo link', async () => {
    const staff = await connectWs(server.port, t.host, { cookie: admin.cookie });
    const res = await post([pizza(2), { id: drink, quantity: 3 }], { notes: 'Senza basilico', customer_name: 'Marta' });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.deepEqual(Object.keys(res.body).sort(), ['restaurant', 'token']);
    await sleep(120);
    assert.ok(staff.messages.some(m => m.type === 'takeaway_updated' && m.order.status === 'requested'));
    staff.ws.close();

    const inbox = (await cashier.get('/takeaway/inbox')).body;
    assert.deepEqual([inbox[0].kind, inbox[0].customer_name, inbox[0].start_time, inbox[0].load], ['takeaway_request', 'Marta', '19:00', 2]);

    const mine = (await client.get(`/public/takeaway/orders/${res.body.token}`)).body;
    assert.deepEqual([mine.status, mine.total, mine.can_cancel, mine.time], ['requested', 16, true, '19:00']);
    assert.deepEqual(mine.items.map(i => [i.name, i.quantity]), [['Panino', 2], ['Acqua', 3]]);
    assert.equal(JSON.stringify(mine).includes('339'), false, 'niente telefono nelle risposte pubbliche');
  });

  it('il carico della fascia: le bibite non contano; oltre la capienza la fascia è piena', async () => {
    // 19:00 ha già 2; capienza 6 → ne restano 4
    assert.equal((await post([pizza(4)], { time: '19:15' })).status, 201);
    assert.equal((await post([pizza(5)], { time: '19:15' })).body.code, 'SLOT_FULL', '4 + 5 > 6');
    assert.equal((await post([{ id: drink, quantity: 20 }], { time: '19:15' })).status, 201, 'solo bibite: non occupano il forno');
    const slots = (await client.get(`/public/takeaway/slots?date=${tomorrow}&load=3`)).body.slots;
    assert.equal(slots.find(s => s.time === '19:15').available, false);
    assert.equal(slots.find(s => s.time === '19:30').available, true);
  });

  it('rifiuti chiari: orario che non c\'è, troppo presto, troppo lontano, trappola, consenso, tetto per telefono', async () => {
    assert.equal((await post([pizza()], { time: '19:10' })).body.code, 'NOT_A_SLOT');
    assert.equal((await post([pizza()], { time: '03:00' })).body.code, 'NOT_A_SLOT');
    assert.equal((await post([pizza()], { date: addDays(localNow().date, 9) })).body.code, 'TOO_FAR');
    assert.equal((await post([pizza()], { date: addDays(localNow().date, -1) })).body.code, 'PAST');
    assert.equal((await post([pizza()], { website: 'spam' })).status, 400);
    assert.equal((await post([pizza()], { opened_at: Date.now() })).status, 400);
    assert.equal((await post([pizza()], { consent: false })).status, 400);
    assert.equal((await post([], {})).status, 400);
    assert.equal((await post([{ id: 999999, quantity: 1 }])).status, 400);
    const same = phone();
    for (let i = 0; i < 3; i += 1) assert.equal((await post([pizza()], { phone: same, time: '21:00' })).status, 201);
    assert.equal((await post([pizza()], { phone: same, time: '21:00' })).body.code, 'TOO_MANY_PENDING');
  });

  it('accettazione: serve il servizio aperto; poi la cucina vede l\'ordine con orario e nome', async () => {
    const created = await post([pizza(1)], { time: '20:00', customer_name: 'Luca' });
    const id = (await cashier.get(`/takeaway/orders?date=${tomorrow}`)).body.find(o => o.customer_name === 'Luca').id;
    // (si sposta l'ora di Roma, non 24 ore: nel giorno del cambio dell'ora legale 24 ore farebbero slittare l'orario)
    // il ritiro di oggi va subito in cucina (quelli per un altro giorno aspettano, vedi il test dedicato): si porta la richiesta a oggi
    await adminDb.query(`UPDATE takeaway_orders SET pickup_at = ((pickup_at AT TIME ZONE 'Europe/Rome') - interval '1 day') AT TIME ZONE 'Europe/Rome' WHERE id = $1`, [id]);

    await adminDb.query('UPDATE sessions SET end_time = now() WHERE tenant_id = $1 AND end_time IS NULL', [t.id]);
    const closed = await cashier.post(`/takeaway/orders/${id}/accept`, {});
    assert.deepEqual([closed.status, closed.body.code], [409, 'NO_ACTIVE_SESSION']);
    await adminDb.query(`INSERT INTO sessions (name, start_time, tenant_id) VALUES ('Cena', now(), $1)`, [t.id]);

    const kitchen = await connectWs(server.port, t.host, { cookie: admin.cookie });
    const ok = await cashier.post(`/takeaway/orders/${id}/accept`, {});
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.deepEqual([ok.body.status, ok.body.time, ok.body.ready], ['accepted', '20:00', false]);
    assert.match(ok.body.display_code, /^[A-Z]\d+$/);
    await sleep(120);
    const ev = kitchen.messages.find(m => m.type === 'order_created');
    assert.deepEqual([ev.order.is_takeaway, ev.order.pickup_name, ev.order.items[0].name], [true, 'Luca', 'Panino']);
    kitchen.ws.close();

    // l'elenco comande della cucina porta orario di ritiro e nome
    const list = (await admin.get('/orders?session=active')).body.find(o => o.id === ok.body.order_id);
    assert.deepEqual([list.status, list.is_takeaway, list.pickup_name], ['pending', true, 'Luca']);
    assert.ok(list.pickup_at);
    // già gestito: una seconda accettazione non duplica
    assert.equal((await cashier.post(`/takeaway/orders/${id}/accept`, {})).body.code, 'INVALID_TRANSITION');

    // il cliente vede l'esito dal suo link, ma non può più annullare da solo
    const mine = (await client.get(`/public/takeaway/orders/${created.body.token}`)).body;
    assert.deepEqual([mine.status, mine.can_cancel], ['accepted', false]);
    const late = await client.post(`/public/takeaway/orders/${created.body.token}/cancel`, {});
    assert.deepEqual([late.status, late.body.code], [409, 'CANCEL_BY_PHONE']);
  });

  it('ritiro: pronto in cucina → consegnato e pagato; incassa nelle statistiche', async () => {
    const o = (await cashier.get(`/takeaway/orders?date=${today}`)).body.find(x => x.customer_name === 'Luca');
    const lines = (await admin.get('/orders?session=active')).body.find(x => x.id === o.order_id).items;
    await admin.put(`/orders/${o.order_id}/lines`, { status: 'ready' });
    const ready = (await cashier.get(`/takeaway/orders?date=${today}`)).body.find(x => x.id === o.id);
    assert.equal(ready.ready, true, 'tutte le righe pronte');
    assert.ok(lines.length >= 1);
    const done = await cashier.post(`/takeaway/orders/${o.id}/picked-up`, { method: 'cash' });
    assert.deepEqual([done.status, done.body.status, done.body.paid_method], [200, 'picked_up', 'cash']);
    assert.equal((await cashier.post(`/takeaway/orders/${o.id}/picked-up`, { method: 'cash' })).status, 409);
    const { rows: [row] } = await adminDb.query('SELECT status FROM orders WHERE id = $1', [o.order_id]);
    assert.equal(row.status, 'completed');
  });

  it('asporto per un altro giorno: accettato ma senza ordine di cucina né stock scalato; per oggi sì', async () => {
    await adminDb.query('UPDATE products SET stock_enabled = true, stock = 10 WHERE id = $1', [t.productId]);
    const later = await cashier.post('/takeaway/orders', { date: tomorrow, time: '21:00', items: [pizza(2)], customer_name: 'Domani', source: 'phone' });
    assert.equal(later.status, 201, JSON.stringify(later.body));
    assert.deepEqual([later.body.status, later.body.order_id], ['accepted', null], 'accettato, ma l\'ordine di cucina non esiste ancora');
    assert.equal((await adminDb.query('SELECT stock FROM products WHERE id = $1', [t.productId])).rows[0].stock, 10, 'lo stock resta intatto');
    const inKitchen = (await admin.get('/orders?session=active')).body.filter(o => o.pickup_name === 'Domani');
    assert.equal(inKitchen.length, 0, 'in cucina non compare');
    // si vede nella pagina dell\'asporto, e si può annullare anche senza ordine di cucina
    const listed = (await cashier.get(`/takeaway/orders?date=${tomorrow}`)).body.find(o => o.id === later.body.id);
    assert.deepEqual([listed.status, listed.order_id, listed.ready], ['accepted', null, false]);
    assert.equal((await cashier.post(`/takeaway/orders/${later.body.id}/cancel`, {})).body.status, 'cancelled');

    // lo stesso ordine per oggi: va in cucina e scala lo stock
    const now = await cashier.post('/takeaway/orders', { date: today, time: '21:00', items: [pizza(2)], customer_name: 'Oggi', source: 'phone' });
    assert.equal(now.status, 201, JSON.stringify(now.body));
    assert.ok(now.body.order_id, 'ordine di cucina creato');
    assert.equal((await adminDb.query('SELECT stock FROM products WHERE id = $1', [t.productId])).rows[0].stock, 8);
    assert.equal((await admin.get('/orders?session=active')).body.filter(o => o.pickup_name === 'Oggi').length, 1);
    await cashier.post(`/takeaway/orders/${now.body.id}/cancel`, {});
    await adminDb.query('UPDATE products SET stock_enabled = false, stock = NULL WHERE id = $1', [t.productId]);
  });

  it('all\'apertura della serata nascono gli ordini di cucina degli asporti accettati in anticipo; uno che non riesce non blocca gli altri', async () => {
    await adminDb.query('UPDATE products SET stock_enabled = true, stock = 10 WHERE id = $1', [t.productId]);
    const mk = (name, items) => cashier.post('/takeaway/orders', { date: tomorrow, time: '20:30', items, customer_name: name, source: 'phone' });
    const ok = await mk('Per domani', [pizza(2)]);
    const doomed = await mk('Prodotto sparito', [{ id: drink, quantity: 1 }]);
    assert.deepEqual([ok.body.order_id, doomed.body.order_id], [null, null], 'accettati, senza ordine di cucina');

    // «domani» arriva: il ritiro diventa oggi, la serata si chiude e se ne apre una nuova
    await adminDb.query(`UPDATE takeaway_orders SET pickup_at = ((pickup_at AT TIME ZONE 'Europe/Rome') - interval '1 day') AT TIME ZONE 'Europe/Rome' WHERE id = ANY($1)`, [[ok.body.id, doomed.body.id]]);
    await adminDb.query('UPDATE sessions SET end_time = now() WHERE tenant_id = $1 AND end_time IS NULL', [t.id]);
    await adminDb.query('DELETE FROM products WHERE id = $1', [drink]);      // uno dei due ordini non potrà più partire
    const start = await admin.post('/sessions/start', { name: 'Cena di domani' });
    assert.equal(start.status, 200, JSON.stringify(start.body));

    const inKitchen = (await admin.get('/orders?session=active')).body.filter(o => o.is_takeaway);
    assert.deepEqual(inKitchen.map(o => o.pickup_name), ['Per domani'], 'solo quello che poteva partire');
    const listed = (await cashier.get(`/takeaway/orders?date=${today}`)).body;
    assert.ok(listed.find(o => o.id === ok.body.id).order_id, 'ora ha il suo ordine di cucina');
    assert.equal(listed.find(o => o.id === doomed.body.id).order_id, null, 'quello che non è partito resta in attesa');
    // l\'apertura azzera lo stock: l\'ordine nato dopo lo trova già «illimitato», quindi non c\'è nulla da scalare
    assert.equal((await adminDb.query('SELECT stock FROM products WHERE id = $1', [t.productId])).rows[0].stock, null);
    await adminDb.query(`INSERT INTO products (name, price, category, takeaway_load, tenant_id) VALUES ('Acqua', 2, 'Bevande', 0, $1) RETURNING id`, [t.id])
      .then(({ rows: [{ id }] }) => { drink = id; });
    await adminDb.query(`INSERT INTO sessions (name, start_time, tenant_id) SELECT 'Ripristino', now(), $1 WHERE NOT EXISTS (SELECT 1 FROM sessions WHERE tenant_id = $1 AND end_time IS NULL)`, [t.id]);
  });

  it('rifiuto, annullo del locale (lo stock torna) e ordine inserito al banco o al telefono', async () => {
    const rid = (await (async () => { await post([pizza()], { time: '21:30', customer_name: 'Rifiutato' }); return (await cashier.get(`/takeaway/orders?date=${tomorrow}`)).body.find(x => x.customer_name === 'Rifiutato').id; })());
    const rej = await cashier.post(`/takeaway/orders/${rid}/reject`, { reason: 'Forno fermo' });
    assert.deepEqual([rej.body.status, rej.body.reject_reason], ['rejected', 'Forno fermo']);

    // ordine al telefono: nasce accettato e va in cucina; con lo stock limitato lo scala
    await adminDb.query('UPDATE products SET stock_enabled = true, stock = 10 WHERE id = $1', [t.productId]);
    const phoneOrder = await cashier.post('/takeaway/orders', { date: today, time: '22:00', items: [pizza(3)], customer_name: 'Telefono', phone: '333', source: 'phone' });
    assert.equal(phoneOrder.status, 201, JSON.stringify(phoneOrder.body));
    assert.deepEqual([phoneOrder.body.status, phoneOrder.body.source], ['accepted', 'phone']);
    assert.equal((await adminDb.query('SELECT stock FROM products WHERE id = $1', [t.productId])).rows[0].stock, 7);
    const cancelled = await cashier.post(`/takeaway/orders/${phoneOrder.body.id}/cancel`, {});
    assert.equal(cancelled.body.status, 'cancelled');
    assert.equal((await adminDb.query('SELECT stock FROM products WHERE id = $1', [t.productId])).rows[0].stock, 10, 'lo stock è tornato');
    const kitchenOrder = (await adminDb.query('SELECT status FROM orders WHERE id = $1', [phoneOrder.body.order_id])).rows[0];
    assert.equal(kitchenOrder.status, 'canceled');

    // fascia piena: il banco non supera la capienza, a meno che lo decida di proposito
    const over = await cashier.post('/takeaway/orders', { date: tomorrow, time: '19:15', items: [pizza(3)], customer_name: 'Troppo', source: 'counter' });
    assert.deepEqual([over.status, over.body.code], [409, 'SLOT_FULL']);
    const forced = await cashier.post('/takeaway/orders', { date: tomorrow, time: '19:15', items: [pizza(3)], customer_name: 'Forzato', source: 'counter', ignore_capacity: true });
    assert.equal(forced.status, 201);
    assert.equal((await cashier.post('/takeaway/orders', { date: tomorrow, time: '19:10', items: [pizza()], customer_name: 'X' })).body.code, 'NOT_A_SLOT');
  });

  it('il cliente ritira una richiesta non ancora approvata; isolamento fra locali e ruoli', async () => {
    const r = await post([pizza()], { time: '22:30', customer_name: 'Ritirata' });
    const cancelled = await client.post(`/public/takeaway/orders/${r.body.token}/cancel`, {});
    assert.deepEqual([cancelled.status, cancelled.body.status], [200, 'cancelled']);
    assert.equal((await client.post(`/public/takeaway/orders/${r.body.token}/cancel`, {})).status, 409);
    assert.equal((await client.get('/public/takeaway/orders/abcdefghijklmnop')).status, 404);

    await adminDb.query(`UPDATE tenants SET modules = modules WHERE id = $1`, [other.id]);
    await otherApi.put('/settings/takeaway_portal_enabled', { value: '1' });
    assert.equal((await apiClient(server.port, other.host).get(`/public/takeaway/orders/${r.body.token}`)).status, 404, 'altro locale: non la trova');
    assert.deepEqual((await otherApi.get(`/takeaway/orders?date=${tomorrow}`)).body, []);
    assert.equal((await apiClient(server.port, t.host).get(`/takeaway/orders?date=${tomorrow}`)).status, 401);
    assert.equal((await apiClient(server.port, street.host).get(`/takeaway/orders?date=${tomorrow}`)).status, 401);
  });
});
