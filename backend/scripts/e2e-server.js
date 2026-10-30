// Server di prova per i test nel browser (frontend/e2e, `npm run e2e` nel frontend).
// Avvia l'app vera (HTTPS con un certificato autogenerato, perché i cookie di sessione sono «secure»), serve il
// frontend compilato (frontend/dist: va costruito prima) e prepara due locali di prova nel database di test: un
// ristorante e una sagra, con utenti, prodotti, portate e sala. Scrive in E2E_SEED_FILE gli indirizzi e gli utenti.
// A fine corsa (SIGTERM) cancella i locali di prova. Serve backend/.env.test, come i test di integrazione.
import https from 'https';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import express from 'express';
import bcrypt from 'bcrypt';

const { createTenant, deleteTenants, adminDb, closePools, PASSWORD } = await import('../tests/integration/helpers.js');
const { createApp } = await import('../app.js');
const { createWebSocketHub } = await import('../ws.js');

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, '..', '..', 'frontend', 'dist');
const port = Number(process.env.E2E_PORT || 4443);
const seedFile = process.env.E2E_SEED_FILE || path.resolve(here, '..', '..', 'frontend', 'e2e', '.run', 'seed.json');

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('Manca frontend/dist: costruisci prima il frontend (npm run build).');
  process.exit(1);
}

// Certificato autogenerato per *.smarteats.local (vale pochi giorni, solo per le prove)
const certDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-cert-'));
const key = path.join(certDir, 'key.pem'), cert = path.join(certDir, 'cert.pem');
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '2',
  '-subj', '/CN=smarteats.local', '-addext', 'subjectAltName=DNS:*.smarteats.local,DNS:smarteats.local'], { stdio: 'ignore' });

