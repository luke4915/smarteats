import test from 'node:test';
import assert from 'node:assert/strict';
import { OFFLINE_GRACE_HOURS, licenseInfo, lateSyncAllowed, isLateOrderSync } from '../utils/license.js';

const T = (iso) => new Date(iso).getTime();
const expires = '2026-10-29T12:00:00Z';

test('dieci ore di lavoro senza rete dopo la scadenza', () => {
  assert.equal(OFFLINE_GRACE_HOURS, 10);
  const info = licenseInfo(expires, T('2026-10-29T08:00:00Z'));
  assert.deepEqual(info, { expiresAt: '2026-10-29T12:00:00.000Z', offlineUntil: '2026-10-29T22:00:00.000Z', serverTime: '2026-10-29T08:00:00.000Z' });
});

test('una licenza senza scadenza non ha limiti', () => {
  assert.deepEqual([licenseInfo(null).expiresAt, licenseInfo(null).offlineUntil], [null, null]);
  assert.equal(lateSyncAllowed(null, '2026-10-29T12:00:00Z'), false, 'ma non c\'è nulla da «accettare dopo la scadenza»');
});

test('un ordine battuto offline si accetta se è dentro le dieci ore dopo la scadenza', () => {
  const now = T('2026-10-30T09:00:00Z');
  assert.equal(lateSyncAllowed(expires, '2026-10-29T11:59:00Z', now), true, 'prima della scadenza');
  assert.equal(lateSyncAllowed(expires, '2026-10-29T21:59:00Z', now), true, 'nelle dieci ore di tolleranza');
  assert.equal(lateSyncAllowed(expires, '2026-10-29T22:00:01Z', now), false, 'oltre le dieci ore');
  assert.equal(lateSyncAllowed(expires, '2026-10-31T10:00:00Z', now), false, 'un orario nel futuro non vale');
  assert.equal(lateSyncAllowed(expires, 'non una data', now), false);
  assert.equal(lateSyncAllowed(expires, undefined, now), false);
});

test('a licenza scaduta passa solo l\'invio di un ordine battuto offline', () => {
  const base = { method: 'POST', baseUrl: '/api/orders', path: '/', body: { session_id: 3, client_order_id: 'x', client_created_at: '2026-10-29T10:00:00Z' } };
  assert.equal(isLateOrderSync(base), true);
  assert.equal(isLateOrderSync({ ...base, body: { ...base.body, session_id: undefined } }), false, 'un ordine normale (sessione aperta) no');
  assert.equal(isLateOrderSync({ ...base, body: { ...base.body, client_order_id: undefined } }), false);
  assert.equal(isLateOrderSync({ ...base, method: 'GET' }), false);
  assert.equal(isLateOrderSync({ ...base, baseUrl: '/api/products' }), false, 'nient\'altro');
});
