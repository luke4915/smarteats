// Locale di dimostrazione «Trattoria SmartEats» (slug `demo`): un ristorante completo per mostrare l'app a un cliente.
//
// Uso (dalla cartella backend, con il database locale acceso):
//   npm run demo:seed            crea il locale (se esiste già, non fa nulla)
//   npm run demo:seed -- --reset lo cancella e lo ricrea da zero
//
// Usa MIGRATION_DATABASE_URL (utente privilegiato) solo per creare il locale e spostare indietro gli orari dei dati
// di una serata passata; tutto il resto passa dalle API vere (stessi controlli, stessi prezzi, stesso stock), con
// l'app avviata in memoria. Il locale si apre su https://demo.<APP_DOMAIN>:5173, utenti e password sono stampati alla fine.
// Parte solo su un dominio locale (APP_DOMAIN che finisce in .local o localhost): è un dato di prova, non va su un server vero.
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcrypt';

const here = path.dirname(fileURLToPath(import.meta.url));
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

const { createApp } = await import('../app.js');
const { createWebSocketHub } = await import('../ws.js');
const { pool, masterPool } = await import('../db.js');
const { BUSINESS_TYPES } = await import('../utils/modules.js');

const SLUG = 'demo';
const NAME = 'Trattoria SmartEats';
const PASSWORD = 'smarteats-demo';
const DOMAIN = process.env.APP_DOMAIN || 'smarteats.local';
const HOST = `${SLUG}.${DOMAIN}`;
const RESET = process.argv.includes('--reset');

const admin = new pg.Pool({ connectionString: process.env.MIGRATION_DATABASE_URL, max: 2 });

const TENANT_TABLES = ['whatsapp_messages', 'app_feedback', 'takeaway_orders', 'takeaway_hours', 'reservation_tables', 'reservations', 'booking_closures', 'booking_shifts', 'audit_logs', 'payment_items', 'order_items', 'orders', 'payments', 'checks', 'dining_tables', 'room_elements', 'rooms', 'devices', 'product_modifier_groups', 'modifiers', 'modifier_groups', 'products', 'courses', 'sessions', 'print_settings', 'copy_types', 'settings', 'users'];

// ── Generatore pseudo-casuale con seme fisso: il locale demo è sempre uguale ──
let seed = 20261016;
const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pick = (list) => list[Math.floor(rand() * list.length)];
const between = (a, b) => a + Math.floor(rand() * (b - a + 1));

// ── Date nel fuso del locale ──
const TZ = 'Europe/Rome';
const dayString = (offsetDays = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(Date.now() + offsetDays * 86400000));
const weekdayOf = (ymd) => new Date(`${ymd}T12:00:00Z`).getUTCDay();   // 0 = domenica, come i turni
const minutesAgo = (m) => new Date(Date.now() - m * 60000);

// ── Client HTTP verso l'app in memoria ──
let port;
function client(host = HOST) {
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
        try { parsed = raw ? JSON.parse(raw) : null; } catch { /* non JSON */ }
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
    get: (p) => request('GET', p), post: (p, b) => request('POST', p, b ?? {}), put: (p, b) => request('PUT', p, b),
    patch: (p, b) => request('PATCH', p, b),
    login: (username) => request('POST', '/auth/login', { username, password: PASSWORD }),
  };
}

// ── Locale e utenti ──
async function recreateTenant() {
  const { rows: [old] } = await admin.query('SELECT id FROM tenants WHERE slug = $1', [SLUG]);
  if (old) {
    if (!RESET) {
      console.log(`Il locale «${SLUG}» esiste già: non tocco nulla (usa -- --reset per ricrearlo).`);
      return false;
    }
    for (const table of TENANT_TABLES) await admin.query(`DELETE FROM ${table} WHERE tenant_id = $1`, [old.id]);
    await admin.query('DELETE FROM tenants WHERE id = $1', [old.id]);
    console.log('Locale demo precedente eliminato.');
  }
  const modules = [...BUSINESS_TYPES.restaurant.modules, 'bookings', 'takeaway', 'whatsapp'];
  const { rows: [tenant] } = await admin.query(
    `INSERT INTO tenants (slug, name, plan, business_type, modules) VALUES ($1, $2, 'demo', 'restaurant', $3) RETURNING id`, [SLUG, NAME, modules]);
  const hash = await bcrypt.hash(PASSWORD, 12);
  for (const [username, role] of [['demo', 'admin'], ['marta', 'manager'], ['luca', 'cashier'], ['giulia', 'waiter'], ['paolo', 'waiter'], ['chef', 'kitchen']])
    await admin.query('INSERT INTO users (username, password_hash, role, tenant_id, must_change_password) VALUES ($1, $2, $3, $4, false)', [username, hash, role, tenant.id]);
  return tenant.id;
}