const hash = await bcrypt.hash(PASSWORD, 4);
// Avvisi WhatsApp: driver finto (non esce nulla), qualunque sia NODE_ENV
process.env.WHATSAPP_DRIVER = 'mock';
// Pagamenti con carta: Stripe finto (nessuna chiamata verso internet); il ristorante ha il modulo e un conto collegato di prova
process.env.STRIPE_DRIVER = 'mock';
// Console master: stessa password di prova (serve MASTER_JWT_SECRET, diverso da JWT_SECRET)
process.env.MASTER_PASSWORD_HASH = hash;
process.env.MASTER_JWT_SECRET ||= `${process.env.JWT_SECRET ?? 'e2e'}-master-console-prova-0123456789`;
const addUser = async (tenant, role) => {
  const username = `${role}-${tenant.slug}`;
  await adminDb.query('INSERT INTO users (username, password_hash, role, tenant_id) VALUES ($1, $2, $3, $4)', [username, hash, role, tenant.id]);
  return username;
};
const addProduct = async (tenant, name, price, category, extra = {}) => {
  const { rows: [p] } = await adminDb.query(
    `INSERT INTO products (name, price, category, print_destination, course_id, color, tenant_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [name, price, category, extra.destination ?? 'both', extra.courseId ?? null, extra.color ?? '#3b82f6', tenant.id]);
  return p.id;
};

// ── Ristorante: sala con 4 tavoli piazzati, portate e carta ──
const risto = await createTenant({ businessType: 'restaurant' });
const { rows: [room] } = await adminDb.query(`INSERT INTO rooms (name, grid_w, grid_h, tenant_id) VALUES ('Sala', 16, 10, $1) RETURNING id`, [risto.id]);
const layout = [['T1', 2, 2, 3, 2, 'rect', 4], ['T2', 7, 2, 3, 2, 'rect', 4], ['T3', 12, 2, 2, 2, 'round', 2], ['T4', 2, 6, 4, 2, 'rect', 6]];
for (const [name, x, y, w, h, shape, seats] of layout)
  await adminDb.query(`INSERT INTO dining_tables (room_id, name, seats, seats_min, x, y, w, h, shape, tenant_id) VALUES ($1,$2,$3,$3,$4,$5,$6,$7,$8,$9)`, [room.id, name, seats, x, y, w, h, shape, risto.id]);
const { rows: [antipasti] } = await adminDb.query(`INSERT INTO courses (name, position, tenant_id) VALUES ('Antipasti', 0, $1) RETURNING id`, [risto.id]);
const { rows: [primi] } = await adminDb.query(`INSERT INTO courses (name, position, tenant_id) VALUES ('Primi', 1, $1) RETURNING id`, [risto.id]);
await addProduct(risto, 'Bruschetta', 6, 'Antipasti', { courseId: antipasti.id, destination: 'kitchen' });
await addProduct(risto, 'Spaghetti alle vongole', 14, 'Primi', { courseId: primi.id, destination: 'kitchen' });
await addProduct(risto, 'Vino della casa', 18, 'Bevande', { destination: 'bar' });
await addProduct(risto, 'Acqua', 2, 'Bevande', { destination: 'bar' });
// Prenotazioni: modulo acceso e due turni fissi, tutti i giorni
await adminDb.query(`UPDATE tenants SET modules = array_cat(modules, ARRAY['bookings', 'takeaway', 'whatsapp', 'payments']), stripe_account_id = 'acct_e2e' WHERE id = $1`, [risto.id]);
// Asporto: aperto tutti i giorni dalle 12:00 alle 23:30, fasce da 15 minuti, 12 porzioni per fascia
for (let weekday = 0; weekday < 7; weekday += 1)
  await adminDb.query(`INSERT INTO takeaway_hours (weekday, open_time, close_time, tenant_id) VALUES ($1, '00:00', '23:45', $2)`, [weekday, risto.id]);
await adminDb.query(`INSERT INTO booking_shifts (name, start_time, duration_minutes, capacity, position, tenant_id) VALUES ('Cena 19:30', '19:30', 90, 30, 0, $1), ('Cena 21:00', '21:00', 90, 20, 1, $1)`, [risto.id]);
const ristoSeed = { host: `${risto.slug}.smarteats.local`, admin: risto.username, kitchen: await addUser(risto, 'kitchen'), waiter: await addUser(risto, 'waiter'), cashier: await addUser(risto, 'cashier') };

// ── Sagra: carta con più categorie ──
const sagra = await createTenant({ businessType: 'street_food' });
for (const [name, price, category] of [['Panino con salsiccia', 5, 'Panini'], ['Patatine', 3, 'Contorni'], ['Birra', 4, 'Bevande'], ['Acqua', 1, 'Bevande'], ['Tiramisù', 4, 'Dolci']])
  await addProduct(sagra, name, price, category);
const sagraSeed = { host: `${sagra.slug}.smarteats.local`, admin: sagra.username, kitchen: await addUser(sagra, 'kitchen'), cashier: await addUser(sagra, 'cashier') };

// ── Pizzeria di solo asporto: nessun tavolo, nessuna prenotazione ──
const shop = await createTenant({ businessType: 'takeaway_shop' });
for (const [name, price, category] of [['Margherita', 6, 'Pizze'], ['Diavola', 8, 'Pizze'], ['Acqua', 1.5, 'Bevande']])
  await addProduct(shop, name, price, category);
for (let weekday = 0; weekday < 7; weekday += 1)
  await adminDb.query(`INSERT INTO takeaway_hours (weekday, open_time, close_time, tenant_id) VALUES ($1, '00:00', '23:45', $2)`, [weekday, shop.id]);
const shopSeed = { host: `${shop.slug}.smarteats.local`, admin: shop.username, kitchen: await addUser(shop, 'kitchen') };

fs.mkdirSync(path.dirname(seedFile), { recursive: true });
fs.writeFileSync(seedFile, JSON.stringify({ port, password: PASSWORD, restaurant: ristoSeed, festival: sagraSeed, shop: shopSeed }, null, 2));

const hub = createWebSocketHub();
const inner = createApp({ broadcast: hub.broadcast, rateLimit: false });
const app = express();
app.use(inner);
app.use(express.static(dist));
app.use((req, res, next) => (req.method === 'GET' && !req.path.startsWith('/api') ? res.sendFile(path.join(dist, 'index.html')) : next()));
const server = https.createServer({ key: fs.readFileSync(key), cert: fs.readFileSync(cert) }, app);
hub.attach(server);

let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  hub.close();
  server.close();
  try { await deleteTenants(risto, sagra); } catch (err) { console.error('Pulizia dei locali di prova non riuscita', err.message); }
  await closePools();
  fs.rmSync(certDir, { recursive: true, force: true });
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

server.listen(port, '127.0.0.1', () => console.log(`E2E_READY https://127.0.0.1:${port}`));
