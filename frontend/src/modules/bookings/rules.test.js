import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todayLocal, addDays, formatDay, agendaGroups, tableTakenBy, suggestTables, gapBetween, tablesConnected, nextByTable, whatsappLink, mailLink, telLink, isActive } from './rules.js';

const res = (id, status, start, extra = {}) => ({ id, status, date: '2026-10-23', start_time: start, duration_minutes: 90, table_ids: [], ...extra });

test('date: oggi, giorni avanti e indietro, formato', () => {
  assert.equal(todayLocal(new Date(2026, 9, 5)), '2026-10-05');
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(formatDay('2026-10-23'), 'venerdì 23 ottobre');
});

test('agenda: prima da confermare, poi confermate, sedute, chiuse; i gruppi vuoti non compaiono', () => {
  const list = [res(1, 'confirmed', '19:30'), res(2, 'requested', '19:30'), res(3, 'cancelled', '21:00'), res(4, 'seated', '19:30'), res(5, 'expired', '19:30')];
  const groups = agendaGroups(list);
  assert.deepEqual(groups.map(g => [g.key, g.items.map(r => r.id)]), [['requested', [2]], ['confirmed', [1]], ['seated', [4]], ['closed', [3, 5]]]);
  assert.deepEqual(agendaGroups([res(1, 'confirmed', '19:30')]).map(g => g.key), ['confirmed']);
  assert.deepEqual(agendaGroups([]), []);
  assert.deepEqual(['requested', 'confirmed', 'seated', 'declined'].map(isActive), [true, true, true, false]);
});

test('tavoli: occupato solo da una prenotazione attiva con orario sovrapposto', () => {
  const mine = res(1, 'confirmed', '21:00');
  const others = [res(2, 'confirmed', '19:30', { table_ids: [5] }), res(3, 'cancelled', '21:00', { table_ids: [6] }), res(4, 'confirmed', '20:30', { table_ids: [7] }), res(5, 'confirmed', '21:00', { table_ids: [8], date: '2026-10-24' })];
  assert.equal(tableTakenBy(5, mine, others), null, '19:30 + 90 minuti finisce alle 21:00: il tavolo è libero');
  assert.equal(tableTakenBy(6, mine, others), null, 'annullata');
  assert.equal(tableTakenBy(7, mine, others)?.id, 4, 'orari che si accavallano');
  assert.equal(tableTakenBy(8, mine, others), null, 'altro giorno');
  assert.equal(tableTakenBy(7, res(4, 'confirmed', '20:30', { table_ids: [7] }), others), null, 'non confligge con se stessa');
});

test('Sala: per ogni tavolo la prossima prenotazione confermata', () => {
  const list = [res(1, 'confirmed', '21:00', { table_ids: [5, 6] }), res(2, 'confirmed', '19:30', { table_ids: [5] }), res(3, 'seated', '19:00', { table_ids: [7] }), res(4, 'requested', '19:00', { table_ids: [8] })];
  const map = nextByTable(list);
  assert.equal(map.get(5).id, 2);
  assert.equal(map.get(6).id, 1);
  assert.equal(map.has(7), false, 'già seduta');
  assert.equal(map.has(8), false, 'solo una richiesta');
});

test('collegamenti per il messaggio', () => {
  assert.equal(whatsappLink('333 123 4567', 'Ciao a tutti'), 'https://wa.me/393331234567?text=Ciao%20a%20tutti');
  assert.equal(whatsappLink('+44 20 7946 0958', 'x'), 'https://wa.me/442079460958?text=x');
  assert.equal(whatsappLink('0039 333 1', 'x'), 'https://wa.me/393331?text=x');
  assert.equal(whatsappLink('', 'x'), null);
  assert.equal(telLink('333 123 4567'), 'tel:3331234567');
  assert.equal(telLink(' '), null);
  assert.equal(mailLink('a@b.it', 'Conferma', 'Ciao & grazie'), 'mailto:a@b.it?subject=Conferma&body=Ciao%20%26%20grazie');
  assert.equal(mailLink('', 's', 't'), null);
});

const at = (id, seats, x, y, extra = {}) => ({ id, seats, roomId: 1, x, y, w: 2, h: 2, ...extra });

test('tavolo consigliato: il più piccolo che basta (meno posti sprecati)', () => {
  const free = [at(1, 2, 0, 0), at(2, 6, 4, 0), at(3, 4, 8, 0), at(4, 5, 12, 0)];
  assert.deepEqual(suggestTables(4, free), { ids: [3], seats: 4, seatsMin: 4, waste: 0, under: false });
  assert.deepEqual(suggestTables(3, free), { ids: [3], seats: 4, seatsMin: 4, waste: 1, under: false }, 'tre persone: il da 4, non il da 6');
  assert.deepEqual(suggestTables(1, free), { ids: [1], seats: 2, seatsMin: 2, waste: 1, under: false });
});

