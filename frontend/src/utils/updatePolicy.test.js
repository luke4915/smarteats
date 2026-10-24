import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldApplyUpdate, AWAY_MS, IDLE_MS, MAX_WAIT_MS } from './updatePolicy.js';

const base = { waiting: true, pending: 0 };

test('senza versione nuova non si fa nulla', () => {
  assert.equal(shouldApplyUpdate({ ...base, waiting: false, awayMs: AWAY_MS }), false);
});

test('tornando in primo piano dopo una pausa si aggiorna', () => {
  assert.equal(shouldApplyUpdate({ ...base, awayMs: AWAY_MS }), true);
  assert.equal(shouldApplyUpdate({ ...base, awayMs: AWAY_MS - 1 }), false);
});

test('con ordini o stampe in coda non si aggiorna mai', () => {
  assert.equal(shouldApplyUpdate({ ...base, pending: 1, awayMs: AWAY_MS * 10 }), false);
  assert.equal(shouldApplyUpdate({ ...base, pending: 2, waitingMs: MAX_WAIT_MS, idleMs: IDLE_MS }), false);
});

test('una cassa sempre aperta si aggiorna dopo 6 ore, ma solo a schermo fermo', () => {
  assert.equal(shouldApplyUpdate({ ...base, waitingMs: MAX_WAIT_MS, idleMs: IDLE_MS }), true);
  assert.equal(shouldApplyUpdate({ ...base, waitingMs: MAX_WAIT_MS, idleMs: 1000 }), false);
  assert.equal(shouldApplyUpdate({ ...base, waitingMs: MAX_WAIT_MS - 1, idleMs: IDLE_MS }), false);
});