// ── Carta ──
const COLORS = { Antipasti: '#f59e0b', Pizze: '#ef4444', Primi: '#f97316', Secondi: '#b45309', Contorni: '#16a34a', Dolci: '#ec4899', Bevande: '#3b82f6', Caffè: '#78350f' };
const MENU = [
  // [nome, prezzo, categoria, portata, destinazione, carico forno]
  ['Bruschetta al pomodoro', 6, 'Antipasti', 'Antipasti', 'kitchen'],
  ['Tagliere di salumi e formaggi', 14, 'Antipasti', 'Antipasti', 'kitchen'],
  ['Carpaccio di manzo', 13, 'Antipasti', 'Antipasti', 'kitchen'],
  ['Burrata e pomodorini', 10, 'Antipasti', 'Antipasti', 'kitchen'],
  ['Margherita', 7, 'Pizze', 'Primi', 'kitchen', 1],
  ['Diavola', 9, 'Pizze', 'Primi', 'kitchen', 1],
  ['Quattro formaggi', 10, 'Pizze', 'Primi', 'kitchen', 1],
  ['Capricciosa', 10, 'Pizze', 'Primi', 'kitchen', 1],
  ['Bufalina', 11, 'Pizze', 'Primi', 'kitchen', 1],
  ['Spaghetti alle vongole', 15, 'Primi', 'Primi', 'kitchen'],
  ['Tagliatelle al ragù', 12, 'Primi', 'Primi', 'kitchen'],
  ['Risotto ai funghi porcini', 13, 'Primi', 'Primi', 'kitchen'],
  ['Gnocchi al gorgonzola', 12, 'Primi', 'Primi', 'kitchen'],
  ['Tagliata di manzo', 19, 'Secondi', 'Secondi', 'kitchen'],
  ['Frittura di paranza', 17, 'Secondi', 'Secondi', 'kitchen'],
  ['Cotoletta alla milanese', 16, 'Secondi', 'Secondi', 'kitchen'],
  ['Patate al forno', 5, 'Contorni', 'Contorni', 'kitchen'],
  ['Insalata mista', 5, 'Contorni', 'Contorni', 'kitchen'],
  ['Verdure grigliate', 6, 'Contorni', 'Contorni', 'kitchen'],
  ['Tiramisù', 6, 'Dolci', 'Dolci', 'kitchen'],
  ['Panna cotta ai frutti di bosco', 5.5, 'Dolci', 'Dolci', 'kitchen'],
  ['Sorbetto al limone', 4, 'Dolci', 'Dolci', 'kitchen'],
  ['Acqua naturale', 2, 'Bevande', null, 'bar'],
  ['Acqua frizzante', 2, 'Bevande', null, 'bar'],
  ['Coca-Cola', 3.5, 'Bevande', null, 'bar'],
  ['Birra media', 5, 'Bevande', null, 'bar'],
  ['Vino della casa (caraffa)', 12, 'Bevande', null, 'bar'],
  ['Calice di Vermentino', 5.5, 'Bevande', null, 'bar'],
  ['Caffè', 1.5, 'Caffè', null, 'bar'],
  ['Amaro', 4, 'Caffè', null, 'bar'],
];

