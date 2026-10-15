// Feedback sull'app: lo scrive ogni utente collegato, lo legge il master; ogni locale vede solo il suo.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { startServer, createTenant, deleteTenants, closePools, apiClient, adminDb } from './helpers.js';

// In CI non c'è un .env: il segreto del Master di prova si imposta qui (come negli altri test)
process.env.MASTER_JWT_SECRET ||= 'segreto-master-di-prova-lungo-almeno-32-caratteri';
describe('feedback', () => {
  let server, t, other, admin, otherApi, master;
  const masterCookie = () => ({ cookie: `master_token=${jwt.sign({ master: true }, process.env.MASTER_JWT_SECRET)}` });

  before(async () => {
    server = await startServer();
    [t, other] = [await createTenant(), await createTenant()];
    admin = apiClient(server.port, t.host); await admin.login(t.username);
    otherApi = apiClient(server.port, other.host); await otherApi.login(other.username);
    master = apiClient(server.port, 'master.standmanager.local');
  });
  after(async () => {
    await deleteTenants(t, other);
    await server.close();
    await closePools();
  });

  it('un utente lascia un feedback; validazione e accesso', async () => {
    assert.equal((await apiClient(server.port, t.host).post('/feedback', { module: 'floor', message: 'Ciao' })).status, 401);
    assert.equal((await admin.post('/feedback', { module: 'floor', message: 'x' })).status, 400, 'troppo corto');
    assert.equal((await admin.post('/feedback', { module: 'inesistente', message: 'Una frase vera' })).status, 400);
    const ok = await admin.post('/feedback', { module: 'takeaway', message: 'Vorrei stampare anche l\'orario di ritiro' });
    assert.equal(ok.status, 201);
    assert.equal((await otherApi.post('/feedback', { message: 'Tutto chiaro, grazie' })).status, 201, 'il modulo di partenza è «general»');
  });

  it('il master vede il feedback di tutti i locali, lo segna letto; i locali non vedono quello degli altri', async () => {
    const list = (await master.request('GET', '/master/feedback', undefined, masterCookie())).body;
    const mine = list.find(f => f.message.includes('orario di ritiro'));
    assert.deepEqual([mine.module, mine.status, mine.username], ['takeaway', 'new', t.username]);
    assert.ok(list.some(f => f.tenant_id === other.id), 'anche quello dell\'altro locale');
    const read = await master.request('PATCH', `/master/feedback/${mine.id}`, { status: 'read' }, masterCookie());
    assert.equal(read.status, 200);
    const { rows } = await adminDb.query('SELECT status FROM app_feedback WHERE id = $1', [mine.id]);
    assert.equal(rows[0].status, 'read');
    // un utente di un locale non legge il pannello master
    assert.equal((await admin.request('GET', '/master/feedback')).status, 401);
  });
});
