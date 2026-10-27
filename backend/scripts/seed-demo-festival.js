// Locale di dimostrazione «Sagra del Borgo» (slug `sagra`): una sagra completa per mostrare SmartEats Stand a un cliente e per
// provare la cassa con dati veri: carta con porzioni, tre serate passate (ordini, sconti, omaggi, storni) e la serata di oggi in corso.
//
// Uso (dalla cartella backend, con il database locale acceso):
//   npm run demo:festival            crea il locale (se esiste già, non fa nulla)
//   npm run demo:festival-reset      lo cancella e lo ricrea da zero
//
// Come `seed-demo.js` (il ristorante): usa MIGRATION_DATABASE_URL solo per creare il locale e spostare indietro gli orari dei dati
// delle serate passate; tutto il resto passa dalle API vere. Solo su un dominio locale.
import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import { prepareDemoEnvironment, createRandom, dayString, italianDate, startDemoApp, createClient, deleteTenantData } from './demo-support.js';

const { domain, admin } = prepareDemoEnvironment();
const { pool, masterPool } = await import('../db.js');
const { BUSINESS_TYPES } = await import('../utils/modules.js');

const SLUG = 'sagra';
const NAME = 'Sagra del Borgo';
const PASSWORD = 'smarteats-demo';
const HOST = `${SLUG}.${domain}`;
const RESET = process.argv.includes('--reset');
const { rand, pick, between } = createRandom(20261026);

// [nome, prezzo, categoria, destinazione, porzioni a ogni serata]
const COLORS = { Panini: '#f59e0b', Primi: '#ef4444', Griglia: '#b45309', Fritti: '#f97316', Contorni: '#16a34a', Dolci: '#ec4899', Bevande: '#3b82f6' };
const MENU = [
  ['Panino con porchetta', 6, 'Panini', 'kitchen', 120], ['Panino con salsiccia', 5.5, 'Panini', 'kitchen'], ['Hamburger della sagra', 7, 'Panini', 'kitchen'],
  ['Panino con cotoletta', 6.5, 'Panini', 'kitchen'], ['Panino vegetariano', 5, 'Panini', 'kitchen'],
  ['Gnocchi al ragù', 7, 'Primi', 'kitchen', 90], ['Tagliatelle al ragù', 7, 'Primi', 'kitchen'], ['Pasta alla norma', 6.5, 'Primi', 'kitchen'],
  ['Polenta e funghi', 6, 'Primi', 'kitchen'], ['Risotto alla zucca', 7, 'Primi', 'kitchen'],
  ['Costine alla griglia', 9, 'Griglia', 'kitchen', 60], ['Salsiccia e peperoni', 8, 'Griglia', 'kitchen'], ['Tagliata di manzo', 12, 'Griglia', 'kitchen', 40], ['Spiedino misto', 8.5, 'Griglia', 'kitchen'],
  ['Patatine fritte', 3.5, 'Fritti', 'kitchen'], ['Frittura di calamari', 9, 'Fritti', 'kitchen'], ['Olive ascolane', 5, 'Fritti', 'kitchen'], ['Arancini', 3, 'Fritti', 'kitchen'],
  ['Insalata mista', 3, 'Contorni', 'kitchen'], ['Verdure grigliate', 4, 'Contorni', 'kitchen'],
  ['Tiramisù', 4, 'Dolci', 'kitchen', 50], ['Crêpes alla Nutella', 4.5, 'Dolci', 'kitchen'], ['Torta della nonna', 3.5, 'Dolci', 'kitchen'],
  ['Acqua', 1, 'Bevande', 'bar'], ['Coca-Cola', 2.5, 'Bevande', 'bar'], ['Birra media', 4, 'Bevande', 'bar'], ['Birra piccola', 3, 'Bevande', 'bar'],
  ['Vino rosso (calice)', 3, 'Bevande', 'bar'], ['Caffè', 1.2, 'Bevande', 'bar'],
];
const MAINS = ['Panini', 'Primi', 'Griglia'];
const SIDES = ['Fritti', 'Contorni', 'Dolci'];