test('tavoli vicini: si uniscono solo se sono a pochi passi, non agli antipodi della sala', () => {
  // T1 e T4 hanno i posti giusti ma sono in capi opposti della sala; T1 e T2 sono affiancati
  const free = [at(1, 4, 0, 0), at(2, 4, 3, 0), at(3, 4, 20, 0), at(4, 4, 20, 8)];
  assert.deepEqual(suggestTables(8, free), { ids: [1, 2], seats: 8, seatsMin: 8, waste: 0, under: false });
  // senza una coppia vicina non si suggerisce nulla (si sceglie a mano)
  assert.equal(suggestTables(8, [at(1, 4, 0, 0), at(3, 4, 20, 0)]), null);
  // tra due coppie vicine vince quella con meno posti sprecati
  assert.deepEqual(suggestTables(7, [at(1, 4, 0, 0), at(2, 4, 3, 0), at(3, 6, 10, 0), at(4, 4, 13, 0)]), { ids: [1, 2], seats: 8, seatsMin: 8, waste: 1, under: false });
});

test('tavoli vicini: gap, connessione e tavoli non piazzati', () => {
  assert.equal(gapBetween({ x: 0, y: 0, w: 2, h: 2 }, { x: 2, y: 0, w: 2, h: 2 }), 0, 'affiancati');
  assert.equal(gapBetween({ x: 0, y: 0, w: 2, h: 2 }, { x: 4, y: 3, w: 2, h: 2 }), 3);
  assert.equal(gapBetween({ x: null, y: null, w: null, h: null }, { x: 0, y: 0, w: 2, h: 2 }), Infinity);
  const row = [at(1, 4, 0, 0), at(2, 4, 3, 0), at(3, 4, 6, 0)];
  assert.equal(tablesConnected(row), true, 'a catena: 1-2 e 2-3 sono vicini');
  assert.equal(tablesConnected([row[0], row[2]]), false, 'il primo e il terzo da soli sono troppo lontani');
  assert.equal(tablesConnected([row[0]]), true);
  assert.equal(suggestTables(4, [at(1, 4, null, null, { w: null, h: null })]).ids[0], 1, 'un tavolo non piazzato va bene da solo');
  assert.equal(suggestTables(8, [at(1, 4, null, null, { w: null, h: null }), at(2, 4, 0, 0)]), null, 'ma non si unisce');
});

test('tavolo consigliato: a parità di tutto vince la sala indicata', () => {
  const free = [at(1, 4, 0, 0), { ...at(2, 4, 0, 0), roomId: 2 }];
  assert.deepEqual(suggestTables(4, free, { preferRoomId: 2 }).ids, [2]);
  assert.deepEqual(suggestTables(4, free).ids, [1]);
});

test('intervalli: il tavolo dove il gruppo sta nell\'intervallo vince; sotto il minimo si siede lo stesso', () => {
  const range = (id, min, max, x, extra = {}) => ({ ...at(id, max, x, 0, extra), seatsMin: min });
  // 5 persone: il «4–6» è perfetto; il «2–4» non basta; l'«8–10» è troppo grande
  const free = [range(1, 2, 4, 0), range(2, 4, 6, 4), range(3, 8, 10, 8)];
  assert.deepEqual(suggestTables(5, free), { ids: [2], seats: 6, seatsMin: 4, waste: 1, under: false });
  // 2 persone: il «2–4» (sotto di niente) batte il «4–6» (sotto di 2)
  assert.deepEqual(suggestTables(2, free).ids, [1]);
  // 2 persone con solo tavoli grandi: ci si siede lo stesso, al meno peggio, e il risultato lo dice (`under`)
  const big = suggestTables(2, [range(2, 4, 6, 4), range(3, 8, 10, 8)]);
  assert.deepEqual([big.ids, big.under], [[2], true]);
  // gruppo oltre tutti i tavoli singoli: si uniscono tavoli vicini, i minimi e i massimi si sommano
  const joined = suggestTables(9, [range(1, 4, 6, 0), range(2, 4, 6, 3), range(3, 2, 2, 20)]);
  assert.deepEqual([joined.ids, joined.seatsMin, joined.seats], [[1, 2], 8, 12]);
});

test('4 persone: meglio due tavoli piccoli vicini di un tavolo enorme', () => {
  const free = [{ ...at(1, 2, 0, 0), seatsMin: 2 }, { ...at(2, 2, 3, 0), seatsMin: 2 }, { ...at(3, 10, 10, 0), seatsMin: 8 }];
  assert.deepEqual(suggestTables(4, free).ids, [1, 2]);
});

test('un gruppo grande una sistemazione la trova anche con molti tavoli piccoli (fino a 5 uniti)', () => {
  const free = [1, 2, 3, 4, 5].map(i => at(i, 2, (i - 1) * 3, 0));
  assert.equal(suggestTables(10, free)?.ids.length, 5);
  assert.equal(suggestTables(11, free), null, 'oltre tutti i posti non c\'è nulla da suggerire');
});
