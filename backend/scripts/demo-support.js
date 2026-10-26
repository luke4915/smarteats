// Pezzi comuni degli script che creano locali di dimostrazione (seed-demo-festival.js): il controllo del dominio locale, un
// generatore pseudo-casuale con seme fisso (il locale è sempre uguale), le date nel fuso del locale, l'app avviata in memoria e un
// client HTTP che parla con quell'app come farebbe il browser. Un locale demo è un dato di prova: non va mai su un server vero.
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));

// Carica la configurazione e rifiuta di partire su un dominio vero. Va chiamata prima di importare l'app.
export function prepareDemoEnvironment() {
  dotenv.config({ path: path.resolve(here, '..', '.env'), quiet: true });
  if (!/(\.local|localhost)$/.test(process.env.APP_DOMAIN || 'smarteats.local') && process.env.DEMO_ALLOW_PRODUCTION !== 'yes') {
    console.error('❌ Il locale demo si crea solo su un dominio locale (APP_DOMAIN .local). Imposta DEMO_ALLOW_PRODUCTION=yes se lo vuoi davvero.');
    process.exit(1);
  }
  if (!process.env.MIGRATION_DATABASE_URL) {
    console.error('❌ Serve MIGRATION_DATABASE_URL (utente privilegiato).');
    process.exit(1);
  }
  process.env.WHATSAPP_DRIVER ||= 'mock';
  process.env.LOG_LEVEL = 'error';
  return { domain: process.env.APP_DOMAIN || 'smarteats.local', admin: new pg.Pool({ connectionString: process.env.MIGRATION_DATABASE_URL, max: 2 }) };
}

// Generatore con seme fisso: stessi numeri a ogni esecuzione.
export function createRandom(seed) {
  let state = seed;
  const rand = () => { state = (state * 1664525 + 1013904223) % 4294967296; return state / 4294967296; };
  return { rand, pick: (list) => list[Math.floor(rand() * list.length)], between: (a, b) => a + Math.floor(rand() * (b - a + 1)) };
}

const TZ = 'Europe/Rome';
// Il giorno `offsetDays` rispetto a oggi, `YYYY-MM-DD` nel fuso del locale.
export const dayString = (offsetDays = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(Date.now() + offsetDays * 86400000));
export const italianDate = (ymd) => ymd.split('-').reverse().join('/');

// L'app vera in memoria, su una porta libera: le richieste del demo passano dagli stessi controlli di quelle del browser.
export async function startDemoApp() {
  const { createApp } = await import('../app.js');
  const { createWebSocketHub } = await import('../ws.js');
  const hub = createWebSocketHub();
  const server = http.createServer(createApp({ broadcast: hub.broadcast, rateLimit: false }));
  hub.attach(server);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { port: server.address().port, close: () => { hub.close(); server.close(); } };
}

// Un client che tiene il cookie di sessione, come un browser, per il locale `host`.
export function createClient(port, host, password) {
  let cookie = null;
  const request = (method, apiPath, body) => new Promise((resolve, reject) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const req = http.request({
      host: '127.0.0.1', port, method, path: `/api${apiPath}`,
      headers: { host, ...(cookie && { cookie }), ...(data && { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) }) },
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        const sc = res.headers['set-cookie']?.find(c => c.startsWith('token='));
        if (sc) cookie = sc.split(';')[0];
        let parsed = raw;
        try { parsed = raw ? JSON.parse(raw) : null; } catch { /* non è JSON */ }
        if (res.statusCode >= 400) {
          const err = new Error(`${method} ${apiPath} → ${res.statusCode}: ${parsed?.error ?? raw}`);
          err.status = res.statusCode; err.code = parsed?.code;
          return reject(err);
        }
        resolve(parsed);
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
  return {
    get: (p) => request('GET', p), post: (p, b) => request('POST', p, b ?? {}), put: (p, b) => request('PUT', p, b), patch: (p, b) => request('PATCH', p, b),
    login: (username) => request('POST', '/auth/login', { username, password }),
  };
}

// Cancella un locale e tutti i suoi dati senza conoscere l'ordine delle chiavi esterne: ripete finché ogni tabella con
// `tenant_id` è vuota per quel locale.
export async function deleteTenantData(admin, tenantId) {
  const { rows } = await admin.query(`SELECT table_name FROM information_schema.columns WHERE column_name = 'tenant_id' AND table_schema = 'public'`);
  let pending = rows.map(r => r.table_name).filter(name => name !== 'tenants');
  for (let pass = 0; pass < 8 && pending.length > 0; pass += 1) {
    const failed = [];
    for (const table of pending) {
      try { await admin.query(`DELETE FROM ${table} WHERE tenant_id = $1`, [tenantId]); } catch { failed.push(table); }
    }
    pending = failed;
  }
  if (pending.length > 0) throw new Error(`Non riesco a svuotare: ${pending.join(', ')}`);
  await admin.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
}