async function configure(api) {
  const s = (key, value) => api.put(`/settings/${key}`, { value });
  await s('welcome_message', 'Benvenuti alla Trattoria SmartEats');
  await s('cover_charge', '2');
  await s('booking_portal_enabled', '1');
  await s('booking_portal_phone', '+39 06 1234 5678');
  await s('booking_portal_welcome', 'Prenota il tuo tavolo: ti rispondiamo entro poche ore.');
  await s('takeaway_portal_enabled', '1');
  await s('takeaway_slot_minutes', '15');
  await s('takeaway_slot_capacity', '12');
  await s('takeaway_min_lead_minutes', '20');
  await s('takeaway_phone', '+39 06 1234 5678');
  await s('takeaway_welcome', 'Pizze e piatti da portare via: scegli l\'orario e passa a ritirare.');

  // Portate: l'ordine di uscita; i contorni escono insieme ai secondi
  const courses = {};
  for (const [name, withPrevious] of [['Antipasti', false], ['Primi', false], ['Secondi', false], ['Contorni', true], ['Dolci', false]])
    courses[name] = (await api.post('/courses', { name, with_previous: withPrevious })).id;

  // Sale e pianta
  const sala = await api.post('/rooms', { name: 'Sala interna' });
  const dehors = await api.post('/rooms', { name: 'Dehors' });
  const mk = async (room, name, seats) => (await api.post(`/rooms/${room.id}/tables`, { name, seats })).id;
  const tables = {};
  for (const [name, seats] of [['T1', 2], ['T2', 4], ['T3', 2], ['T4', 6], ['T5', 4], ['T6', 4], ['T7', 8], ['T8', 2]]) tables[name] = await mk(sala, name, seats);
  for (const [name, seats] of [['D1', 4], ['D2', 4], ['D3', 2], ['D4', 6]]) tables[name] = await mk(dehors, name, seats);
  await api.put(`/rooms/${sala.id}/layout`, {
    grid_w: 20, grid_h: 12,
    tables: [
      ['T1', 1, 1, 2, 2, 'round'], ['T2', 5, 1, 3, 2, 'rect'], ['T3', 10, 1, 2, 2, 'round'], ['T4', 14, 1, 4, 2, 'rect'],
      ['T5', 1, 6, 3, 2, 'rect'], ['T6', 6, 6, 3, 2, 'rect'], ['T7', 11, 6, 6, 3, 'rect'], ['T8', 1, 10, 2, 2, 'round'],
    ].map(([n, x, y, w, h, shape]) => ({ id: tables[n], x, y, w, h, shape })),
    elements: [{ kind: 'wall', x: 0, y: 4, w: 4, h: 1 }, { kind: 'divider', x: 9, y: 4, w: 1, h: 6 }, { kind: 'wall', x: 18, y: 10, w: 2, h: 1 }],
  });
  await api.put(`/rooms/${dehors.id}/layout`, {
    grid_w: 14, grid_h: 8,
    tables: [['D1', 1, 1, 3, 2, 'rect'], ['D2', 6, 1, 3, 2, 'rect'], ['D3', 11, 1, 2, 2, 'round'], ['D4', 3, 5, 5, 2, 'rect']]
      .map(([n, x, y, w, h, shape]) => ({ id: tables[n], x, y, w, h, shape })),
  });

  // Prodotti
  const products = {};
  for (const [name, price, category, course, destination, load] of MENU) {
    const p = await api.post('/products', {
      name, price, category, color: COLORS[category], print_destination: destination,
      course_id: course ? courses[course] : null, ...(load && { takeaway_load: load }),
    });
    products[name] = p.id;
  }

  // Opzioni
  const cottura = await api.post('/modifier-groups', { name: 'Cottura', min_select: 1, max_select: 1, options: [{ name: 'Al sangue' }, { name: 'Media' }, { name: 'Ben cotta' }] });
  const aggiunte = await api.post('/modifier-groups', { name: 'Aggiunte', min_select: 0, max_select: null, options: [
    { name: 'Bufala', price_delta: 2.5 }, { name: 'Prosciutto crudo', price_delta: 2 }, { name: 'Funghi', price_delta: 1.5 }, { name: 'Senza lattosio', price_delta: 0 }] });
  const salsa = await api.post('/modifier-groups', { name: 'Condimento', min_select: 0, max_select: 1, options: [{ name: 'Senza glutine', price_delta: 1.5 }, { name: 'In bianco' }] });
  await api.put(`/products/${products['Tagliata di manzo']}/modifier-groups`, { group_ids: [cottura.id] });
  for (const n of ['Margherita', 'Diavola', 'Quattro formaggi', 'Capricciosa', 'Bufalina']) await api.put(`/products/${products[n]}/modifier-groups`, { group_ids: [aggiunte.id] });
  for (const n of ['Spaghetti alle vongole', 'Tagliatelle al ragù', 'Gnocchi al gorgonzola']) await api.put(`/products/${products[n]}/modifier-groups`, { group_ids: [salsa.id] });

  // Asporto: orari
  const hours = [];
  for (let weekday = 0; weekday < 7; weekday += 1) hours.push({ weekday, open_time: '12:00', close_time: '14:30' }, { weekday, open_time: '18:30', close_time: '22:30' });
  await api.put('/takeaway/hours', { hours });

  // Prenotazioni: turni e una chiusura per ferie
  const shifts = {};
  const all = [0, 1, 2, 3, 4, 5, 6];
  shifts.lunch = (await api.post('/bookings/shifts', { name: 'Pranzo', start_time: '12:30', duration_minutes: 90, weekdays: [0, 6], capacity: 40 })).id;
  shifts.dinner1 = (await api.post('/bookings/shifts', { name: 'Cena primo turno', start_time: '19:30', duration_minutes: 90, weekdays: all, capacity: 36 })).id;
  shifts.dinner2 = (await api.post('/bookings/shifts', { name: 'Cena secondo turno', start_time: '21:15', duration_minutes: 90, weekdays: all, capacity: 28 })).id;
  await api.post('/bookings/closures', { date_from: dayString(40), date_to: dayString(47), shift_id: null, reason: 'Chiusura per ferie' });

  return { courses, tables, products, shifts };
}

