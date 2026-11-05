// Lo stato della licenza a parole: attiva, in scadenza, scaduta con ore di tolleranza, scaduta del tutto.
import test from 'node:test';
import assert from 'node:assert/strict';
import { licenseStatus, formatLeft, licenseMessage } from './licenseStatus.js';

const HOUR = 3_600_000, DAY = 24 * HOUR;
const now = Date.parse('2026-11-05T12:00:00Z');
const license = (expiresInMs) => ({ expiresAt: new Date(now + expiresInMs).toISOString(), offlineUntil: new Date(now + expiresInMs + 10 * HOUR).toISOString() });

test('senza scadenza non c\'è niente da dire', () => assert.equal(licenseStatus(null, now).kind, 'none'));

test('attiva, poi «in scadenza» nelle ultime due settimane', () => {
  assert.equal(licenseStatus(license(60 * DAY), now).kind, 'ok');
  assert.deepEqual(licenseStatus(license(10 * DAY), now).days, 10);
  assert.equal(licenseStatus(license(10 * DAY), now).kind, 'soon');
});

test('scaduta: per 10 ore si lavora ancora senza rete, poi serve internet', () => {
  const grace = licenseStatus(license(-2 * HOUR), now);
  assert.deepEqual([grace.kind, grace.minutesLeft], ['grace', 8 * 60]);
  assert.equal(licenseStatus(license(-11 * HOUR), now).kind, 'expired');
});

test('i tempi si leggono bene', () => {
  assert.equal(formatLeft(45), '45 minuti');
  assert.equal(formatLeft(60), '1 ora');
  assert.equal(formatLeft(200), '3 ore e 20 minuti');
  assert.match(licenseMessage(licenseStatus(license(-2 * HOUR), now)).detail, /8 ore/);
});
