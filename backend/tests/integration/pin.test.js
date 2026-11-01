// PIN personale: l'amministratore lo imposta, chi è collegato sblocca lo schermo, il personale operativo si dà il cambio sulla stessa cassa.
// Regole: 4-6 cifre non banali, blocco dopo 5 errori (la password resta valida), cambio utente solo verso cassa/sala/cucina, mai verso admin o responsabile.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { startServer, createTenant, deleteTenants, closePools, apiClient, adminDb, PASSWORD } from './helpers.js';

describe('PIN: sblocco e cambio utente', () => {
  let server, t, other, admin, cashier, ids = {};

  const addUser = async (tenant, role, { mustChange = false } = {}) => {
    const username = `${role}-${tenant.slug}`;
    const { rows: [u] } = await adminDb.query(
      'INSERT INTO users (username, password_hash, role, tenant_id, must_change_password) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [username, await bcrypt.hash(PASSWORD, 4), role, tenant.id, mustChange]);
    return { id: u.id, username };
  };
  const audit = async (action) => (await adminDb.query('SELECT user_id, details FROM audit_logs WHERE tenant_id = $1 AND action = $2 ORDER BY id', [t.id, action])).rows;

  before(async () => {
    server = await startServer();
    [t, other] = [await createTenant(), await createTenant()];
    const cash = await addUser(t, 'cashier'); const waiter = await addUser(t, 'waiter'); const manager = await addUser(t, 'manager');
    const fresh = await addUser({ ...t, slug: `${t.slug}-n` }, 'kitchen', { mustChange: true });
    const foreign = await addUser(other, 'cashier');
    ids = { cash: cash.id, waiter: waiter.id, manager: manager.id, fresh: fresh.id, foreign: foreign.id, admin: t.userId };
    admin = apiClient(server.port, t.host); cashier = apiClient(server.port, t.host);
    await admin.login(t.username); await cashier.login(cash.username);
  });
  after(async () => { await deleteTenants(t, other); await server.close(); await closePools(); });

  const setPin = (userId, pin, client = admin) => client.request('PUT', `/pin/users/${userId}`, { pin });

  it('solo l\'amministratore imposta il PIN, e deve essere di 4-6 cifre non banali', async () => {
    assert.equal((await setPin(ids.cash, '4829', cashier)).status, 403, 'la cassa non imposta PIN');
    for (const bad of ['12', '1234567', '12a4', '0000', '1234', '654321']) assert.equal((await setPin(ids.cash, bad)).status, 400, bad);
    assert.equal((await setPin(ids.cash, '4829')).status, 200);
    for (const short of ['7391', '73914']) assert.equal((await setPin(ids.admin, short)).status, 400, `admin: ${short} è troppo corto`);
    assert.equal((await setPin(ids.manager, '5820')).status, 400, 'anche il responsabile vuole 6 cifre');
    assert.equal((await setPin(ids.admin, '739104')).status, 200, 'anche il proprio');
    assert.equal((await setPin(ids.manager, '582047')).status, 200);
    assert.equal((await setPin(ids.waiter, '2468')).status, 200);
    assert.equal((await setPin(ids.fresh, '9183')).status, 200);
    assert.equal((await setPin(ids.foreign, '9183')).status, 404, 'un utente di un altro locale non esiste');
    const { rows: [row] } = await adminDb.query('SELECT pin_hash FROM users WHERE id = $1', [ids.cash]);
    assert.ok(row.pin_hash && row.pin_hash !== '4829' && row.pin_hash.startsWith('$2'), 'si salva solo l\'hash');
    assert.equal((await audit('PIN_SET')).length, 5);
    assert.equal((await adminDb.query('SELECT pin_length FROM users WHERE id = $1', [ids.cash])).rows[0].pin_length, 4, 'si ricorda quante cifre ha, non il PIN');
  });

  it('l\'elenco utenti dice chi ha un PIN, e /auth/me lo dice a chi lo ha', async () => {
    const users = (await admin.get('/auth/admin/users')).body;
    assert.equal(users.find(u => u.id === ids.cash).has_pin, true);
    assert.equal((await cashier.get('/auth/me')).body.hasPin, true);
    assert.equal((await cashier.get('/auth/me')).body.pinLength, 4);
    const nopin = apiClient(server.port, other.host); await nopin.login(other.username);
    assert.equal((await nopin.get('/auth/me')).body.hasPin, false);
  });

  it('sblocco con il proprio PIN o con la password; sbagliare 5 volte blocca il PIN, ma la password resta valida', async () => {
    assert.equal((await cashier.post('/pin/unlock', { pin: '4829' })).status, 200);
    assert.equal((await cashier.post('/pin/unlock', { password: PASSWORD })).status, 200);
    assert.equal((await cashier.post('/pin/unlock', { password: 'sbagliata' })).status, 403);
    assert.equal((await cashier.post('/pin/unlock', {})).status, 400, 'o il PIN o la password');
    const wrong = await cashier.post('/pin/unlock', { pin: '1111' });
    assert.equal(wrong.status, 403);
    assert.equal(wrong.body.code, 'WRONG_PIN');
    assert.match(wrong.body.error, /4 tentativi/);
    for (let i = 0; i < 3; i++) assert.equal((await cashier.post('/pin/unlock', { pin: '1111' })).body.code, 'WRONG_PIN');
    const locked = await cashier.post('/pin/unlock', { pin: '1111' });
    assert.equal(locked.body.code, 'PIN_LOCKED', 'il quinto errore blocca');
    assert.equal((await cashier.post('/pin/unlock', { pin: '4829' })).body.code, 'PIN_LOCKED', 'bloccato anche con il PIN giusto');
    assert.equal((await cashier.post('/pin/unlock', { password: PASSWORD })).status, 200, 'la password sblocca sempre');
    assert.equal((await audit('PIN_LOCKED_OUT')).length, 1);
    await adminDb.query('UPDATE users SET pin_locked_until = now() - interval \'1 second\' WHERE id = $1', [ids.cash]);
    assert.equal((await cashier.post('/pin/unlock', { pin: '4829' })).status, 200, 'passato il blocco si riprova');
    assert.equal((await adminDb.query('SELECT pin_failed FROM users WHERE id = $1', [ids.cash])).rows[0].pin_failed, 0, 'un PIN giusto azzera gli errori');
  });

  it('senza sessione non si sblocca né si cambia utente: il PIN non è un accesso', async () => {
    const anon = apiClient(server.port, t.host);
    assert.equal((await anon.post('/pin/unlock', { pin: '4829' })).status, 401);
    assert.equal((await anon.post('/pin/switch', { userId: ids.cash, pin: '4829' })).status, 401);
    assert.equal((await anon.get('/pin/operators')).status, 401);
  });

  it('il cambio utente veloce elenca chi ha un PIN, con le cifre; non chi deve ancora cambiare la password', async () => {
    const list = (await admin.get('/pin/operators')).body;
    assert.deepEqual(list.map(u => u.role).sort(), ['admin', 'cashier', 'manager', 'waiter']);
    assert.deepEqual(list.find(u => u.id === ids.cash).pin_length, 4);
    assert.deepEqual(list.find(u => u.id === ids.manager).pin_length, 6);
    assert.ok(list.every(u => !('pin_hash' in u) && !('password_hash' in u)));
  });

  it('il PIN di un collega apre la sua sessione sullo stesso dispositivo; sbagliare lo conta', async () => {
    const station = apiClient(server.port, t.host); await station.login(t.username);
    assert.equal((await station.get('/auth/me')).body.role, 'admin');
    const wrong = await station.post('/pin/switch', { userId: ids.waiter, pin: '0852' });
    assert.equal(wrong.body.code, 'WRONG_PIN');
    const ok = await station.post('/pin/switch', { userId: ids.waiter, pin: '2468' });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.role, 'waiter');
    assert.equal(ok.body.hasPin, true);
    assert.ok(Array.isArray(ok.body.modules) && ok.body.tenantName, 'la stessa risposta del login');
    const me = (await station.get('/auth/me')).body;
    assert.deepEqual([me.id, me.role], [ids.waiter, 'waiter'], 'da ora il dispositivo è del cameriere');
    assert.equal((await station.get('/auth/admin/users')).status, 403, 'e ha i permessi del cameriere, non dell\'admin');
    const log = await audit('PIN_SWITCH');
    assert.equal(log.length, 1);
    assert.equal(log[0].user_id, ids.waiter);
    assert.equal(log[0].details.from, ids.admin);
  });

  it('si passa ad admin o responsabile solo con un PIN di 6 cifre; mai a chi ha la password temporanea né a un altro locale', async () => {
    const station = apiClient(server.port, t.host); await station.login((await adminDb.query('SELECT username FROM users WHERE id = $1', [ids.cash])).rows[0].username);
    const manager = await station.post('/pin/switch', { userId: ids.manager, pin: '582047' });
    assert.equal(manager.status, 200, JSON.stringify(manager.body));
    assert.deepEqual([manager.body.role, manager.body.pinLength], ['manager', 6]);
    assert.equal((await station.get('/auth/me')).body.role, 'manager');
    // un responsabile con un PIN corto (impostato prima di questa regola) non è raggiungibile
    await adminDb.query('UPDATE users SET pin_hash = (SELECT pin_hash FROM users WHERE id = $2), pin_length = NULL WHERE id = $1', [ids.manager, ids.cash]);
    const old = await station.post('/pin/switch', { userId: ids.manager, pin: '4829' });
    assert.equal(old.body.code, 'NOT_SWITCHABLE');
    assert.equal((await station.post('/pin/switch', { userId: ids.fresh, pin: '9183' })).status, 403, 'password temporanea da cambiare');
    assert.equal((await station.post('/pin/switch', { userId: ids.foreign, pin: '9183' })).body.code, 'NOT_SWITCHABLE', 'un altro locale non esiste');
    const toAdmin = await station.post('/pin/switch', { userId: ids.admin, pin: '739104' });
    assert.equal(toAdmin.body.role, 'admin', 'anche all\'amministratore, con il suo PIN a 6 cifre');
  });

  it('togliere il PIN lo rende inutilizzabile', async () => {
    assert.equal((await admin.request('DELETE', `/pin/users/${ids.waiter}`)).status, 200);
    const station = apiClient(server.port, t.host); await station.login(t.username);
    assert.equal((await station.post('/pin/switch', { userId: ids.waiter, pin: '2468' })).body.code, 'NO_PIN');
    assert.equal((await audit('PIN_CLEARED')).length, 1);
  });
});