// ── Una comanda a portate: raggruppa i piatti per portata, nell'ordine di uscita ──
const COURSE_ORDER = ['Antipasti', 'Primi', 'Secondi', 'Contorni', 'Dolci'];
const productCourse = Object.fromEntries(MENU.map(m => [m[0], m[3]]));
function groupsFor(ctx, lines) {
  // lines: [nome, quantità, nota?, opzioni?]
  const groups = [];
  let seq = 0;
  for (const course of COURSE_ORDER) {
    const inCourse = lines.filter(l => productCourse[l[0]] === course);
    if (!inCourse.length) continue;
    seq += course === 'Contorni' && groups.length ? 0 : 1;
    const items = inCourse.map(([name, quantity, note = '', modifiers = []]) => ({ id: ctx.products[name], name, quantity, note, modifiers }));
    const previous = groups[groups.length - 1];
    if (course === 'Contorni' && previous) { previous.items.push(...items); continue; }
    groups.push({ course_id: ctx.courses[course], seq, items });
  }
  // le bevande non hanno portata: escono con la prima
  const drinks = lines.filter(l => !productCourse[l[0]]).map(([name, quantity, note = '']) => ({ id: ctx.products[name], name, quantity, note, modifiers: [] }));
  if (drinks.length) {
    if (groups.length) groups[0].items.push(...drinks);
    else groups.push({ course_id: null, seq: 1, items: drinks });
  }
  return groups.map(g => ({ ...g, client_order_id: crypto.randomUUID() }));
}

const send = async (api, ctx, checkId, lines, { fireFirst = true } = {}) =>
  api.post(`/checks/${checkId}/courses`, { groups: groupsFor(ctx, lines), fire_first: fireFirst });

async function fireAll(api, checkId) {
  for (let i = 0; i < 6; i += 1) {
    try { await api.post(`/checks/${checkId}/fire`, {}); } catch (err) { if (err.status === 409 || err.status === 404) break; throw err; }
  }
}

// Una serata di conti pagati, con sconti, un omaggio e pagamenti divisi
const SERVICE_DISHES = {
  starters: ['Bruschetta al pomodoro', 'Tagliere di salumi e formaggi', 'Carpaccio di manzo', 'Burrata e pomodorini'],
  firsts: ['Margherita', 'Diavola', 'Quattro formaggi', 'Capricciosa', 'Bufalina', 'Spaghetti alle vongole', 'Tagliatelle al ragù', 'Risotto ai funghi porcini', 'Gnocchi al gorgonzola'],
  mains: ['Tagliata di manzo', 'Frittura di paranza', 'Cotoletta alla milanese'],
  sides: ['Patate al forno', 'Insalata mista', 'Verdure grigliate'],
  desserts: ['Tiramisù', 'Panna cotta ai frutti di bosco', 'Sorbetto al limone'],
  drinks: ['Acqua naturale', 'Acqua frizzante', 'Coca-Cola', 'Birra media', 'Vino della casa (caraffa)', 'Calice di Vermentino'],
};
function randomLines(ctx, covers) {
  const lines = [];
  const add = (name, quantity, note, modifiers) => lines.push([name, quantity, note, modifiers]);
  if (rand() < 0.7) add(pick(SERVICE_DISHES.starters), between(1, Math.max(1, Math.ceil(covers / 2))));
  for (let i = 0; i < covers; i += 1) {
    const dish = pick(SERVICE_DISHES.firsts);
    const existing = lines.find(l => l[0] === dish && !l[2] && !l[3]?.length);
    if (existing) existing[1] += 1; else add(dish, 1);
  }
  if (rand() < 0.55) add('Tagliata di manzo', between(1, 2), '', [ctx.cooking[pick(['Al sangue', 'Media', 'Ben cotta'])]]);
  else if (rand() < 0.5) add(pick(SERVICE_DISHES.mains.slice(1)), between(1, 2));
  if (rand() < 0.5) add(pick(SERVICE_DISHES.sides), 1);
  if (rand() < 0.6) add(pick(SERVICE_DISHES.desserts), between(1, covers));
  add(pick(SERVICE_DISHES.drinks.slice(0, 2)), Math.ceil(covers / 2));
  add(pick(SERVICE_DISHES.drinks.slice(2)), between(1, covers));
  if (rand() < 0.7) add('Caffè', between(1, covers));
  return lines;
}

async function payOff(api, checkId, { method, split = false }) {
  const check = await api.get(`/checks/${checkId}`);
  const due = check.due ?? check.total - check.paid;
  if (split && due > 10) {
    const first = Math.round(due * 50) / 100;
    await api.post(`/checks/${checkId}/payments`, { method: 'cash', amount: first });
    await api.post(`/checks/${checkId}/payments`, { method, amount: +(due - first).toFixed(2) });
  } else await api.post(`/checks/${checkId}/payments`, { method, amount: due });
}

async function firstLineIds(checkId, count = 1) {
  const { rows } = await admin.query(
    `SELECT oi.id FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.check_id = $1 AND o.order_type <> 'cover' AND oi.line_type = 'sale' ORDER BY oi.line_total DESC LIMIT $2`, [checkId, count]);
  return rows.map(r => r.id);
}