async function recreateTenant() {
  const { rows: [old] } = await admin.query('SELECT id FROM tenants WHERE slug = $1', [SLUG]);
  if (old) {
    if (!RESET) { console.log(`Il locale «${SLUG}» esiste già: non tocco nulla (usa npm run demo:festival-reset per ricrearlo).`); return false; }
    await deleteTenantData(admin, old.id);
    console.log('Locale demo precedente eliminato.');
  }
  const modules = [...BUSINESS_TYPES.street_food.modules, 'takeaway', 'inventory'];
  const { rows: [tenant] } = await admin.query(
    `INSERT INTO tenants (slug, name, plan, business_type, modules, inventory_mode, inventory_depletion) VALUES ($1, $2, 'demo', 'street_food', $3, 'portions', 'simple') RETURNING id`, [SLUG, NAME, modules]);
  const hash = await bcrypt.hash(PASSWORD, 12);
  for (const [username, role] of [['sagra', 'admin'], ['cassa1', 'cashier'], ['cassa2', 'cashier'], ['cucina', 'kitchen']])
    await admin.query('INSERT INTO users (username, password_hash, role, tenant_id, must_change_password) VALUES ($1, $2, $3, $4, false)', [username, hash, role, tenant.id]);
  return tenant.id;
}

async function createMenu(api) {
  const products = {};
  for (const [name, price, category, destination, portions] of MENU) {
    const body = { name, price, category, color: COLORS[category], print_destination: destination, visible: true };
    if (portions) Object.assign(body, { portions_reset_rule: 'restart_each_service', portions_start: portions });
    const created = await api.post('/products', body);
    products[name] = { id: created.id, name, price, category };
  }
  return products;
}

// Un ordine credibile: un piatto principale (a volte due), qualcosa di fritto o dolce, una o due bevande.
function randomLines(products) {
  const byCategory = (category) => Object.values(products).filter(p => p.category === category);
  const lines = [];
  const add = (product, quantity = 1) => lines.push({ id: product.id, name: product.name, quantity, note: rand() < 0.07 ? pick(['SENZA CIPOLLA', 'BEN COTTO', 'SENZA SALSA']) : '' });
  add(pick(byCategory(pick(MAINS))), pick([1, 1, 1, 2]));
  if (rand() < 0.4) add(pick(byCategory(pick(MAINS))));
  if (rand() < 0.55) add(pick(byCategory(pick(SIDES))));
  add(pick(byCategory('Bevande')), pick([1, 1, 2]));
  return lines;
}

// Orari della serata: più ordini verso le 20:00–21:30 che all'inizio e alla fine.
const eveningMinutes = (count) => Array.from({ length: count }, () => Math.round((rand() + rand() + rand()) / 3 * 270)).sort((a, b) => a - b);

async function pairDevices(cashierApis) {
  const devices = [];
  for (const [index, api] of cashierApis.entries()) devices.push({ api, ...(await api.post('/devices', { name: `Cassa ${index + 1}` })), seq: 0 });
  return devices;
}

// Batte `count` ordini: li alterna tra le casse, qualcuno al banco del responsabile con sconto o omaggio, qualcuno da asporto.
async function takeOrders(devices, products, boss, count) {
  const ids = [];
  devices.forEach(d => { d.seq = 0; });
  for (let i = 0; i < count; i += 1) {
    const device = devices[i % devices.length];
    device.seq += 1;
    const lines = randomLines(products);
    if (i % 9 === 4) Object.assign(lines[0], { type: 'discount', discountMode: 'percent', discountValue: 10 });
    if (i === 11) Object.assign(lines[lines.length - 1], { type: 'gift' });
    const sender = i % 9 === 4 || i === 11 ? boss : device.api;
    const order = await sender.post('/orders', { items: lines, is_takeaway: rand() < 0.15, client_order_id: randomUUID(), device_id: device.id, device_seq: device.seq });
    ids.push(order.orderId);
  }
  return ids;
}

// Sposta indietro gli orari di una serata e dei suoi ordini (che nascono "adesso") e li dà per completati.
async function backdate(sessionId, orderIds, startsAt, minutes) {
  const at = (m) => new Date(startsAt.getTime() + m * 60000);
  for (const [index, orderId] of orderIds.entries()) {
    const created = at(minutes[index]);
    await admin.query(`UPDATE orders SET created_at = $1, completed_at = CASE WHEN status = 'completed' THEN $2::timestamptz END WHERE id = $3`, [created, new Date(created.getTime() + between(4, 14) * 60000), orderId]);
  }
}

