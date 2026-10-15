import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EVENTS, EVENT_IDS, templateName, renderBody, normalizeMobile, sendAtFor, nextAttempt, staleReason, dayLabel, euro } from '../utils/whatsapp.js';

test('numeri: cellulari italiani in vari modi, fissi e numeri non validi', () => {
  for (const n of ['333 123 4567', '3331234567', '+39 333 1234567', '0039 333 123 4567', '39 333 1234567', '(+39) 333-123-4567'])
    assert.equal(normalizeMobile(n), '393331234567', n);
  assert.equal(normalizeMobile('0123 456789'), null, 'un fisso non riceve WhatsApp');
  assert.equal(normalizeMobile('+39 02 1234567'), null);
  assert.equal(normalizeMobile('12345'), null);
  assert.equal(normalizeMobile(''), null);
  assert.equal(normalizeMobile(null), null);
  assert.equal(normalizeMobile('+44 7911 123456'), '447911123456', 'un cellulare estero con prefisso passa');
});

test('ogni evento ha testo, variabili coerenti e un nome di modello', () => {
  assert.equal(EVENT_IDS.length, 14);
  for (const id of EVENT_IDS) {
    const e = EVENTS[id];
    const placeholders = [...e.body.matchAll(/\{\{(\d+)\}\}/g)].map(m => Number(m[1]));
    assert.deepEqual([...new Set(placeholders)].sort(), e.vars.map((_, i) => i + 1), `${id}: i segnaposto sono 1..n`);
    assert.match(templateName(id), /^se_[a-z_]+_v1$/);
  }
  assert.equal(templateName('reservation.confirmed'), 'se_reservation_confirmed_v1');
  assert.equal(EVENTS['takeaway.picked_up'].on, false, '«ritirato» spento di partenza');
});

test('anteprima del testo', () => {
  assert.equal(renderBody('reservation.confirmed', ['Marta', 'venerdì 23 ottobre', '20:00', 4]),
    'Ciao Marta, la tua prenotazione è confermata: venerdì 23 ottobre alle 20:00, 4 persone. A presto!');
  assert.equal(dayLabel('2026-10-23'), 'venerdì 23 ottobre');
  assert.equal(euro(12.5), '12,50 €');
});

test('tempi: «ricevuta» dopo 2 minuti, promemoria 3 ore prima, mai se la conferma è troppo vicina', () => {
  const now = new Date('2026-10-23T10:00:00Z');
  assert.equal(sendAtFor('reservation.received', { now }).toISOString(), '2026-10-23T10:02:00.000Z');
  assert.equal(sendAtFor('takeaway.received', { now }).toISOString(), '2026-10-23T10:02:00.000Z');
  assert.equal(sendAtFor('reservation.reminder', { now, startsAt: new Date('2026-10-23T18:00:00Z') }).toISOString(), '2026-10-23T15:00:00.000Z');
  assert.equal(sendAtFor('reservation.reminder', { now, startsAt: new Date('2026-10-23T12:00:00Z') }), null, 'mancano 2 ore: niente promemoria');
  assert.equal(sendAtFor('reservation.confirmed', { now }).getTime(), now.getTime());
});

test('tentativi: attese crescenti, poi basta', () => {
  const now = new Date('2026-10-23T10:00:00Z');
  assert.equal(nextAttempt(0, now).toISOString(), '2026-10-23T10:01:00.000Z');
  assert.equal(nextAttempt(2, now).toISOString(), '2026-10-23T10:15:00.000Z');
  assert.equal(nextAttempt(4, now).toISOString(), '2026-10-23T13:00:00.000Z');
  assert.equal(nextAttempt(5, now), null);
});

test('un avviso non parte se la pratica nel frattempo è cambiata', () => {
  assert.equal(staleReason('reservation.received', { status: 'requested' }), null);
  assert.equal(staleReason('reservation.received', { status: 'confirmed' }), 'GIA_GESTITA');
  assert.equal(staleReason('reservation.reminder', { status: 'cancelled' }), 'STATO_CAMBIATO');
  assert.equal(staleReason('takeaway.received', { status: 'accepted' }), 'GIA_GESTITA');
  assert.equal(staleReason('takeaway.ready', { status: 'picked_up' }), 'STATO_CAMBIATO');
  assert.equal(staleReason('takeaway.accepted', { status: 'picked_up' }), null);
});
