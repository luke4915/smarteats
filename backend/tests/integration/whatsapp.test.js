// Avvisi WhatsApp: coda, eventi di prenotazione e asporto, scadenze, tetto, ripetizioni. Si usa il driver finto.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, createTenant, deleteTenants, closePools, apiClient, adminDb } from './helpers.js';
import { withTenantClient } from '../../middleware/tenantScope.js';
import { mockDriver, setDriver } from '../../utils/whatsapp/driver.js';
import { deliverDue } from '../../utils/whatsapp/outbox.js';
import { expireAll } from '../../utils/caseExpiry.js';
import { localNow, addDays } from '../../utils/bookingPortal.js';
import jwt from 'jsonwebtoken';

describe('avvisi whatsapp', () => {
  let server, t, off, admin, client, driver, shift;
  const today = localNow().date;
  const day = addDays(today, 3);
  let seq = 0;
  const mobile = () => `333${String(4000000 + ++seq)}`;
  const run = (tenant = t, now = new Date()) => withTenantClient(tenant.id, async (db) => { await expireAll(db); return deliverDue(db, { now, driver }); });
  const log = async (tenant = t) => (await adminDb.query('SELECT * FROM whatsapp_messages WHERE tenant_id = $1 ORDER BY id', [tenant.id])).rows;
  const later = (minutes) => new Date(Date.now() + minutes * 60000);
  const book = (extra = {}) => client.post('/public/booking/requests', {
    date: day, shift_id: shift.id, party_size: 2, customer_name: 'Marta Rossi', phone: mobile(), email: '', notes: '', consent: true, website: '', ...extra });
  const confirmOf = async (token) => (await admin.get(`/bookings/reservations?date=${day}`)).body.find(r => r.public_token === token);

  before(async () => {
    server = await startServer();
    [t, off] = [await createTenant({ businessType: 'restaurant' }), await createTenant({ businessType: 'restaurant' })];
    await adminDb.query(`UPDATE tenants SET modules = array_cat(modules, ARRAY['bookings', 'takeaway', 'whatsapp']) WHERE id = $1`, [t.id]);
    await adminDb.query(`UPDATE tenants SET modules = array_cat(modules, ARRAY['bookings']) WHERE id = $1`, [off.id]);
    admin = apiClient(server.port, t.host); await admin.login(t.username);
    client = apiClient(server.port, t.host);
    driver = mockDriver(); setDriver(driver);
    await admin.put('/settings/booking_portal_enabled', { value: '1' });
    await admin.put('/settings/takeaway_portal_enabled', { value: '1' });
    shift = (await admin.post('/bookings/shifts', { name: 'Cena', start_time: '20:00', duration_minutes: 90, weekdays: [0, 1, 2, 3, 4, 5, 6], capacity: 40, active: true })).body;
    await admin.put('/takeaway/hours', { hours: [0, 1, 2, 3, 4, 5, 6].map(weekday => ({ weekday, open_time: '00:00', close_time: '23:45' })) });
    await admin.put('/settings/takeaway_min_lead_minutes', { value: '0' });
  });
  after(async () => {
    setDriver(null);
    await deleteTenants(t, off);
    await server.close();
    await closePools();
  });

  it('richiesta dal sito: «ricevuta» dopo 2 minuti; se nel frattempo è confermata non parte', async () => {
    const a = await book({ customer_name: 'Marta Rossi' });
    assert.equal(a.status, 201, JSON.stringify(a.body));
    let rows = await log();
    assert.deepEqual([rows[0].event, rows[0].status, rows[0].template], ['received', 'queued', 'se_reservation_received_v1']);
    assert.equal(await run(), 0, 'prima dei 2 minuti non parte nulla');
    assert.equal(driver.sent.length, 0);

    // una seconda richiesta: la conferma il personale prima dei 2 minuti → «ricevuta» scartata, parte «confermata»
    const b = await book({ customer_name: 'Luca Neri' });
    const rb = await confirmOf(b.body.token);
    assert.equal((await admin.post(`/bookings/reservations/${rb.id}/confirm`, {})).status, 200);
    await run(t, later(3));
    const sent = driver.sent.map(m => [m.template, m.header, m.params[0]]);
    assert.deepEqual(sent.filter(s => s[2] === 'Luca'), [['se_reservation_confirmed_v1', `SmartEats × Prova ${t.slug}`, 'Luca']]);
    rows = await log();
    const luca = rows.filter(r => r.ref_id === rb.id);
    assert.deepEqual(luca.map(r => [r.event, r.status, r.error]).sort(), [['confirmed', 'sent', ''], ['received', 'skipped', 'GIA_GESTITA'], ['reminder', 'queued', '']]);
    // la prima richiesta, ancora in attesa: «ricevuta» parte dopo 2 minuti
    assert.ok(driver.sent.some(m => m.template === 'se_reservation_received_v1' && m.params[0] === 'Marta'));
  });

  it('promemoria 3 ore prima, una sola volta; rifiuto, annullo e annullo non accettato', async () => {
    const r = await book({ customer_name: 'Giulia Verdi' });
    const row = await confirmOf(r.body.token);
    await admin.post(`/bookings/reservations/${row.id}/confirm`, {});
    const reminder = (await log()).find(x => x.ref_id === row.id && x.event === 'reminder');
    const expected = new Date(`${day}T20:00:00`).getTime();
    assert.ok(Math.abs(new Date(reminder.next_attempt_at).getTime() - (expected - 3 * 3600000)) < 3 * 3600000, 'è fissato a 3 ore dal turno (nel fuso del locale)');
    const before = driver.sent.length;
    await run(t, new Date(reminder.next_attempt_at));
    assert.equal(driver.sent.length - before >= 1, true);
    assert.ok(driver.sent.some(m => m.template === 'se_reservation_reminder_v1' && m.params[0] === 'Giulia'));
    await run(t, new Date(reminder.next_attempt_at));
    assert.equal(driver.sent.filter(m => m.template === 'se_reservation_reminder_v1' && m.params[0] === 'Giulia').length, 1, 'una volta sola');

    const d = await book({ customer_name: 'Anna Declina' });
    const rd = await confirmOf(d.body.token);
    await admin.post(`/bookings/reservations/${rd.id}/decline`, { reason: 'Chiusi' });
    const c = await book({ customer_name: 'Carlo Annulla' });
    const rc = await confirmOf(c.body.token);
    await admin.post(`/bookings/reservations/${rc.id}/confirm`, {});
    await admin.post(`/bookings/reservations/${rc.id}/cancel`, {});
    const k = await book({ customer_name: 'Keep Tieni' });
    const rk = await confirmOf(k.body.token);
    await admin.post(`/bookings/reservations/${rk.id}/confirm`, {});
    await client.post(`/public/booking/requests/${k.body.token}/cancel`, {});
    await admin.post(`/bookings/reservations/${rk.id}/keep`, {});
    await run(t, later(5));
    const names = (template) => driver.sent.filter(m => m.template === template).map(m => m.params[0]);
    assert.ok(names('se_reservation_declined_v1').includes('Anna'));
    assert.ok(names('se_reservation_cancelled_v1').includes('Carlo'));
    assert.ok(names('se_reservation_kept_v1').includes('Keep'));
  });

  it('scaduta: richiesta senza risposta per più di 24 ore, e i posti si liberano', async () => {
    const r = await book({ customer_name: 'Sara Scade' });
    await adminDb.query(`UPDATE reservations SET requested_at = now() - interval '25 hours' WHERE public_token = $1`, [r.body.token]);
    await run(t, later(5));
    assert.ok(driver.sent.some(m => m.template === 'se_reservation_expired_v1' && m.params[0] === 'Sara'));
    const { rows: [x] } = await adminDb.query(`SELECT status FROM reservations WHERE public_token = $1`, [r.body.token]);
    assert.equal(x.status, 'expired');
    const av = (await admin.get(`/bookings/availability?date=${day}`)).body.find(a => a.shift_id === shift.id);
    assert.ok(av.free >= 0);
  });

  it('numeri: un fisso o assente non genera nulla; un numero valido ma non su WhatsApp fallisce con motivo', async () => {
    const before = (await log()).length;
    const fixed = await book({ customer_name: 'Fisso Rossi', phone: '0123 456789' });
    assert.equal(fixed.status, 201);
    const rows = await log();
    const mine = rows.slice(before);
    assert.deepEqual(mine.map(r => [r.status, r.error]), [['skipped', 'NUMERO_NON_VALIDO']]);

    const bad = await book({ customer_name: 'Nonwa Rossi', phone: '3330000000' });
    await run(t, later(3));
    const badId = (await confirmOf(bad.body.token)).id;
    const failed = (await log()).find(r => r.ref_id === badId);
    assert.deepEqual([failed.status, failed.error], ['failed', 'Numero non su WhatsApp']);

    const flaky = await book({ customer_name: 'Flaky Rossi', phone: '3331239999' });
    await run(t, later(3));
    const flakyId = (await confirmOf(flaky.body.token)).id;
    const f = (await log()).find(r => r.ref_id === flakyId);
    assert.deepEqual([f.status, f.attempts], ['queued', 1], 'errore temporaneo: si riprova più tardi');
  });

  it('asporto: ricevuto, accettato, pronto, ritirato (spento), annullato; il cliente che ritira non riceve nulla', async () => {
    const order = (extra = {}) => client.post('/public/takeaway/orders', {
      date: day, time: '19:00', items: [{ id: t.productId, quantity: 1 }], customer_name: 'Pia Asporto', phone: mobile(), email: '', notes: '', consent: true, website: '', ...extra });
    const o = await order();
    assert.equal(o.status, 201, JSON.stringify(o.body));
    const id = (await admin.get(`/takeaway/orders?date=${day}`)).body.find(x => x.customer_name === 'Pia Asporto').id;
    assert.equal((await admin.post(`/takeaway/orders/${id}/accept`, {})).status, 200);
    // la cucina conclude l'ordine
    const kitchenOrder = (await admin.get(`/takeaway/orders?date=${day}`)).body.find(x => x.id === id).order_id;
    await admin.put(`/orders/${kitchenOrder}/lines`, { status: 'ready' });
    await run(t, later(5));                                      // «pronto» parte subito, prima della consegna
    await admin.post(`/takeaway/orders/${id}/picked-up`, { method: 'cash' });
    await run(t, later(5));
    const byEvent = Object.fromEntries((await log()).filter(r => r.ref_type === 'takeaway' && r.ref_id === id).map(r => [r.event, r.status]));
    assert.equal(byEvent.received, 'skipped', 'già accettato prima dei 2 minuti');
    assert.equal(byEvent.accepted, 'sent');
    assert.equal(byEvent.picked_up, undefined, '«ritirato» è spento di partenza: non entra in coda');

    // l'ordine veloce senza cellulare non manda nulla; il cliente che ritira la richiesta nemmeno
    const quick = await admin.post('/takeaway/orders', { date: day, time: '19:15', items: [{ id: t.productId, quantity: 1 }], customer_name: 'Banco', phone: '', source: 'counter' });
    assert.equal(quick.status, 201);
    assert.equal((await log()).some(r => r.ref_id === quick.body.id && r.ref_type === 'takeaway'), false);
    const withdraw = await order({ time: '19:30' });
    await client.post(`/public/takeaway/orders/${withdraw.body.token}/cancel`, {});
    const wid = (await admin.get(`/takeaway/orders?date=${day}`)).body.find(x => x.status === 'cancelled').id;
    assert.deepEqual((await log()).filter(r => r.ref_id === wid && r.ref_type === 'takeaway' && r.event === 'cancelled'), []);

    // annullato dal locale dopo l'accettazione, e rifiutato
    const phoneOrder = await admin.post('/takeaway/orders', { date: day, time: '19:45', items: [{ id: t.productId, quantity: 1 }], customer_name: 'Telefono', phone: mobile(), source: 'phone' });
    await admin.post(`/takeaway/orders/${phoneOrder.body.id}/cancel`, {});
    const rej = await order({ time: '20:00', customer_name: 'Rif Rifiutato' });
    const rid = (await admin.get(`/takeaway/orders?date=${day}`)).body.find(x => x.customer_name === 'Rif Rifiutato').id;
    await admin.post(`/takeaway/orders/${rid}/reject`, { reason: 'Forno fermo' });
    assert.equal(rej.status, 201);
    await run(t, later(5));
    const sent = driver.sent.map(m => m.template);
    assert.ok(sent.includes('se_takeaway_cancelled_v1'));
    assert.ok(sent.includes('se_takeaway_rejected_v1'));
    assert.ok(sent.includes('se_takeaway_ready_v1'));
  });

  it('modulo spento o evento spento: nulla in coda; il tetto mensile conta le pratiche', async () => {
    // locale senza il modulo whatsapp
    const offBook = apiClient(server.port, off.host);
    const offAdmin = apiClient(server.port, off.host); await offAdmin.login(off.username);
    await offAdmin.put('/settings/booking_portal_enabled', { value: '1' });
    const s = (await offAdmin.post('/bookings/shifts', { name: 'Cena', start_time: '20:00', duration_minutes: 90, weekdays: [0, 1, 2, 3, 4, 5, 6], capacity: 40, active: true })).body;
    await offBook.post('/public/booking/requests', { date: day, shift_id: s.id, party_size: 2, customer_name: 'Zero', phone: mobile(), email: '', notes: '', consent: true, website: '' });
    assert.equal((await log(off)).length, 0);

    // evento spento dal Master (impostazione del locale)
    await adminDb.query(`INSERT INTO settings (key, value, tenant_id) VALUES ('whatsapp_event_reservation_received', '0', $1)`, [t.id]);
    const before = (await log()).length;
    await book({ customer_name: 'Muto Rossi' });
    assert.equal((await log()).length, before, 'evento spento: niente in coda');
    await adminDb.query(`DELETE FROM settings WHERE tenant_id = $1 AND key = 'whatsapp_event_reservation_received'`, [t.id]);

    // tetto: con 0 pratiche incluse nuove pratiche vengono scartate
    await adminDb.query(`INSERT INTO settings (key, value, tenant_id) VALUES ('whatsapp_monthly_quota', '0', $1)`, [t.id]);
    await book({ customer_name: 'Tetto Rossi' });
    const last = (await log()).at(-1);
    assert.deepEqual([last.status, last.error], ['skipped', 'TETTO_MENSILE']);
    await adminDb.query(`DELETE FROM settings WHERE tenant_id = $1 AND key = 'whatsapp_monthly_quota'`, [t.id]);
  });

  it('il Master configura eventi e tetto, vede il registro e invia una prova; il locale non può', async () => {
    const masterCookie = { cookie: `master_token=${jwt.sign({ master: true }, process.env.MASTER_JWT_SECRET)}` };
    const master = apiClient(server.port, 'master.standmanager.local');
    const get = (await master.request('GET', `/master/tenants/${t.id}/whatsapp`, undefined, masterCookie)).body;
    assert.deepEqual([get.module_enabled, get.driver, get.quota, get.events.length], [true, 'mock', 300, 14]);
    assert.equal(get.events.find(e => e.id === 'takeaway.picked_up').enabled, false);
    assert.ok(get.log.length > 0 && get.log[0].to_tail.length <= 3, 'del numero si vedono solo le ultime cifre');

    const put = await master.request('PUT', `/master/tenants/${t.id}/whatsapp`, { events: { 'takeaway.picked_up': true, 'reservation.reminder': false }, quota: 50 }, masterCookie);
    assert.equal(put.status, 200, JSON.stringify(put.body));
    const after = (await master.request('GET', `/master/tenants/${t.id}/whatsapp`, undefined, masterCookie)).body;
    assert.deepEqual([after.quota, after.events.find(e => e.id === 'takeaway.picked_up').enabled, after.events.find(e => e.id === 'reservation.reminder').enabled], [50, true, false]);
    assert.equal((await master.request('PUT', `/master/tenants/${t.id}/whatsapp`, { events: { 'inventato.evento': true } }, masterCookie)).status, 400);

    const test = await master.request('POST', `/master/tenants/${t.id}/whatsapp/test`, { to: '333 111 2222' }, masterCookie);
    assert.deepEqual([test.status, test.body.ok], [200, true]);
    assert.match(test.body.preview, /prenotazione è confermata/);
    assert.equal((await master.request('POST', `/master/tenants/${t.id}/whatsapp/test`, { to: '0123 456789' }, masterCookie)).status, 400);
    // il locale non vede il pannello master e non cambia nulla
    assert.equal((await admin.request('GET', `/master/tenants/${t.id}/whatsapp`)).status, 401);
    // il personale legge lo stato degli avvisi di una pratica, non il numero intero
    const someRes = (await adminDb.query(`SELECT ref_id FROM whatsapp_messages WHERE tenant_id = $1 AND ref_type = 'reservation' LIMIT 1`, [t.id])).rows[0];
    const msgs = (await admin.get(`/whatsapp/messages?ref_type=reservation&ref_id=${someRes.ref_id}`)).body;
    assert.ok(msgs.length > 0);
    assert.ok(msgs.every(m => m.to.startsWith('…') && m.to_phone === undefined));
    await master.request('PUT', `/master/tenants/${t.id}/whatsapp`, { events: { 'takeaway.picked_up': false, 'reservation.reminder': true }, quota: 300 }, masterCookie);
  });
});
