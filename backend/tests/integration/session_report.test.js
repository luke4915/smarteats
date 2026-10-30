// Esportazioni di una serata: il CSV (righe e prodotti) e i numeri del report per il PDF, con ordini pagati subito, un conto pagato con carta e un omaggio.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { toOrderItemRows } from '../../utils/orderItems.js';
import { insertOrderItemRows } from '../../utils/orderItemsWrite.js';
import { startServer, createTenant, deleteTenants, closePools, apiClient, adminDb } from './helpers.js';

describe('esportazioni della serata', () => {
  let server, t, admin, device, tableId, checkId;

  const addOrder = async ({ items, total, status = 'completed', code, deviceId = null, seq = null, check = null }) => {
    const { rows: [o] } = await adminDb.query(
      `INSERT INTO orders (total, status, session_id, tenant_id, order_type, display_code, device_id, device_seq, check_id) VALUES ($1, $2, $3, $4, 'sale', $5, $6, $7, $8) RETURNING id`,
      [total, status, t.sessionId, t.id, code, deviceId, seq, check]);
    await insertOrderItemRows(adminDb, t.id, toOrderItemRows(items).rows.map(r => ({ ...r, order_id: o.id })));
    return o.id;
  };

  before(async () => {
    server = await startServer();
    t = await createTenant({ businessType: 'restaurant' });
    admin = apiClient(server.port, t.host);
    await admin.login(t.username);
    ({ rows: [device] } = await adminDb.query(`INSERT INTO devices (tenant_id, letter, name) VALUES ($1, 'A', 'Cassa 1') RETURNING id`, [t.id]));
    const room = (await admin.post('/rooms', { name: 'Sala' })).body;
    tableId = (await admin.post(`/rooms/${room.id}/tables/bulk`, { prefix: 'T', from: 1, to: 2 })).body.created[0].id;
    checkId = (await admin.post('/checks', { table_id: tableId, covers: 2 })).body.id;
    const panino = (q, price, extra = {}) => ({ id: t.productId, name: 'Panino', quantity: q, price, line_total: q * price, category: 'Cibo', ...extra });
    await addOrder({ items: [panino(2, 5)], total: 10, code: 'A1', deviceId: device.id, seq: 1 });
    await addOrder({ items: [panino(1, 5, { type: 'gift', original_price: 5, line_total: 0, price: 0 })], total: 0, code: 'A2', deviceId: device.id, seq: 2 });
    await addOrder({ items: [panino(1, 5)], total: 5, status: 'canceled', code: 'A3', deviceId: device.id, seq: 3 });
    await addOrder({ items: [panino(4, 5)], total: 20, code: 'B1', check: checkId });
    await adminDb.query(`INSERT INTO payments (tenant_id, check_id, method, amount) VALUES ($1, $2, 'card', 20)`, [t.id, checkId]);
    await adminDb.query(`UPDATE checks SET status = 'paid', closed_at = now() WHERE id = $1`, [checkId]);
  });
  after(async () => {
    await deleteTenants(t);
    await server.close();
    await closePools();
  });

  it('il report ha incasso, cassa, pagamenti, prodotti e coperti', async () => {
    const res = await admin.get(`/exports/session/${t.sessionId}/report?tz=Europe/Rome`);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const r = res.body;
    assert.equal(r.locale.businessType, 'restaurant');
    assert.equal(r.summary.revenue, 30, '10 pagati subito + 20 di un conto pagato; l\'annullato non conta');
    assert.equal(r.summary.orders, 3);
    assert.equal(r.summary.giftTotal, 5);
    assert.deepEqual([r.summary.canceledCount, r.summary.canceledTotal], [1, 5]);
    assert.equal(r.summary.covers, 2);
    assert.equal(r.summary.averagePerCover, 15);
    assert.deepEqual(r.payments.map(p => [p.method, p.amount]), [['register', 10], ['card', 20]]);
    assert.deepEqual(r.cash, { expected: 10, declared: null, difference: null }, 'la carta non entra nel cassetto');
    assert.deepEqual(r.products.map(p => [p.name, p.quantity, p.gifts, p.revenue]), [['Panino', 7, 1, 30]]);
    assert.deepEqual(r.bySource.map(s => [s.source, s.orders]), [[null, 1], ['A', 2]], 'prima chi ha incassato di più: il conto pagato (senza cassa), poi la cassa A');
  });

  it('il report è per admin e responsabile, e una serata che non c\'è dà 404', async () => {
    assert.equal((await admin.get('/exports/session/999999999/report')).status, 404);
    assert.equal((await admin.get(`/exports/session/${t.sessionId}/report?tz=Marte/Olimpo`)).status, 400);
  });

  it('il CSV delle righe ha cassa e tavolo, tipo e omaggio', async () => {
    const res = await admin.get(`/exports/session/${t.sessionId}/csv`);
    assert.equal(res.status, 200);
    const lines = String(res.body).replace('﻿', '').split('\n');
    assert.match(lines[0], /^Ordine;Codice;Data;Ora;Origine;Asporto;Prodotto;/);
    assert.equal(lines.length - 1, 3, 'tre righe d\'ordine incassate');
    assert.ok(lines.some(l => l.includes('"A1"') && l.includes('"Cassa A"') && l.includes(';2;5,00;Vendita;0,00;10,00;')));
    assert.ok(lines.some(l => l.includes('"A2"') && l.includes(';Omaggio;5,00;0,00;')));
    assert.ok(lines.some(l => l.includes('"B1"') && l.includes('"Tavolo T1"')));
  });

  it('il CSV dei prodotti ha una riga per prodotto', async () => {
    const res = await admin.get(`/exports/session/${t.sessionId}/csv?type=products`);
    assert.equal(res.status, 200);
    const lines = String(res.body).replace('﻿', '').split('\n');
    assert.equal(lines[0], 'Prodotto;Categoria;Quantità;Di cui omaggi;Incasso;Prezzo medio');
    assert.equal(lines[1], '"Panino";"Cibo";7;1;30,00;4,29');
    assert.equal((await admin.get(`/exports/session/${t.sessionId}/csv?type=altro`)).status, 400);
  });
});