async function pastEvening(devices, products, boss, kitchen, dayOffset) {
  const day = dayString(dayOffset);
  const weekday = new Intl.DateTimeFormat('it-IT', { weekday: 'long', timeZone: 'Europe/Rome' }).format(new Date(`${day}T12:00:00Z`));
  await boss.post('/sessions/start', { name: `Serata ${weekday} ${italianDate(day).slice(0, 5)}` });
  const session = await boss.get('/sessions/latest');
  const count = between(70, 96);
  const ids = await takeOrders(devices, products, boss, count);
  for (const id of ids.slice(-3)) await boss.put(`/orders/${id}`, { status: 'canceled' });          // qualche storno
  for (const id of ids.slice(0, -3)) await kitchen.put(`/orders/${id}`, { status: 'completed' });
  await boss.post('/sessions/end', { declaredCash: null, openOrders: 'leave' });
  const startsAt = new Date(`${day}T17:00:00Z`);
  await admin.query('UPDATE sessions SET start_time = $1, end_time = $2 WHERE id = $3', [new Date(startsAt.getTime() - 20 * 60000), new Date(startsAt.getTime() + 310 * 60000), session.id]);
  await backdate(session.id, ids, startsAt, eveningMinutes(ids.length));
}

// Il servizio di oggi: iniziato da due ore, alcuni ordini consegnati, altri in preparazione, gli ultimi appena arrivati.
async function liveEvening(devices, products, boss, kitchen) {
  await boss.post('/sessions/start', { name: `Serata ${italianDate(dayString(0)).slice(0, 5)}` });
  const session = await boss.get('/sessions/latest');
  const ids = await takeOrders(devices, products, boss, 26);
  const waiting = 4, cooking = 3;
  for (const id of ids.slice(0, ids.length - waiting - cooking)) await kitchen.put(`/orders/${id}`, { status: 'completed' });
  for (const id of ids.slice(ids.length - waiting - cooking, ids.length - waiting)) await kitchen.put(`/orders/${id}`, { status: 'preparing' });
  const startsAt = new Date(Date.now() - 120 * 60000);
  await admin.query('UPDATE sessions SET start_time = $1 WHERE id = $2', [startsAt, session.id]);
  const minutes = ids.map((_, i) => Math.round(8 + (i / ids.length) * 104));                         // fino a 8 minuti fa
  for (const [index, id] of ids.entries()) {
    const created = new Date(startsAt.getTime() + minutes[index] * 60000);
    await admin.query(`UPDATE orders SET created_at = $1, completed_at = CASE WHEN status = 'completed' THEN $1::timestamptz + interval '9 minutes' END WHERE id = $2`, [created, id]);
  }
}

async function main() {
  const tenantId = await recreateTenant();
  if (!tenantId) return;
  const app = await startDemoApp();
  try {
    const login = async (username) => { const api = createClient(app.port, HOST, PASSWORD); await api.login(username); return api; };
    const boss = await login('sagra');
    const kitchen = await login('cucina');
    const products = await createMenu(boss);
    const devices = await pairDevices([await login('cassa1'), await login('cassa2')]);

    console.log('Carta e casse pronte. Creo le serate passate...');
    for (const dayOffset of [-10, -9, -8]) await pastEvening(devices, products, boss, kitchen, dayOffset);
    console.log('Serata di oggi...');
    await liveEvening(devices, products, boss, kitchen);
  } finally {
    app.close();
    await Promise.all([admin.end(), pool.end(), masterPool.end()]);
  }
  console.log(`\n✅ Locale demo pronto: https://${HOST}:5173  (porta 3000 per il solo backend)`);
  console.log(`   Utenti (password «${PASSWORD}»): sagra (admin), cassa1 e cassa2 (casse), cucina (cucina)`);
  console.log(`   Menu pubblico con QR: https://${HOST}:5173/menu`);
}

main().catch(async (err) => {
  console.error(`\n❌ ${err.message}`);
  await Promise.allSettled([admin.end(), pool.end(), masterPool.end()]);
  process.exit(1);
});
