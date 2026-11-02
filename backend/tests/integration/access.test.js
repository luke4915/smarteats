// Nessuna route del personale risponde a chi non è collegato: l'elenco delle route si ricava dal codice (app.js + file in routes/),
// così una route nuova dimenticata senza `authenticate` fa fallire questo test. Le route pubbliche sono elencate qui sotto, una per una.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcrypt';
import { startServer, createTenant, deleteTenants, closePools, apiClient, adminDb, PASSWORD } from './helpers.js';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (file) => fs.readFileSync(path.join(backendDir, file), 'utf8');

// Percorsi aperti a tutti per scelta (clienti, accesso, webhook firmati, monitoraggio). Chi ne aggiunge uno lo scrive qui.
const PUBLIC = [
  /^\/health/, /^\/public\//, /^\/webhooks\//, /^POST \/auth\/(login|refresh|logout)$/, /^POST \/master\/(login|logout)$/,
  /^GET \/settings\/$/, /^GET \/orders\/kds$/, /^GET \/products\/menu$/,
];

function discoverRoutes() {
  const app = read('app.js');
  const files = Object.fromEntries([...app.matchAll(/import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+'\.\/(routes\/[^']+)'/g)]
    .flatMap(([, named, def, file]) => [...(named ?? def).split(',').map(n => n.trim().split(/\s+as\s+/).pop()).filter(Boolean)].map(n => [n, file])));
  const routes = [];
  for (const [, mount, name] of app.matchAll(/app\.use\('(\/api\/[^']*)',\s*(\w+)/g)) {
    const file = files[name];
    if (!file) continue;
    for (const [, method, sub] of read(file).matchAll(/\b(?:router|r)\.(get|post|put|patch|delete)\(\s*'([^']*)'/g)) {
      routes.push({ method: method.toUpperCase(), url: `${mount.replace('/api', '')}${sub === '/' ? '/' : sub}`.replace(/:\w+/g, '1') });
    }
  }
  return routes;
}

describe('accesso: chi non è collegato non entra', () => {
  let server, t;
  before(async () => { server = await startServer(); t = await createTenant(); });
  after(async () => { await deleteTenants(t); await server.close(); await closePools(); });

  it('ogni route non pubblica risponde 401 (o 404 se il percorso non c\'è) senza sessione', async () => {
    const routes = discoverRoutes();
    assert.ok(routes.length > 150, `route trovate: ${routes.length}`);
    const api = apiClient(server.port, t.host);
    const open = [];
    for (const { method, url } of routes) {
      if (PUBLIC.some(re => re.test(url) || re.test(`${method} ${url}`))) continue;
      const res = await api.request(method, url, method === 'GET' || method === 'DELETE' ? undefined : {});
      if (![401, 404].includes(res.status)) open.push(`${method} ${url} → ${res.status}`);
    }
    assert.deepEqual(open, [], 'queste route rispondono senza login');
  });

  it('la cucina non vede i contanti delle serate, né il totale atteso, né cambia il proprio username', async () => {
    await adminDb.query('UPDATE sessions SET expected_cash = 120, declared_cash = 118 WHERE tenant_id = $1', [t.id]);
    const username = `cucina-${t.slug}`;
    await adminDb.query(`INSERT INTO users (username, password_hash, role, tenant_id) VALUES ($1, $2, 'kitchen', $3)`, [username, await bcrypt.hash(PASSWORD, 4), t.id]);
    const kitchen = apiClient(server.port, t.host), admin = apiClient(server.port, t.host);
    await kitchen.login(username); await admin.login(t.username);
    const seen = (await kitchen.get('/sessions')).body;
    assert.ok(seen.length && seen.every(x => !('expected_cash' in x) && !('declared_cash' in x)), 'niente contanti per la cucina');
    assert.ok(!('expected_cash' in (await kitchen.get('/sessions/latest')).body));
    assert.equal((await kitchen.get('/sessions/expected-cash')).status, 403);
    assert.equal((await kitchen.request('PATCH', '/profile/username', { newUsername: 'altronome' })).status, 403);
    assert.equal((await admin.get('/sessions')).body[0].expected_cash != null, true, 'l\'admin li vede');
  });
});
