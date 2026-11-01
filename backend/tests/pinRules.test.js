import test from 'node:test';
import assert from 'node:assert/strict';
import { isPinFormat, isWeakPin, pinProblem, afterFailure, isLocked, minutesLeft, MAX_FAILURES, LOCK_MS, canSwitchTo } from '../utils/pinRules.js';

test('un PIN è di 4-6 cifre, solo numeri', () => {
  for (const ok of ['4829', '48291', '482916']) assert.equal(isPinFormat(ok), true, ok);
  for (const bad of ['', '123', '1234567', '12a4', ' 4829', '48.29', 4829, null, undefined]) assert.equal(isPinFormat(bad), false, String(bad));
});

test('i PIN banali si rifiutano: cifre uguali e scale', () => {
  for (const weak of ['0000', '1111', '999999', '1234', '4321', '123456', '654321', '2345', '8765']) assert.equal(isWeakPin(weak), true, weak);
  for (const fine of ['4829', '1357', '1212', '1235', '7390']) assert.equal(isWeakPin(fine), false, fine);
});

test('il motivo si dice in italiano, e un PIN buono non ha problemi', () => {
  assert.equal(pinProblem('4829'), null);
  assert.match(pinProblem('12'), /4-6 cifre/);
  assert.match(pinProblem('1234'), /semplice/);
});

test('dopo 5 errori il PIN si blocca per 5 minuti; prima si conta soltanto', () => {
  assert.equal(MAX_FAILURES, 5);
  let state = { failed: 0, lockedUntil: null };
  const now = 1_000_000;
  for (let i = 1; i < MAX_FAILURES; i++) { state = afterFailure(state.failed, now); assert.deepEqual([state.failed, state.lockedUntil], [i, null]); }
  state = afterFailure(state.failed, now);
  assert.equal(state.failed, 0, 'il conteggio riparte');
  assert.equal(state.lockedUntil.getTime(), now + LOCK_MS);
  assert.equal(isLocked(state.lockedUntil, now + 1000), true);
  assert.equal(isLocked(state.lockedUntil, now + LOCK_MS + 1), false, 'passati 5 minuti si può riprovare');
  assert.equal(minutesLeft(state.lockedUntil, now), 5);
  assert.equal(isLocked(null), false);
});

test('admin e responsabile hanno sempre un PIN di 6 cifre; gli altri da 4 a 6', () => {
  assert.equal(pinProblem('4829', 'cashier'), null);
  assert.match(pinProblem('4829', 'admin'), /6 cifre/);
  assert.match(pinProblem('48291', 'manager'), /6 cifre/);
  assert.equal(pinProblem('482916', 'manager'), null);
  assert.equal(pinProblem('4829'), null, 'senza ruolo vale la regola generale');
});

test('il cambio utente veloce: personale operativo sempre, admin e responsabile solo con un PIN di 6 cifre', () => {
  for (const role of ['cashier', 'waiter', 'kitchen']) assert.equal(canSwitchTo(role, 4), true, role);
  for (const role of ['admin', 'manager']) {
    assert.equal(canSwitchTo(role, 6), true, role);
    assert.equal(canSwitchTo(role, 4), false, `${role} con PIN corto`);
    assert.equal(canSwitchTo(role, null), false, `${role} con lunghezza ignota`);
  }
  assert.equal(canSwitchTo('owner', 6), false);
});
