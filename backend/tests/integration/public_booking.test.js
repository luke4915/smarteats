// Portale pubblico di prenotazione (Fase 4, P2): richieste dal cliente, finestra, tetto per telefono, link personale.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, createTenant, deleteTenants, closePools, apiClient, adminDb } from './helpers.js';
import { localNow, addDays } from '../../utils/bookingPortal.js';
import { purgePersonalData } from '../../utils/bookingRetention.js';

describe('portale di prenotazione', () => {
  let server, t, other, sagra, admin, otherApi, client, shift, small;
  const today = localNow().date;
  const day = addDays(today, 5);
  let phoneSeq = 0;
  const phone = () => `333${String(1000000 + ++phoneSeq)}`;
  const body = (extra = {}) => ({ date: day, shift_id: shift.id, party_size: 4, customer_name: 'Rossi', phone: phone(), email: '', notes: '', consent: true, website: '', ...extra });
  const request = (extra, api = client) => api.post('/public/booking/requests', body(extra));

  before(async () => {
    server = await startServer();
    [t, other, sagra] = [await createTenant({ businessType: 'restaurant' }), await createTenant({ businessType: 'restaurant' }), await createTenant()];
    for (const x of [t, other]) await adminDb.query(`UPDATE tenants SET modules = array_append(modules, 'bookings') WHERE id = $1`, [x.id]);
    admin = apiClient(server.port, t.host); await admin.login(t.username);
    otherApi = apiClient(server.port, other.host); await otherApi.login(other.username);
    client = apiClient(server.port, t.host);
    const mk = (name, start, capacity) => admin.post('/bookings/shifts', { name, start_time: start, duration_minutes: 90, weekdays: [0, 1, 2, 3, 4, 5, 6], capacity, active: true });
    shift = (await mk('Cena 19:30', '19:30', 40)).body;
    small = (await mk('Cena 21:30', '21:30', 4)).body;
  });
  after(async () => {
    await deleteTenants(t, other, sagra);
    await server.close();
    await closePools();
  });

  const turnOn = (api = admin) => api.put('/settings/booking_portal_enabled', { value: '1' });

  it('spento di fabbrica: il portale non esiste; senza il modulo nemmeno', async () => {
    const off = await client.get('/public/booking/info');
    assert.deepEqual([off.status, off.body.code], [404, 'PORTAL_OFF']);
    const noModule = await apiClient(server.port, sagra.host).get('/public/booking/info');
    assert.deepEqual([noModule.status, noModule.body.code], [403, 'MODULE_DISABLED']);
    assert.equal((await client.post('/public/booking/requests', body())).status, 404);
  });

  it('impostazioni: solo l\'admin le scrive, con valori sensati', async () => {
    assert.equal((await admin.put('/settings/booking_portal_enabled', { value: 'si' })).status, 400);
    assert.equal((await admin.put('/settings/booking_portal_phone', { value: 'chiamami' })).status, 400);
    assert.equal((await admin.put('/settings/booking_portal_phone', { value: '+39 0123 456789' })).status, 200);
    assert.equal((await admin.put('/settings/booking_portal_welcome', { value: 'Benvenuti da noi!' })).status, 200);
    assert.equal((await turnOn()).status, 200);
    // non escono dall'endpoint pubblico delle impostazioni: le legge solo il portale
    const pub = (await client.get('/settings')).body;
    assert.equal(pub.booking_portal_phone, undefined);
  });

  it('info, calendario e turni: nessun numero di posti, nessun dato interno', async () => {
    const info = (await client.get('/public/booking/info')).body;
    assert.deepEqual([info.phone, info.welcome, info.max_party, info.max_days, info.min_notice_hours], ['+39 0123 456789', 'Benvenuti da noi!', 10, 30, 1]);
    assert.deepEqual(Object.keys(info).sort(), ['max_days', 'max_party', 'min_notice_hours', 'name', 'phone', 'today', 'welcome']);

    const cal = (await client.get('/public/booking/calendar?party=2')).body;
    assert.equal(cal.days.length, 31);
    assert.deepEqual(Object.keys(cal.days[0]).sort(), ['available', 'date']);
    assert.equal(cal.days.find(d => d.date === day).available, true);
    assert.equal(cal.days.find(d => d.date === addDays(today, 31)), undefined);

    const av = (await client.get(`/public/booking/availability?date=${day}&party=4`)).body;
    assert.deepEqual(av.shifts.map(s => [s.name, s.available]), [['Cena 19:30', true], ['Cena 21:30', true]]);
    for (const s of av.shifts) assert.deepEqual(Object.keys(s).sort(), ['available', 'id', 'name', 'start_time']);
    const five = (await client.get(`/public/booking/availability?date=${day}&party=5`)).body;
    assert.equal(five.shifts.find(s => s.id === small.id).available, false, 'il turno piccolo non regge cinque persone');
    assert.equal((await client.get(`/public/booking/availability?date=${day}&party=11`)).status, 400);
  });

  it('richiesta: nasce «da confermare», il personale la vede, il cliente ha il suo link', async () => {
    const res = await request({ customer_name: 'Verdi', notes: 'Seggiolone', email: 'verdi@example.com' });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.deepEqual(Object.keys(res.body).sort(), ['restaurant', 'token']);
    assert.ok(res.body.token.length >= 30);

    const { rows: [row] } = await adminDb.query(`SELECT status, source, consent_at, party_size FROM reservations WHERE public_token = $1`, [res.body.token]);
    assert.deepEqual([row.status, row.source, row.party_size], ['requested', 'portal', 4]);
    assert.ok(row.consent_at);

    const staff = (await admin.get(`/bookings/reservations?date=${day}`)).body.find(r => r.customer_name === 'Verdi');
    assert.equal(staff.status, 'requested');

    const mine = await client.get(`/public/booking/requests/${res.body.token}`);
    assert.equal(mine.status, 200);
    assert.deepEqual(Object.keys(mine.body).sort(), ['cancel', 'customer_name', 'date', 'decline_reason', 'party_size', 'restaurant', 'shift_name', 'start_time', 'status']);
    assert.deepEqual([mine.body.status, mine.body.cancel, mine.body.start_time], ['requested', 'withdraw', '19:30']);
    assert.equal(JSON.stringify(mine.body).includes('verdi@example.com'), false, 'niente email nelle risposte pubbliche');

    // il personale conferma: il cliente lo vede dal suo link
    await admin.post(`/bookings/reservations/${staff.id}/confirm`, {});
    const confirmed = (await client.get(`/public/booking/requests/${res.body.token}`)).body;
    assert.deepEqual([confirmed.status, confirmed.cancel], ['confirmed', 'request'], 'confermata: non si annulla da sola, si chiede');
  });

  it('rifiuti chiari: gruppo grande, consenso, trappola, troppo presto, troppo lontano, posto finito', async () => {
    assert.equal((await request({ party_size: 11 })).status, 400);
    assert.equal((await request({ consent: false })).status, 400);
    assert.equal((await request({ customer_name: '' })).status, 400);
    assert.equal((await request({ phone: '12' })).status, 400);
    assert.equal((await request({ website: 'http://spam.example' })).status, 400, 'il campo trappola');
    assert.equal((await request({ opened_at: Date.now() })).status, 400, 'compilato in un lampo');

    const tooFar = await request({ date: addDays(today, 31) });
    assert.deepEqual([tooFar.status, tooFar.body.code], [409, 'TOO_FAR']);
    const past = await request({ date: addDays(today, -1) });
    assert.deepEqual([past.status, past.body.code], [409, 'TOO_SOON']);

    const full = await request({ shift_id: small.id, party_size: 5 });
    assert.deepEqual([full.status, full.body.code], [409, 'NO_CAPACITY']);
    assert.equal(/\d/.test(full.body.error), false, 'il cliente non vede quanti posti restano');
    assert.equal((await request({ shift_id: 999999 })).status, 404);
  });

  it('le richieste in attesa tengono il posto: dopo due, la terza dello stesso numero è respinta', async () => {
    const same = phone();
    assert.equal((await request({ phone: same, shift_id: small.id, party_size: 2 })).status, 201);
    assert.equal((await request({ phone: `+39 ${same.slice(0, 3)} ${same.slice(3)}`, shift_id: small.id, party_size: 2 })).status, 201, 'stesso numero scritto in un altro modo');
    const third = await request({ phone: same, party_size: 2 });
    assert.deepEqual([third.status, third.body.code], [429, 'TOO_MANY_PENDING']);
    // il turno piccolo è ora pieno (2 + 2 su 4): un'altra persona non ci entra
    const late = await request({ shift_id: small.id, party_size: 1 });
    assert.deepEqual([late.status, late.body.code], [409, 'NO_CAPACITY']);
  });

  it('annullo dal link: libera il posto, una volta sola; un link sbagliato non rivela nulla', async () => {
    const phoneOnly = phone();
    const { body: made } = await request({ phone: phoneOnly, shift_id: small.id, party_size: 1 }).catch(() => ({ body: {} }));
    // il turno piccolo è pieno dal test prima: si usa quello grande
    const res = await request({ phone: phoneOnly, party_size: 3 });
    assert.equal(res.status, 201, JSON.stringify(res.body) + JSON.stringify(made));
    const { token } = res.body;
    const cancelled = await client.post(`/public/booking/requests/${token}/cancel`, {});
    assert.deepEqual([cancelled.status, cancelled.body.status, cancelled.body.cancel], [200, 'cancelled', null]);
    assert.equal((await client.post(`/public/booking/requests/${token}/cancel`, {})).status, 409, 'già annullata');
    assert.equal((await client.get(`/public/booking/requests/${token}x`)).status, 404);
    assert.equal((await client.get('/public/booking/requests/abcdefghijklmnop')).status, 404);
    // un altro locale (stesso token, altro sottodominio) non la trova, anche col portale acceso
    await turnOn(otherApi);
    assert.equal((await apiClient(server.port, other.host).get(`/public/booking/requests/${token}`)).status, 404);

    const audit = (await adminDb.query(`SELECT action, details FROM audit_logs WHERE tenant_id = $1 AND action LIKE 'BOOKING_PORTAL%'`, [t.id])).rows;
    assert.ok(audit.some(a => a.action === 'BOOKING_PORTAL_REQUEST'));
    assert.ok(audit.some(a => a.action === 'BOOKING_PORTAL_CANCEL'));
    assert.equal(JSON.stringify(audit).includes('Rossi'), false, 'nell\'audit nessun dato personale');
  });

  it('annullo di una prenotazione confermata: il cliente lo chiede, il locale decide; troppo tardi si telefona', async () => {
    const make = async (extra = {}) => {
      const res = await request({ party_size: 2, ...extra });
      assert.equal(res.status, 201, JSON.stringify(res.body));
      const row = (await admin.get(`/bookings/reservations?date=${extra.date ?? day}`)).body.find(r => r.public_token === res.body.token);
      await admin.post(`/bookings/reservations/${row.id}/confirm`, {});
      return { token: res.body.token, id: row.id };
    };
    const { token, id } = await make();

    // il cliente non annulla da solo: manda una richiesta di annullo, e la prenotazione resta confermata
    const asked = await client.post(`/public/booking/requests/${token}/cancel`, {});
    assert.deepEqual([asked.status, asked.body.status, asked.body.cancel], [200, 'confirmed', 'requested']);
    assert.equal((await client.post(`/public/booking/requests/${token}/cancel`, {})).body.cancel, 'requested', 'ripeterlo non cambia nulla');

    // il personale la vede nelle notifiche, con il tipo giusto
    const inbox = (await admin.get('/bookings/inbox')).body;
    const item = inbox.find(i => i.id === id);
    assert.deepEqual([item.kind, item.customer_name, item.party_size], ['cancel_request', 'Rossi', 2]);

    // «Mantieni»: la prenotazione resta, la richiesta sparisce e il cliente può chiederlo di nuovo
    assert.equal((await admin.post(`/bookings/reservations/${id}/keep`, {})).status, 200);
    assert.equal((await admin.post(`/bookings/reservations/${id}/keep`, {})).body.code, 'NO_CANCEL_REQUEST');
    assert.equal((await admin.get('/bookings/inbox')).body.some(i => i.id === id), false);
    assert.equal((await client.get(`/public/booking/requests/${token}`)).body.cancel, 'request');

    // richiesto di nuovo e confermato dal locale: annullata, e fuori dalle notifiche
    await client.post(`/public/booking/requests/${token}/cancel`, {});
    assert.equal((await admin.post(`/bookings/reservations/${id}/cancel`, {})).body.status, 'cancelled');
    assert.equal((await client.get(`/public/booking/requests/${token}`)).body.status, 'cancelled');
    assert.equal((await admin.get('/bookings/inbox')).body.some(i => i.id === id), false);
  });

  it('a meno di un\'ora dal turno una prenotazione confermata non si annulla dal portale', async () => {
    // un turno che inizia tra 30 minuti (nel fuso del locale), confermato dal personale direttamente in banca dati
    const now = localNow();
    const start = `${String(Math.floor(((now.minutes + 30) % 1440) / 60)).padStart(2, '0')}:${String((now.minutes + 30) % 60).padStart(2, '0')}`;
    if (now.minutes + 30 >= 1440) return;                                  // a ridosso della mezzanotte il caso non si presenta
    const { rows: [soon] } = await adminDb.query(
      `INSERT INTO booking_shifts (name, start_time, duration_minutes, weekdays, capacity, tenant_id) VALUES ('Imminente', $1, 60, '{0,1,2,3,4,5,6}', 10, $2) RETURNING id`, [start, t.id]);
    const token = `late-${Math.random().toString(36).slice(2)}-padding`;
    await adminDb.query(
      `INSERT INTO reservations (date, shift_id, party_size, status, customer_name, phone, source, public_token, tenant_id)
       VALUES ($1, $2, 2, 'confirmed', 'Ritardatari', '333', 'portal', $3, $4)`, [today, soon.id, token, t.id]);
    const res = await client.post(`/public/booking/requests/${token}/cancel`, {});
    assert.deepEqual([res.status, res.body.code], [409, 'CANCEL_BY_PHONE']);
    assert.equal((await client.get(`/public/booking/requests/${token}`)).body.cancel, 'call');
  });

  it('conservazione: dopo 90 giorni nome, telefono, email e note si svuotano; le prenotazioni vive no', async () => {
    const mk = (status, date, name) => adminDb.query(
      `INSERT INTO reservations (date, shift_id, party_size, status, customer_name, phone, email, notes, source, public_token, tenant_id)
       VALUES ($1, $2, 2, $3, $4, '333', 'a@b.it', 'note', 'portal', $5, $6) RETURNING id`,
      [date, shift.id, status, name, `old-${Math.random().toString(36).slice(2)}-${name}`, t.id]);
    const old = (await mk('completed', addDays(today, -120), 'Vecchio')).rows[0].id;
    const recent = (await mk('completed', addDays(today, -10), 'Recente')).rows[0].id;
    const oldLive = (await mk('confirmed', addDays(today, -120), 'Ancora viva')).rows[0].id;
    const { withTenantClient } = await import('../../middleware/tenantScope.js');
    const n = await withTenantClient(t.id, (db) => purgePersonalData(db, today));
    assert.ok(n >= 1);
    const get = async (id) => (await adminDb.query('SELECT customer_name, phone, email, notes FROM reservations WHERE id = $1', [id])).rows[0];
    assert.deepEqual(await get(old), { customer_name: 'Cliente', phone: '', email: '', notes: '' });
    assert.equal((await get(recent)).customer_name, 'Recente');
    assert.equal((await get(oldLive)).customer_name, 'Ancora viva');
    assert.equal(await withTenantClient(t.id, (db) => purgePersonalData(db, today)), 0, 'idempotente');
  });
});