// Sposta indietro nel tempo i dati di una serata già chiusa, con orari credibili
async function backdate(sessionId, checkIds, dayOffset, startHourUtc = 16) {
  const base = new Date(`${dayString(dayOffset)}T${String(startHourUtc).padStart(2, '0')}:00:00Z`);
  const at = (minutes) => new Date(base.getTime() + minutes * 60000);
  await admin.query('UPDATE sessions SET start_time = $1, end_time = $2 WHERE id = $3', [at(-30), at(330), sessionId]);
  let i = 0;
  for (const checkId of checkIds) {
    const open = at(i * 11 + between(0, 6));
    const close = new Date(open.getTime() + between(55, 105) * 60000);
    await admin.query('UPDATE checks SET opened_at = $1, closed_at = $2 WHERE id = $3', [open, close, checkId]);
    await admin.query('UPDATE payments SET paid_at = $1 WHERE check_id = $2', [close, checkId]);
    const { rows: orders } = await admin.query(`SELECT id, course_seq FROM orders WHERE check_id = $1 ORDER BY id`, [checkId]);
    for (const o of orders) {
      const fired = new Date(open.getTime() + (3 + Math.max(0, (o.course_seq ?? 1) - 1) * between(16, 24)) * 60000);
      const ready = new Date(fired.getTime() + between(7, 19) * 60000);
      await admin.query(`UPDATE orders SET created_at = $1, fired_at = $1, completed_at = $2, status = 'completed' WHERE id = $3`, [fired, ready, o.id]);
      await admin.query(`UPDATE order_items SET prep_status = 'ready', ready_at = $1 WHERE order_id = $2`, [ready, o.id]);
    }
    i += 1;
  }
}

async function pastService(api, ctx, dayOffset, name, checks) {
  await api.post('/sessions/start', { name });
  const tableNames = Object.keys(ctx.tables);
  const done = [];
  for (let i = 0; i < checks; i += 1) {
    const covers = pick([2, 2, 2, 3, 4, 4, 5, 6]);
    const seats = covers <= 2 ? ['T1', 'T3', 'T8', 'D3'] : covers <= 4 ? ['T2', 'T5', 'T6', 'D1', 'D2'] : ['T4', 'T7', 'D4'];
    const check = await api.post('/checks', { table_id: ctx.tables[pick(seats)], covers });
    await send(api, ctx, check.id, randomLines(ctx, covers));
    await fireAll(api, check.id);
    if (i % 5 === 3) {
      const ids = await firstLineIds(check.id, 1);
      await api.post(`/checks/${check.id}/adjust`, { order_item_ids: ids, type: 'discount', discountMode: 'percent', discountValue: 10 });
    }
    if (i === 6) await api.post(`/checks/${check.id}/adjust`, { order_item_ids: await firstLineIds(check.id, 1), type: 'gift' });
    await payOff(api, check.id, { method: pick(['card', 'card', 'cash', 'cash', 'other']), split: i % 4 === 1 });
    done.push(check.id);
  }
  const session = await api.get('/sessions/latest');
  await api.post('/sessions/end', { declaredCash: null });
  await backdate(session.id, done, dayOffset);
  void tableNames;
}

