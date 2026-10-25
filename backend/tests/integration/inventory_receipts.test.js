// Magazzino, fase 3: fornitori, listino, carichi di merce (costo medio, dispensa, IVA) e foto della bolla.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import http from 'node:http';
import { startServer, createTenant, deleteTenants, closePools, apiClient, adminDb, PASSWORD } from './helpers.js';

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 7)]);
const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(100, 1)]);

describe('magazzino: fornitori e carichi di merce', () => {
  let server, t, other, api, cashier, otherApi;
  const ids = {};

  const onHand = async (id) => Number((await adminDb.query('SELECT quantity_on_hand FROM ingredients WHERE id = $1', [id])).rows[0].quantity_on_hand);
  const average = async (id) => Number((await adminDb.query('SELECT weighted_average_cost FROM ingredients WHERE id = $1', [id])).rows[0].weighted_average_cost);
  // Invio di un file come corpo grezzo (come fa il browser): l'helper dei test parla solo JSON
  const upload = (client, receiptId, body, contentType, name = 'bolla.jpg') => new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: server.port, method: 'PUT', path: `/api/goods-receipts/${receiptId}/documents`,
      headers: { host: t.host, cookie: client.cookie, 'content-type': contentType, 'content-length': body.length, 'x-file-name': encodeURIComponent(name) } }, (res) => {
      let raw = ''; res.on('data', c => { raw += c; }); res.on('end', () => resolve({ status: res.statusCode, body: raw ? JSON.parse(raw) : null }));
    });
    req.on('error', reject); req.write(body); req.end();
  });
  const download = (client, receiptId, documentId) => new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: server.port, path: `/api/goods-receipts/${receiptId}/documents/${documentId}`, headers: { host: t.host, cookie: client.cookie } }, (res) => {
      const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    }).on('error', reject);
  });

  before(async () => {
    server = await startServer();
    [t, other] = [await createTenant({ businessType: 'restaurant' }), await createTenant({ businessType: 'restaurant' })];
    for (const x of [t, other]) await adminDb.query(`UPDATE tenants SET modules = array_append(modules, 'inventory'), inventory_mode = 'warehouse', inventory_depletion = 'recipes' WHERE id = $1`, [x.id]);
    const cashierName = `cashier-${t.slug}`;
    await adminDb.query(`INSERT INTO users (username, password_hash, role, tenant_id) VALUES ($1, $2, 'cashier', $3)`, [cashierName, await bcrypt.hash(PASSWORD, 4), t.id]);
    [api, cashier, otherApi] = [t, t, other].map(x => apiClient(server.port, x.host));
    await api.login(t.username); await cashier.login(cashierName); await otherApi.login(other.username);
    ids.oil = (await api.post('/ingredients', { name: 'Olio', base_unit: 'ml' })).body.id;
    ids.flour = (await api.post('/ingredients', { name: 'Farina', base_unit: 'g' })).body.id;
  });
  after(async () => {
    await deleteTenants(t, other);
    await server.close();
    await closePools();
  });

  it('fornitori: solo amministratore e responsabile; nome unico; con carichi non si elimina', async () => {
    const created = await api.post('/suppliers', { name: 'Rossi Alimentari', phone: '333 1234567', vat_number: 'IT01234567890' });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    ids.supplier = created.body.id;
    assert.equal((await api.post('/suppliers', { name: 'rossi alimentari' })).status, 409);
    assert.equal((await cashier.get('/suppliers')).status, 403);
    assert.equal((await api.post('/suppliers', { name: '' })).status, 400);
    const updated = await api.put(`/suppliers/${ids.supplier}`, { name: 'Rossi Alimentari Srl', phone: null, active: true });
    assert.equal(updated.body.name, 'Rossi Alimentari Srl');
    assert.equal((await otherApi.get('/suppliers')).body.length, 0, 'un altro locale non li vede');
  });

  it('il listino del fornitore: confezione e prezzo di ogni ingrediente', async () => {
    const saved = await api.put(`/suppliers/${ids.supplier}/price-list`, { items: [
      { ingredient_id: ids.oil, purchase_unit_name: 'Cassa da 6 bottiglie da 1 l', base_units_per_purchase_unit: 6000, unit_cost_cents: 3600, vat_rate: 10 }] });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.deepEqual(saved.body.items[0], { ingredient_id: ids.oil, purchase_unit_name: 'Cassa da 6 bottiglie da 1 l', base_units_per_purchase_unit: 6000, unit_cost_cents: 3600, vat_rate: 10 });
    assert.equal((await api.put(`/suppliers/${ids.supplier}/price-list`, { items: [{ ingredient_id: 999999, purchase_unit_name: 'x', base_units_per_purchase_unit: 1, unit_cost_cents: 1 }] })).status, 400);
  });

  it('un carico: la dispensa sale, il costo medio si calcola, il prezzo resta nel listino', async () => {
    const receipt = await api.post('/goods-receipts', { supplier_id: ids.supplier, received_on: '2026-10-20', document_number: 'DDT 123', lines: [
      { ingredient_id: ids.oil, quantity: 2, purchase_unit_name: 'Cassa da 6 bottiglie da 1 l', base_units_per_purchase_unit: 6000, unit_cost_cents: 3600, vat_rate: 10 },
      { ingredient_id: ids.flour, quantity: 4, purchase_unit_name: 'Sacco da 25 kg', base_units_per_purchase_unit: 25000, unit_cost_cents: 2500, vat_rate: 4 }] });
    assert.equal(receipt.status, 201, JSON.stringify(receipt.body));
    ids.receipt = receipt.body.id;
    assert.equal(receipt.body.totalCostCents, 7200 + 10000);
    assert.equal(await onHand(ids.oil), 12000);
    assert.equal(await onHand(ids.flour), 100000);
    assert.equal(await average(ids.oil), 0.6, '3600 centesimi per 6000 ml');
    assert.equal(await average(ids.flour), 0.1);

    // secondo carico dell'olio a un prezzo più alto: media ponderata (12000 ml × 0,6 + 6000 ml × 0,9) / 18000 = 0,7
    const second = await api.post('/goods-receipts', { supplier_id: ids.supplier, received_on: '2026-10-22', lines: [
      { ingredient_id: ids.oil, quantity: 1, purchase_unit_name: 'Cassa da 6 bottiglie da 1 l', base_units_per_purchase_unit: 6000, unit_cost_cents: 5400, vat_rate: 10 }] });
    assert.equal(second.status, 201);
    assert.equal(await onHand(ids.oil), 18000);
    assert.equal(await average(ids.oil), 0.7);

    const { rows } = await adminDb.query('SELECT kind, quantity_change, unit_cost FROM ingredient_movements WHERE goods_receipt_id = $1 AND ingredient_id = $2', [ids.receipt, ids.oil]);
    assert.deepEqual(rows.map(r => [r.kind, Number(r.quantity_change), Number(r.unit_cost)]), [['receipt', 12000, 0.6]]);
    const list = (await api.get('/suppliers')).body[0].items;
    assert.equal(list.find(i => i.ingredient_id === ids.oil).unit_cost_cents, 5400, 'il listino ricorda l\'ultimo prezzo');
    assert.ok(list.some(i => i.ingredient_id === ids.flour), 'e aggiunge gli ingredienti nuovi');
  });

  it('carichi rifiutati: fornitore o ingrediente di altri, riga vuota, cassa', async () => {
    const base = { supplier_id: ids.supplier, received_on: '2026-10-21', lines: [{ ingredient_id: ids.oil, quantity: 1, purchase_unit_name: 'x', base_units_per_purchase_unit: 1, unit_cost_cents: 1 }] };
    assert.equal((await api.post('/goods-receipts', { ...base, supplier_id: 999999 })).body.code, 'INVALID_SUPPLIER');
    assert.equal((await api.post('/goods-receipts', { ...base, lines: [{ ...base.lines[0], ingredient_id: 999999 }] })).body.code, 'INVALID_INGREDIENT');
    assert.equal((await api.post('/goods-receipts', { ...base, lines: [] })).status, 400);
    assert.equal((await api.post('/goods-receipts', { ...base, received_on: 'ieri' })).status, 400);
    assert.equal((await cashier.post('/goods-receipts', base)).status, 403);
    assert.equal((await otherApi.post('/goods-receipts', base)).body.code, 'INVALID_SUPPLIER', 'il fornitore di un altro locale non esiste');
    assert.equal(await onHand(ids.oil), 18000, 'nulla è entrato');
  });

  it('l\'elenco e il dettaglio di un carico, con filtri per data e fornitore', async () => {
    const all = (await api.get('/goods-receipts')).body;
    assert.deepEqual(all.map(r => r.received_on), ['2026-10-22', '2026-10-20'], 'dal più recente');
    assert.equal(all[1].lines, 2);
    assert.equal((await api.get('/goods-receipts?from=2026-10-21')).body.length, 1);
    assert.equal((await api.get(`/goods-receipts?supplier_id=${ids.supplier + 999}`)).body.length, 0);
    const detail = (await api.get(`/goods-receipts/${ids.receipt}`)).body;
    assert.deepEqual([detail.supplier_name, detail.document_number, detail.total_cost_cents, detail.lines.length], ['Rossi Alimentari Srl', 'DDT 123', 17200, 2]);
    assert.equal((await otherApi.get(`/goods-receipts/${ids.receipt}`)).status, 404);
  });

  it('la foto della bolla: si allega, si riapre, si elimina; i file finti si rifiutano', async () => {
    const ok = await upload(api, ids.receipt, JPEG, 'image/jpeg', 'bolla rossi.jpg');
    assert.equal(ok.status, 201, JSON.stringify(ok.body));
    assert.equal(ok.body.file_name, 'bolla rossi.jpg');
    assert.equal((await upload(api, ids.receipt, PDF, 'application/pdf', 'bolla.pdf')).status, 201);

    const fake = await upload(api, ids.receipt, Buffer.from('<html><script>alert(1)</script></html>'.padEnd(64, ' ')), 'image/jpeg');
    assert.deepEqual([fake.status, fake.body.code], [400, 'INVALID_DOCUMENT']);
    assert.equal((await upload(api, ids.receipt, PDF, 'image/jpeg')).status, 400, 'il tipo dichiarato non coincide col contenuto');
    assert.equal((await upload(api, ids.receipt, Buffer.from('ciao'), 'text/plain')).status, 400);
    assert.equal((await upload(cashier, ids.receipt, JPEG, 'image/jpeg')).status, 403);
    assert.equal((await upload(api, 999999, JPEG, 'image/jpeg')).status, 404);
    assert.equal((await upload(api, ids.receipt, Buffer.concat([JPEG, Buffer.alloc(9 * 1024 * 1024)]), 'image/jpeg')).status, 413, 'oltre gli 8 MB');

    const file = await download(api, ids.receipt, ok.body.id);
    assert.equal(file.status, 200);
    assert.equal(file.headers['content-type'], 'image/jpeg');
    assert.equal(file.headers['x-content-type-options'], 'nosniff');
    assert.ok(file.body.equals(JPEG));
    assert.equal((await download(otherApi, ids.receipt, ok.body.id)).status, 404, 'un altro locale non lo apre');
    assert.equal((await api.get(`/goods-receipts/${ids.receipt}`)).body.documents.length, 2);
    assert.equal((await api.request('DELETE', `/goods-receipts/${ids.receipt}/documents/${ok.body.id}`)).status, 200);
    assert.equal((await api.get(`/goods-receipts/${ids.receipt}`)).body.documents.length, 1);
  });

  it('un fornitore con carichi si disattiva, non si elimina; senza carichi sì', async () => {
    assert.equal((await api.request('DELETE', `/suppliers/${ids.supplier}`)).body.code, 'SUPPLIER_IN_USE');
    const spare = (await api.post('/suppliers', { name: 'Da buttare' })).body.id;
    assert.equal((await api.request('DELETE', `/suppliers/${spare}`)).status, 200);
  });
});
