// Prenotazioni (Fase 4, P1): turni, chiusure, posti, richieste e conferme, tavoli sulla pianta, arrivo e conto.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { startServer, createTenant, deleteTenants, closePools, apiClient, adminDb, connectWs, sleep, PASSWORD } from './helpers.js';

const DATE = '2026-10-23';   // un venerdì
const SATURDAY = '2026-10-24';

describe('prenotazioni', () => {
  let server, t, other, sagra, admin, waiter, kitchen, otherApi, sagraApi, tables, dinner, late;

  const user = async (role, tenant = t) => {
    const username = `${role}-${tenant.slug}`;
    await adminDb.query(`INSERT INTO users (username, password_hash, role, tenant_id) VALUES ($1, $2, $3, $4)`, [username, await bcrypt.hash(PASSWORD, 4), role, tenant.id]);
    const api = apiClient(server.port, tenant.host);
    await api.login(username);
    return api;
  };
  const withBookings = (tenant) => adminDb.query(`UPDATE tenants SET modules = array_append(modules, 'bookings') WHERE id = $1`, [tenant.id]);
  const shift = (name, start, extra = {}) => ({ name, start_time: start, duration_minutes: 90, weekdays: [0, 1, 2, 3, 4, 5, 6], capacity: 20, active: true, ...extra });
  const book = (body, api = waiter) => api.post('/bookings/reservations', { date: DATE, shift_id: dinner.id, party_size: 4, customer_name: 'Rossi', phone: '333', ...body });
  const requested = async (partySize = 2, extra = {}) => {
    const { rows: [r] } = await adminDb.query(
      `INSERT INTO reservations (date, shift_id, party_size, status, customer_name, source, public_token, requested_at, tenant_id)
       VALUES ($1, $2, $3, 'requested', 'Bianchi', 'portal', $4, $5, $6) RETURNING id`,
      [extra.date ?? DATE, extra.shiftId ?? dinner.id, partySize, `tok-${Math.random().toString(36).slice(2)}`, extra.requestedAt ?? new Date(), t.id]);
    return r.id;
  };

  before(async () => {
    server = await startServer();
    [t, other, sagra] = [await createTenant({ businessType: 'restaurant' }), await createTenant({ businessType: 'restaurant' }), await createTenant()];
    await withBookings(t); await withBookings(other);
    admin = apiClient(server.port, t.host);
    await admin.login(t.username);
    waiter = await user('waiter');
    kitchen = await user('kitchen');
    otherApi = apiClient(server.port, other.host);
    await otherApi.login(other.username);
    sagraApi = apiClient(server.port, sagra.host);
    await sagraApi.login(sagra.username);
    const room = (await admin.post('/rooms', { name: 'Sala' })).body;
    tables = (await admin.post(`/rooms/${room.id}/tables/bulk`, { prefix: 'T', from: 1, to: 4, seats: 4 })).body.created;
    dinner = (await admin.post('/bookings/shifts', shift('Cena 19:30', '19:30'))).body;
    late = (await admin.post('/bookings/shifts', shift('Cena 21:00', '21:00', { capacity: 8 }))).body;
  });
  after(async () => {
    await deleteTenants(t, other, sagra);
    await server.close();
    await closePools();
  });

  it('turni: solo l\'admin li scrive, la sala li legge, il nome è unico, la sagra non ha il modulo', async () => {
    assert.equal(dinner.start_time, '19:30');
    assert.equal(dinner.duration_minutes, 90);
    assert.equal((await waiter.get('/bookings/shifts')).body.length, 2);
    assert.equal((await waiter.post('/bookings/shifts', shift('Pranzo', '12:30'))).status, 403);
    assert.equal((await kitchen.get('/bookings/shifts')).status, 403);
    assert.equal((await admin.post('/bookings/shifts', shift('cena 19:30', '20:00'))).status, 409);
    assert.equal((await admin.post('/bookings/shifts', shift('X', '25:00'))).status, 400);
    assert.equal((await admin.post('/bookings/shifts', shift('X', '12:00', { weekdays: [] }))).status, 400);
    assert.equal((await sagraApi.get('/bookings/shifts')).status, 403);
    const upd = await admin.put(`/bookings/shifts/${late.id}`, shift('Cena 21:00', '21:00', { capacity: 10, duration_minutes: 100 }));
    assert.equal(upd.body.capacity, 10);
    late = upd.body;
  });

  it('disponibilità: posti tenuti da richieste e conferme, chiusure e giorni della settimana', async () => {
    const day = (await admin.get(`/bookings/availability?date=${DATE}`)).body;
    assert.deepEqual(day.map(s => [s.name, s.capacity, s.held, s.free, s.bookable]), [['Cena 19:30', 20, 0, 20, true], ['Cena 21:00', 10, 0, 10, true]]);
    await book({ party_size: 6 });
    const reqId = await requested(3);
    const after = (await admin.get(`/bookings/availability?date=${DATE}`)).body[0];
    assert.deepEqual([after.held, after.free], [9, 11], 'la richiesta in attesa tiene il posto');

    const mon = await admin.post('/bookings/shifts', shift('Solo lunedì', '12:00', { weekdays: [1] }));
    const monday = (await admin.get(`/bookings/availability?date=${DATE}`)).body.find(s => s.shift_id === mon.body.id);
    assert.equal(monday.bookable, false);
    assert.match(monday.reason, /non previsto/);

    const closure = await admin.post('/bookings/closures', { date_from: SATURDAY, date_to: SATURDAY, shift_id: null, reason: 'Evento privato' });
    assert.equal(closure.status, 201);
    const sat = (await admin.get(`/bookings/availability?date=${SATURDAY}`)).body.filter(s => s.shift_id !== mon.body.id);
    assert.ok(sat.every(s => !s.bookable && s.reason === 'Evento privato'));
    assert.equal((await waiter.post('/bookings/closures', { date_from: SATURDAY, date_to: SATURDAY })).status, 403);
    assert.equal((await admin.post('/bookings/closures', { date_from: SATURDAY, date_to: '2026-10-01' })).status, 400);
    await admin.request('DELETE', `/bookings/closures/${closure.body.id}`);
    await admin.request('DELETE', `/bookings/shifts/${mon.body.id}`);
    await adminDb.query('DELETE FROM reservations WHERE id = $1', [reqId]);
  });

  it('inserimento a mano: nasce confermata; posti, giorno chiuso e dati controllati dal server', async () => {
    const ok = await book({ customer_name: 'Verdi', party_size: 4, notes: 'seggiolone' });
    assert.equal(ok.status, 201, JSON.stringify(ok.body));
    assert.equal(ok.body.status, 'confirmed');
    assert.equal(ok.body.date, DATE);
    assert.equal(ok.body.start_time, '19:30');
    assert.match(ok.body.confirmation_message, /Verdi/);
    assert.ok(ok.body.public_token.length >= 20);

    const full = await book({ shift_id: late.id, party_size: 11 });
    assert.equal(full.status, 409);
    assert.equal(full.body.code, 'NO_CAPACITY');
    assert.equal((await book({ shift_id: late.id, party_size: 11, ignore_capacity: true })).status, 201, 'il personale può accettare oltre la capienza');
    assert.equal((await book({ shift_id: late.id, party_size: 1 })).body.code, 'NO_CAPACITY', 'ora il turno è oltre il completo');

    assert.equal((await book({ customer_name: '' })).status, 400);
    assert.equal((await book({ party_size: 0 })).status, 400);
    assert.equal((await book({ date: '2026-02-31' })).status, 400);
    assert.equal((await book({ email: 'non-una-mail' })).status, 400);
    assert.equal((await book({ shift_id: 999999999 })).status, 404);
    assert.equal((await kitchen.post('/bookings/reservations', { date: DATE, shift_id: dinner.id, party_size: 2, customer_name: 'X' })).status, 403);
    assert.equal((await book({}, otherApi)).status, 404, 'il turno di un altro locale non esiste');
  });

  it('richieste: conferma, rifiuto, annullo e transizioni non ammesse', async () => {
    const a = await requested(2), b = await requested(2), c = await requested(2);
    const confirmed = await waiter.post(`/bookings/reservations/${a}/confirm`, {});
    assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
    assert.equal(confirmed.body.status, 'confirmed');
    assert.ok(confirmed.body.decided_at);

    const declined = await waiter.post(`/bookings/reservations/${b}/decline`, { reason: 'Siamo al completo' });
    assert.equal(declined.body.status, 'declined');
    assert.equal(declined.body.decline_reason, 'Siamo al completo');

    assert.equal((await waiter.post(`/bookings/reservations/${b}/confirm`, {})).body.code, 'INVALID_TRANSITION', 'una rifiutata non si riapre');
    assert.equal((await waiter.post(`/bookings/reservations/${c}/no-show`, {})).status, 409, 'prima va confermata');
    assert.equal((await waiter.post(`/bookings/reservations/${a}/cancel`, {})).body.status, 'cancelled');
    assert.equal((await otherApi.post(`/bookings/reservations/${c}/confirm`, {})).status, 404);
  });

  it('una richiesta non decisa decade dopo 24 ore e libera il posto', async () => {
    const day = '2026-11-06';
    const old = await requested(6, { date: day, requestedAt: new Date(Date.now() - 25 * 3600 * 1000) });
    const fresh = await requested(4, { date: day, requestedAt: new Date(Date.now() - 2 * 3600 * 1000) });
    const avail = (await admin.get(`/bookings/availability?date=${day}`)).body[0];
    assert.deepEqual([avail.held, avail.free], [4, 16], 'la scaduta non tiene il posto');
    const list = (await admin.get(`/bookings/reservations?date=${day}`)).body;
    assert.equal(list.find(r => r.id === old).status, 'expired');
    assert.equal(list.find(r => r.id === fresh).status, 'requested');
    assert.equal((await waiter.post(`/bookings/reservations/${old}/confirm`, {})).body.code, 'INVALID_TRANSITION');
  });

  it('confermare ricontrolla i posti: una richiesta che non ci sta non si conferma', async () => {
    const day = '2026-11-13';
    await book({ date: day, shift_id: late.id, party_size: 9 });
    const r = await requested(3, { date: day, shiftId: late.id });
    const res = await waiter.post(`/bookings/reservations/${r}/confirm`, {});
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'NO_CAPACITY');
    assert.equal((await waiter.post(`/bookings/reservations/${r}/confirm`, { ignore_capacity: true })).status, 200);
  });

  it('tavoli: assegnati sulla pianta, mai doppi con orari sovrapposti, liberi dopo il turno', async () => {
    const day = '2026-11-20';
    const first = (await book({ date: day, customer_name: 'Primo', party_size: 4, table_ids: [tables[0].id] })).body;
    assert.deepEqual(first.table_ids, [tables[0].id]);

    const clash = await book({ date: day, customer_name: 'Secondo', party_size: 2, table_ids: [tables[0].id] });
    assert.equal(clash.status, 409);
    assert.equal(clash.body.code, 'TABLE_TAKEN');
    assert.match(clash.body.error, /Primo/);

    // 19:30 + 90' finisce alle 21:00; il turno delle 21:00 lo trova libero
    const later = await book({ date: day, shift_id: late.id, customer_name: 'Dopo', party_size: 2, table_ids: [tables[0].id] });
    assert.equal(later.status, 201, JSON.stringify(later.body));

    // un turno che si accavalla (20:30) lo trova occupato
    const mid = (await admin.post('/bookings/shifts', shift('Cena 20:30', '20:30'))).body;
    const overlap = await book({ date: day, shift_id: mid.id, customer_name: 'Accavallato', table_ids: [tables[0].id] });
    assert.equal(overlap.body.code, 'TABLE_TAKEN');

    const two = (await book({ date: day, customer_name: 'Gruppo', party_size: 8 })).body;
    const joined = await waiter.put(`/bookings/reservations/${two.id}/tables`, { table_ids: [tables[1].id, tables[2].id] });
    assert.deepEqual(joined.body.table_ids, [tables[1].id, tables[2].id], 'più tavoli per un gruppo');
    assert.equal((await waiter.put(`/bookings/reservations/${two.id}/tables`, { table_ids: [999999999] })).body.code, 'INVALID_TABLE');
    assert.equal((await waiter.put(`/bookings/reservations/${two.id}/tables`, { table_ids: [] })).body.table_ids.length, 0);
    await admin.request('DELETE', `/bookings/shifts/${mid.id}`);
  });

  it('modifica: cambio persone e turno ricontrollati; spostando di turno i tavoli si liberano', async () => {
    const day = '2026-11-27';
    const r = (await book({ date: day, party_size: 4, table_ids: [tables[3].id] })).body;
    assert.equal((await waiter.put(`/bookings/reservations/${r.id}`, { party_size: 25 })).body.code, 'NO_CAPACITY');
    const moved = await waiter.put(`/bookings/reservations/${r.id}`, { shift_id: late.id, party_size: 3, notes: 'Anniversario' });
    assert.equal(moved.status, 200, JSON.stringify(moved.body));
    assert.deepEqual([moved.body.shift_id, moved.body.party_size, moved.body.notes, moved.body.table_ids], [late.id, 3, 'Anniversario', []]);
    assert.equal((await waiter.put(`/bookings/reservations/${r.id}`, {})).status, 400);
    // un campo non indicato non si cancella
    const kept = await waiter.put(`/bookings/reservations/${r.id}`, { notes: 'Torta' });
    assert.deepEqual([kept.body.phone, kept.body.customer_name, kept.body.notes, kept.body.party_size], ['333', 'Rossi', 'Torta', 3]);
    await waiter.post(`/bookings/reservations/${r.id}/cancel`, {});
    assert.equal((await waiter.put(`/bookings/reservations/${r.id}`, { notes: 'x' })).status, 409, 'una annullata non si modifica');
  });

  it('i tavoli scelti devono avere posti a sufficienza: 3 posti non reggono 4 persone', async () => {
    const day = '2026-12-06';
    const { rows: [small] } = await adminDb.query(
      `INSERT INTO dining_tables (room_id, name, seats, tenant_id) SELECT room_id, 'Piccolo', 3, tenant_id FROM dining_tables WHERE id = $1 RETURNING id`, [tables[0].id]);
    const r = (await book({ date: day, party_size: 4 })).body;
    const refused = await waiter.put(`/bookings/reservations/${r.id}/tables`, { table_ids: [small.id] });
    assert.deepEqual([refused.status, refused.body.code], [409, 'NOT_ENOUGH_SEATS']);
    assert.match(refused.body.error, /3 posti.*non bastano per 4/);
    // due tavoli insieme bastano (3 + 4)
    const ok = await waiter.put(`/bookings/reservations/${r.id}/tables`, { table_ids: [small.id, tables[1].id] });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    // aumentando le persone oltre i posti assegnati, i tavoli si liberano (il personale li riassegna)
    const more = await waiter.put(`/bookings/reservations/${r.id}`, { party_size: 9 });
    assert.deepEqual([more.status, more.body.table_ids], [200, []]);
  });

  it('arrivato: apre il conto sul tavolo assegnato con i coperti, e la prenotazione è «seduta»', async () => {
    const day = '2026-12-04';
    const r = (await book({ date: day, customer_name: 'Neri', party_size: 3 })).body;
    assert.equal((await waiter.post(`/bookings/reservations/${r.id}/arrived`, {})).body.code, 'NO_TABLE');
    await waiter.put(`/bookings/reservations/${r.id}/tables`, { table_ids: [tables[2].id] });

    // senza servizio aperto il conto non si apre
    await adminDb.query('UPDATE sessions SET end_time = now() WHERE tenant_id = $1 AND end_time IS NULL', [t.id]);
    assert.equal((await waiter.post(`/bookings/reservations/${r.id}/arrived`, {})).body.code, 'NO_ACTIVE_SESSION');
    await adminDb.query(`INSERT INTO sessions (name, start_time, tenant_id) VALUES ('Cena', now(), $1)`, [t.id]);

    const res = await waiter.post(`/bookings/reservations/${r.id}/arrived`, {});
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.reservation.status, 'seated');
    assert.equal(res.body.reservation.check_id, res.body.check.id);
    assert.deepEqual([res.body.check.table_id, res.body.check.covers, res.body.check.status], [tables[2].id, 3, 'open']);
    assert.equal((await waiter.post(`/bookings/reservations/${r.id}/arrived`, {})).body.code, 'INVALID_TRANSITION', 'non si accoglie due volte');

    // un tavolo già occupato da un altro conto
    const busy = (await book({ date: day, customer_name: 'Occupato', party_size: 2, shift_id: late.id, table_ids: [tables[2].id] })).body;
    assert.equal((await waiter.post(`/bookings/reservations/${busy.id}/arrived`, {})).body.code, 'TABLE_BUSY');
  });

  it('quando il conto si chiude la prenotazione non resta «al tavolo»: pagato = conclusa, annullato = torna confermata, unito = segue', async () => {
    const day = '2026-12-05';
    const arrive = async (name, table) => {
      const r = (await book({ date: day, customer_name: name, party_size: 2, table_ids: [table.id] })).body;
      const res = await waiter.post(`/bookings/reservations/${r.id}/arrived`, {});
      assert.equal(res.status, 200, JSON.stringify(res.body));
      return { r, check: res.body.check };
    };
    const state = async (id) => (await waiter.get(`/bookings/reservations/${id}`)).body;

    // pagato (conto vuoto da chiudere): conclusa, e il tavolo si può dare a un'altra prenotazione dello stesso turno
    const paid = await arrive('Pagati', tables[0]);
    assert.equal((await admin.post(`/checks/${paid.check.id}/close`, {})).status, 200);
    assert.equal((await state(paid.r.id)).status, 'completed');
    const again = await book({ date: day, customer_name: 'Dopo', party_size: 2, table_ids: [tables[0].id] });
    assert.equal(again.status, 201, 'il tavolo è libero per la stessa sera');

    // annullato: era aperto per sbaglio, la prenotazione torna confermata, senza conto
    const voided = await arrive('Sbagliati', tables[1]);
    assert.equal((await admin.post(`/checks/${voided.check.id}/void`, { cancel_orders: false })).status, 200);
    const back = await state(voided.r.id);
    assert.deepEqual([back.status, back.check_id, back.table_ids], ['confirmed', null, [tables[1].id]]);

    // unito: la prenotazione segue il conto di destinazione
    const room = (await admin.post('/rooms', { name: 'Veranda' })).body;
    const spare = (await admin.post(`/rooms/${room.id}/tables/bulk`, { prefix: 'V', from: 1, to: 2, seats: 4 })).body.created;
    const a = await arrive('Uniti A', spare[0]);
    const b = await arrive('Uniti B', spare[1]);
    assert.equal((await admin.post(`/checks/${a.check.id}/merge`, { into: b.check.id })).status, 200);
    const followed = await state(a.r.id);
    assert.deepEqual([followed.status, followed.check_id], ['seated', b.check.id]);
  });

  it('isolamento e ruoli: un altro locale non vede nulla; la cucina non entra; gli eventi arrivano al personale', async () => {
    const day = '2026-12-11';
    const staff = await connectWs(server.port, t.host, { cookie: admin.cookie });
    const kds = await connectWs(server.port, t.host, { publicKds: true });
    const r = (await book({ date: day, customer_name: 'Evento' })).body;
    await sleep(120);
    assert.ok(staff.messages.some(m => m.type === 'reservation_updated' && m.reservation.id === r.id));
    assert.deepEqual(kds.types().filter(x => x === 'reservation_updated'), [], 'il KDS pubblico non riceve prenotazioni');
    staff.ws.close(); kds.ws.close();

    assert.deepEqual((await otherApi.get(`/bookings/reservations?date=${day}`)).body, []);
    assert.equal((await otherApi.get(`/bookings/reservations/${r.id}`)).status, 404);
    assert.equal((await kitchen.get(`/bookings/reservations?date=${day}`)).status, 403);
    assert.equal((await sagraApi.get(`/bookings/reservations?date=${day}`)).status, 403);
    assert.equal((await apiClient(server.port, t.host).get(`/bookings/reservations?date=${day}`)).status, 401);
    assert.equal((await waiter.get('/bookings/reservations?date=ieri')).status, 400);
  });

  it('un turno con prenotazioni non si elimina, si disattiva', async () => {
    const res = await admin.request('DELETE', `/bookings/shifts/${dinner.id}`);
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'SHIFT_IN_USE');
    const off = await admin.put(`/bookings/shifts/${dinner.id}`, shift('Cena 19:30', '19:30', { active: false }));
    assert.equal(off.body.active, false);
    assert.equal((await book({})).body.code, 'SHIFT_CLOSED');
  });
});