// ── Il servizio di oggi: tavoli in momenti diversi ──
async function liveService(api, kitchen, ctx) {
  await api.post('/sessions/start', { name: `Servizio ${dayString(0).split('-').reverse().join('/')}` });
  const today = dayString(0);
  const live = [];

  // Prenotazioni di oggi (turno 19:30 e 21:15) e dei prossimi giorni
  const mkRes = (date, shift, party, name, phone, tableIds = [], notes = '') =>
    api.post('/bookings/reservations', { date, shift_id: shift, party_size: party, customer_name: name, phone, notes, table_ids: tableIds.map(t => ctx.tables[t]) });
  const rossi = await mkRes(today, ctx.shifts.dinner1, 4, 'Famiglia Rossi', '3331234501', ['T2'], 'Un seggiolone');
  await mkRes(today, ctx.shifts.dinner1, 2, 'Anna Bianchi', '3331234502', ['T1'], 'Anniversario: un dolce con la candelina');
  await mkRes(today, ctx.shifts.dinner2, 8, 'Compleanno Verdi', '3331234503', ['T7'], 'Torta portata da loro');
  await mkRes(today, ctx.shifts.dinner2, 3, 'Marco Conti', '3331234504', ['T5']);
  await mkRes(dayString(1), ctx.shifts.dinner2, 5, 'Giulia Ferrari', '3331234505', ['T4'], 'Allergia alle noci');
  await mkRes(dayString(2), ctx.shifts.dinner1, 2, 'Paolo Gallo', '3331234506', ['T3']);
  const sat = [3, 4, 5, 6, 7, 8, 9].map(d => dayString(d)).find(d => [0, 6].includes(weekdayOf(d)));
  if (sat) await mkRes(sat, ctx.shifts.lunch, 6, 'Pranzo aziendale Neri', '3331234507', ['T4']);

  // Richieste dal sito (da confermare) e un annullo chiesto dal cliente
  const portal = client();
  const request = (date, shift, party, name, phone, extra = {}) => portal.post('/public/booking/requests', {
    date, shift_id: shift, party_size: party, customer_name: name, phone, email: '', notes: extra.notes ?? '', consent: true, marketing: extra.marketing ?? false, website: '', opened_at: Date.now() - 20000,
  });
  await request(dayString(1), ctx.shifts.dinner1, 4, 'Elena De Luca', '3331234511', { notes: 'Possibile vicino alla finestra?', marketing: true });
  await request(dayString(2), ctx.shifts.dinner2, 2, 'Davide Moretti', '3331234512');
  await request(dayString(3), ctx.shifts.dinner1, 6, 'Famiglia Esposito', '3331234513', { notes: 'Con due bambini' });
  const toCancel = await request(dayString(3), ctx.shifts.dinner2, 2, 'Sara Greco', '3331234514');
  const { rows: [pending] } = await admin.query(`SELECT id FROM reservations WHERE public_token = $1`, [toCancel.token]);
  await api.post(`/bookings/reservations/${pending.id}/confirm`, {});
  await portal.post(`/public/booking/requests/${toCancel.token}/cancel`, {});

  // Tavoli: arriva la famiglia Rossi (apre il conto dalla prenotazione)
  const arrived = await api.post(`/bookings/reservations/${rossi.id}/arrived`, {});
  const checkRossi = arrived.check.id;
  const second = await send(api, ctx, checkRossi, [
    ['Tagliere di salumi e formaggi', 1], ['Bruschetta al pomodoro', 2], ['Margherita', 2], ['Tagliatelle al ragù', 1], ['Gnocchi al gorgonzola', 1, 'senza noci'],
    ['Cotoletta alla milanese', 2], ['Patate al forno', 1], ['Tiramisù', 2], ['Acqua naturale', 2], ['Birra media', 2], ['Vino della casa (caraffa)', 1]]);
  live.push({ id: checkRossi, kind: 'rossi', orders: second.orders });

  // T5: appena ordinato antipasti (in cucina da pochi minuti), poi i primi
  const t5 = await api.post('/checks', { table_id: ctx.tables.T5, covers: 3 });
  const t5s = await send(api, ctx, t5.id, [['Burrata e pomodorini', 2], ['Carpaccio di manzo', 1], ['Spaghetti alle vongole', 2], ['Risotto ai funghi porcini', 1], ['Tagliata di manzo', 1, '', [ctx.cooking['Media']]], ['Vino della casa (caraffa)', 1], ['Acqua frizzante', 2]]);
  live.push({ id: t5.id, kind: 'new', orders: t5s.orders });

  // T6: tutto servito, ha chiesto il conto
  const t6 = await api.post('/checks', { table_id: ctx.tables.T6, covers: 4 });
  await send(api, ctx, t6.id, [['Margherita', 2], ['Diavola', 1, '', [ctx.extras['Funghi']]], ['Quattro formaggi', 1], ['Birra media', 4], ['Tiramisù', 2], ['Caffè', 4]]);
  await fireAll(api, t6.id);
  await api.post(`/checks/${t6.id}/bill-request`, { requested: true });
  live.push({ id: t6.id, kind: 'bill' });

  // D2: dehors, un pagamento già fatto (alla romana a metà)
  const d2 = await api.post('/checks', { table_id: ctx.tables.D2, covers: 2 });
  await send(api, ctx, d2.id, [['Capricciosa', 1, '', [ctx.extras['Bufala']]], ['Bufalina', 1], ['Coca-Cola', 2], ['Panna cotta ai frutti di bosco', 1]]);
  await fireAll(api, d2.id);
  const items = await firstLineIds(d2.id, 1);
  await api.post(`/checks/${d2.id}/payments`, { method: 'cash', items: [{ order_item_id: items[0], quantity: 1 }] });
  live.push({ id: d2.id, kind: 'partial' });

  // D3: appena seduti, ancora nessuna comanda
  const d3 = await api.post('/checks', { table_id: ctx.tables.D3, covers: 2 });
  live.push({ id: d3.id, kind: 'empty' });

  // Conti già chiusi in questo servizio (per le statistiche di oggi)
  const paidToday = [];
  for (let i = 0; i < 4; i += 1) {
    const covers = pick([2, 2, 3, 4]);
    const seats = covers <= 2 ? ['T3', 'T8', 'D3'] : ['T2', 'D1', 'D4'];
    const table = ctx.tables[pick(seats.filter(t => !['T1', 'T2', 'T3', 'D3'].includes(t) || i < 2))];
    try {
      const c = await api.post('/checks', { table_id: table, covers });
      await send(api, ctx, c.id, randomLines(ctx, covers));
      await fireAll(api, c.id);
      await payOff(api, c.id, { method: pick(['card', 'cash']), split: i === 2 });
      paidToday.push(c.id);
    } catch (err) { if (err.code !== 'TABLE_BUSY') throw err; }
  }

  // Cucina: i conti che dovevano essere pronti
  const lineStatus = (orderId, status) => kitchen.put(`/orders/${orderId}/lines`, { status });
  // Rossi: antipasti e bevande già pronti, i primi in preparazione da qualche minuto, secondi da mandare
  const rossiOrders = (await admin.query(`SELECT id, course_name, status FROM orders WHERE check_id = $1 AND order_type <> 'cover' ORDER BY id`, [checkRossi])).rows;
  for (const o of rossiOrders) if (o.status !== 'scheduled' && o.course_name === 'Antipasti') await lineStatus(o.id, 'ready');
  await api.post(`/checks/${checkRossi}/fire`, {});    // escono i primi
  // T5: antipasti appena arrivati in cucina (restano «nuovi»)

  // Orari credibili per il servizio di oggi
  await admin.query(`UPDATE sessions SET start_time = $1 WHERE end_time IS NULL AND start_time >= $2`, [minutesAgo(150), minutesAgo(30)]);
  const shiftCheck = async (id, openedMinAgo, ordersMinAgo) => {
    await admin.query('UPDATE checks SET opened_at = $1 WHERE id = $2', [minutesAgo(openedMinAgo), id]);
    const { rows } = await admin.query(`SELECT id, course_seq, status FROM orders WHERE check_id = $1 AND order_type <> 'cover' ORDER BY id`, [id]);
    for (const [i, o] of rows.entries()) {
      const when = minutesAgo(Math.max(1, ordersMinAgo - i * 14));
      if (o.status === 'scheduled') continue;
      await admin.query('UPDATE orders SET created_at = $1, fired_at = $1 WHERE id = $2', [when, o.id]);
      await admin.query(`UPDATE order_items SET ready_at = CASE WHEN ready_at IS NOT NULL THEN $1::timestamptz + interval '9 minutes' END WHERE order_id = $2`, [when, o.id]);
    }
  };
  await shiftCheck(checkRossi, 52, 26);
  await shiftCheck(t5.id, 8, 5);
  await shiftCheck(t6.id, 75, 66);
  await shiftCheck(d2.id, 61, 54);
  await shiftCheck(d3.id, 2, 2);
  // Tavoli già serviti: in cucina non c'è più nulla da fare
  for (const id of [t6.id, d2.id]) {
    await admin.query(`UPDATE order_items SET prep_status = 'ready', ready_at = o.fired_at + interval '11 minutes' FROM orders o WHERE o.id = order_items.order_id AND o.check_id = $1 AND o.order_type <> 'cover'`, [id]);
    await admin.query(`UPDATE orders SET status = 'completed', completed_at = fired_at + interval '11 minutes' WHERE check_id = $1 AND order_type <> 'cover'`, [id]);
  }
  paidToday.forEach(() => {});
  await backdateToday(paidToday);
  return live;
}

