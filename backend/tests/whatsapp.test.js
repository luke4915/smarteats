import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EVENTS, EVENT_IDS, templateName, renderBody, normalizeMobile, sendAtFor, nextAttempt, staleReason, dayLabel, euro, thanksSendAt, classifyInbound, inboundReply, needsMarketingConsent } from '../utils/whatsapp.js';

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
  assert.equal(EVENT_IDS.length, 15);
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

test('«grazie»: 2 ore dopo la fine del turno; dopo le 22:30 la mattina dopo alle 10:00', () => {
  // d'estate Roma è UTC+2: fine turno 21:00 locale = 19:00Z → 23:00 locale: troppo tardi → il giorno dopo alle 10:00 (08:00Z)
  assert.equal(thanksSendAt(new Date('2026-07-10T19:00:00Z')).toISOString(), '2026-07-11T08:00:00.000Z');
  // fine turno 14:30 locale = 12:30Z → 16:30 locale = 14:30Z
  assert.equal(thanksSendAt(new Date('2026-07-10T12:30:00Z')).toISOString(), '2026-07-10T14:30:00.000Z');
  // fine turno 20:30 locale (18:30Z) → 22:30 locale esatto: si manda
  assert.equal(thanksSendAt(new Date('2026-07-10T18:30:00Z')).toISOString(), '2026-07-10T20:30:00.000Z');
  // d'inverno (UTC+1): fine turno 22:00 locale = 21:00Z → 00:00 locale: aspetta le 10:00 dello stesso giorno (09:00Z)
  assert.equal(thanksSendAt(new Date('2026-01-14T21:00:00Z')).toISOString(), '2026-01-15T09:00:00.000Z');
});

test('«grazie» è marketing: serve un consenso separato; gli avvisi no', () => {
  assert.equal(EVENTS['reservation.thanks'].category, 'marketing');
  assert.equal(needsMarketingConsent('reservation.thanks'), true);
  assert.equal(needsMarketingConsent('reservation.confirmed'), false);
  assert.equal(staleReason('reservation.thanks', { status: 'completed' }), null);
  assert.equal(staleReason('reservation.thanks', { status: 'confirmed' }), 'STATO_CAMBIATO');
});

test('messaggi in arrivo: STOP, RIPRENDI e tutto il resto', () => {
  for (const t of ['STOP', ' stop ', 'Stop!', 'basta', 'Annulla iscrizione', 'CANCELLAMI']) assert.equal(classifyInbound(t), 'optout', t);
  for (const t of ['riprendi', 'START', 'Riattiva']) assert.equal(classifyInbound(t), 'optin', t);
  for (const t of ['ciao', 'vorrei cambiare orario', 'stop ai ritardi', '', null]) assert.equal(classifyInbound(t), 'other', String(t));
  assert.match(inboundReply('other', { locale: 'Pizzeria Rossi', phone: '0123 456789' }), /Per parlare con Pizzeria Rossi chiama il 0123 456789/);
  assert.match(inboundReply('other', {}), /contattalo direttamente/);
  assert.match(inboundReply('optout'), /non riceverai più avvisi/);
  assert.match(inboundReply('optin'), /riceverai di nuovo/);
});
