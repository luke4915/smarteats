// Impostazioni di stampa: la carta di ogni stampante (58 o 80 mm) si salva, vale 80 se non si dice, e solo l'admin la cambia.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, createTenant, deleteTenants, closePools, apiClient } from './helpers.js';

describe('stampanti: larghezza della carta', () => {
  let server, t, admin, rowId;
  before(async () => {
    server = await startServer(); t = await createTenant();
    admin = apiClient(server.port, t.host); await admin.login(t.username);
    await admin.post('/print-settings/copy-types', { name: 'Cucina', label: 'Comanda cucina' });
    rowId = (await admin.get('/print-settings')).body[0].id;
  });
  after(async () => { await deleteTenants(t); await server.close(); await closePools(); });

  const save = (body) => admin.request('PUT', `/print-settings/${rowId}`, { printer_type: 'network', printer_address: '192.168.1.50', enabled: true, ...body });

  it('di partenza è 80 mm, come prima', async () => {
    assert.equal((await admin.get('/print-settings')).body[0].paper_mm, 80);
  });

  it('si sceglie 58 o 80; altri valori no; se non si dice non cambia', async () => {
    assert.equal((await save({ paper_mm: 58 })).body.paper_mm, 58);
    assert.equal((await admin.get('/print-settings')).body[0].paper_mm, 58);
    assert.equal((await save({ paper_mm: 72 })).status, 400);
    assert.equal((await save({})).body.paper_mm, 58, 'un salvataggio senza carta la lascia com\'è');
    assert.equal((await save({ paper_mm: 80 })).body.paper_mm, 80);
  });

  it('solo l\'amministratore la cambia', async () => {
    const cashier = apiClient(server.port, t.host);
    const { adminDb, PASSWORD } = await import('./helpers.js');
    const bcrypt = (await import('bcrypt')).default;
    await adminDb.query(`INSERT INTO users (username, password_hash, role, tenant_id) VALUES ($1, $2, 'cashier', $3)`, [`cassa-${t.slug}`, await bcrypt.hash(PASSWORD, 4), t.id]);
    await cashier.login(`cassa-${t.slug}`);
    assert.equal((await cashier.request('PUT', `/print-settings/${rowId}`, { printer_type: 'network', printer_address: '192.168.1.50', enabled: true, paper_mm: 58 })).status, 403);
    assert.equal((await cashier.get('/print-settings')).body[0].paper_mm, 80, 'ma la cassa la legge, per stampare');
  });
});