// I conti già pagati di oggi: aperti tra 40 e 130 minuti fa
async function backdateToday(ids) {
  let i = 0;
  for (const id of ids) {
    const open = minutesAgo(140 - i * 22);
    const close = new Date(open.getTime() + between(50, 75) * 60000);
    await admin.query('UPDATE checks SET opened_at = $1, closed_at = $2 WHERE id = $3', [open, close, id]);
    await admin.query('UPDATE payments SET paid_at = $1 WHERE check_id = $2', [close, id]);
    const { rows: orders } = await admin.query(`SELECT id, course_seq FROM orders WHERE check_id = $1 ORDER BY id`, [id]);
    for (const o of orders) {
      const fired = new Date(open.getTime() + (3 + Math.max(0, (o.course_seq ?? 1) - 1) * 18) * 60000);
      const ready = new Date(fired.getTime() + between(8, 17) * 60000);
      await admin.query(`UPDATE orders SET created_at = $1, fired_at = $1, completed_at = $2, status = 'completed' WHERE id = $3`, [fired, ready, o.id]);
      await admin.query(`UPDATE order_items SET prep_status = 'ready', ready_at = $1 WHERE order_id = $2`, [ready, o.id]);
    }
    i += 1;
  }
}

// ── Asporto: ordini dal sito, dal banco e al telefono, in fasi diverse ──
async function takeaway(api, kitchen, ctx) {
  const today = dayString(0);
  const freeSlots = async (date) => (await api.get(`/takeaway/slots?date=${date}&load=2`)).slots.filter(s => s.available).map(s => s.time);
  let slots = await freeSlots(today);
  let date = today;
  if (slots.length < 6) { date = dayString(1); slots = await freeSlots(date); }
  const portal = client();
  const portalOrder = (time, name, phone, items) => portal.post('/public/takeaway/orders', {
    date, time, items: items.map(([n, q, note = '']) => ({ id: ctx.products[n], quantity: q, note })),
    customer_name: name, phone, email: '', notes: '', consent: true, website: '', opened_at: Date.now() - 20000,
  });
  const counter = (time, name, source, items, phone = '') => api.post('/takeaway/orders', {
    date, time, source, customer_name: name, phone, notes: '', items: items.map(([n, q, note = '']) => ({ id: ctx.products[n], quantity: q, note })),
  });
  const markReady = async (takeawayOrder) => {
    const { rows: [t] } = await admin.query('SELECT order_id FROM takeaway_orders WHERE id = $1', [takeawayOrder.id]);
    if (t?.order_id) await kitchen.put(`/orders/${t.order_id}/lines`, { status: 'ready' });
  };

  // Da confermare (arrivate dal sito)
  await portalOrder(slots[3], 'Chiara Romano', '3331234521', [['Margherita', 2], ['Diavola', 1, 'ben cotta'], ['Coca-Cola', 2]]);
  await portalOrder(slots[4], 'Luigi Fontana', '3331234522', [['Quattro formaggi', 1], ['Bufalina', 2], ['Tiramisù', 2]]);
  // Accettate, in preparazione e pronte
  const r1 = await portalOrder(slots[0], 'Franca Marino', '3331234523', [['Capricciosa', 2], ['Birra media', 2]]);
  const r2 = await portalOrder(slots[1], 'Stefano Costa', '3331234524', [['Margherita', 3], ['Tagliatelle al ragù', 1]]);
  const { rows: tos } = await admin.query(`SELECT id, public_token FROM takeaway_orders WHERE public_token = ANY($1)`, [[r1.token, r2.token]]);
  const byToken = Object.fromEntries(tos.map(t => [t.public_token, t.id]));
  const a1 = await api.post(`/takeaway/orders/${byToken[r1.token]}/accept`, {});
  await api.post(`/takeaway/orders/${byToken[r2.token]}/accept`, {});
  await markReady(a1);
  // Dal banco e al telefono (nascono già accettate)
  await counter(slots[2], 'Giorgio', 'phone', [['Diavola', 2], ['Acqua naturale', 2]], '3331234525');
  const picked = await counter(slots[0], 'Beatrice', 'counter', [['Bruschetta al pomodoro', 1], ['Margherita', 1]]);
  await markReady(picked);
  await api.post(`/takeaway/orders/${picked.id}/picked-up`, { method: 'cash' });
  // Un rifiuto
  const r3 = await portalOrder(slots[5], 'Orario sbagliato', '3331234526', [['Bufalina', 6]]).catch(() => null);
  if (r3) {
    const { rows: [t] } = await admin.query('SELECT id FROM takeaway_orders WHERE public_token = $1', [r3.token]);
    await api.post(`/takeaway/orders/${t.id}/reject`, { reason: 'Siamo al completo a quell\'ora: puoi scegliere un altro orario?' });
  }
}

