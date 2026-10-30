import test from 'node:test';
import assert from 'node:assert/strict';
import { latestSeen, isLocked, minutesLeft, clockWentBack } from './licenseLock.js';

const T = (iso) => Date.parse(iso);
const license = { expiresAt: '2026-10-29T12:00:00.000Z', offlineUntil: '2026-10-29T22:00:00.000Z' };

test('senza scadenza la cassa non si blocca mai', () => {
  assert.equal(isLocked(null, T('2030-01-01T00:00:00Z')), false);
  assert.equal(isLocked({ expiresAt: null, offlineUntil: null }, T('2030-01-01T00:00:00Z')), false);
  assert.equal(minutesLeft({ offlineUntil: null }, 0), null);
});

test('si lavora fino alle dieci ore dopo la scadenza, poi si blocca', () => {
  assert.equal(isLocked(license, T('2026-10-29T11:00:00Z')), false, 'prima della scadenza');
  assert.equal(isLocked(license, T('2026-10-29T21:59:00Z')), false, 'nelle ore di tolleranza');
  assert.equal(isLocked(license, T('2026-10-29T22:00:01Z')), true);
});

test('riportare indietro l\'orologio non sblocca: conta l\'istante più avanzato già visto', () => {
  const seen = latestSeen({ now: T('2026-10-29T09:00:00Z'), lastSeen: T('2026-10-29T23:00:00Z') });
  assert.equal(seen, T('2026-10-29T23:00:00Z'));
  assert.equal(isLocked(license, seen), true);
  assert.equal(latestSeen({ now: T('2026-10-29T09:00:00Z'), lastSeen: 0, serverTime: '2026-10-29T23:30:00Z' }), T('2026-10-29T23:30:00Z'), 'l\'ora del server vale più di quella del dispositivo');
  assert.equal(latestSeen({ now: 5, lastSeen: null }), 5);
});

test('quanto manca allo stop, in minuti', () => {
  assert.equal(minutesLeft(license, T('2026-10-29T21:00:00Z')), 60);
  assert.equal(minutesLeft(license, T('2026-10-29T23:00:00Z')), 0);
});

test('un orologio rimasto indietro si segnala solo oltre cinque minuti', () => {
  assert.equal(clockWentBack(T('2026-10-29T10:00:00Z'), T('2026-10-29T10:03:00Z')), false);
  assert.equal(clockWentBack(T('2026-10-29T10:00:00Z'), T('2026-10-29T11:00:00Z')), true);
  assert.equal(clockWentBack(T('2026-10-29T10:00:00Z'), 0), false);
});