async function main() {
  const tenantId = await recreateTenant();
  if (!tenantId) return;

  const hub = createWebSocketHub();
  const server = http.createServer(createApp({ broadcast: hub.broadcast, rateLimit: false }));
  hub.attach(server);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  port = server.address().port;

  try {
    const api = client();
    await api.login('demo');
    const kitchen = client();
    await kitchen.login('chef');
    const waiter = client();
    await waiter.login('giulia');
    void waiter;

    const ctx = await configure(api);
    const groups = await api.get('/modifier-groups');
    ctx.cooking = Object.fromEntries(groups.find(g => g.name === 'Cottura').options.map(o => [o.name, o.id]));
    ctx.extras = Object.fromEntries(groups.find(g => g.name === 'Aggiunte').options.map(o => [o.name, o.id]));

    console.log('Locale configurato. Creo le serate passate...');
    await pastService(api, ctx, -9, `Servizio ${dayString(-9).split('-').reverse().join('/')}`, 13);
    await pastService(api, ctx, -2, `Servizio ${dayString(-2).split('-').reverse().join('/')}`, 16);

    console.log('Servizio di oggi...');
    await liveService(api, kitchen, ctx);
    await takeaway(api, kitchen, ctx);

    // Disponibilità limitata su due dolci, per mostrare lo stock
    for (const name of ['Tiramisù', 'Panna cotta ai frutti di bosco'])
      await api.patch(`/products/${ctx.products[name]}/stock`, { stock_enabled: true, stock: 12 });
  } finally {
    hub.close();
    server.close();
    await Promise.all([admin.end(), pool.end(), masterPool.end()]);
  }

  console.log(`\n✅ Locale demo pronto: https://${HOST}:5173  (porta 3000 per il solo backend)`);
  console.log(`   Utenti (password «${PASSWORD}»): demo (admin), marta (responsabile), luca (cassa), giulia e paolo (camerieri), chef (cucina)`);
  console.log(`   Pagine dei clienti: https://${HOST}:5173/book  e  https://${HOST}:5173/order`);
}

main().catch(async (err) => {
  console.error(`\n❌ ${err.message}`);
  await Promise.allSettled([admin.end(), pool.end(), masterPool.end()]);
  process.exit(1);
});
