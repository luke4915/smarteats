import test from 'node:test';
import assert from 'node:assert/strict';
import { orderNumber, nextServerNumber } from '../utils/orderNumber.js';

test('una cassa numera con la sua lettera e il suo progressivo', () => {
  assert.deepEqual(orderNumber({ letter: 'A', deviceSeq: 1 }), { number: 1, code: 'A1' });
  assert.deepEqual(orderNumber({ letter: 'B', deviceSeq: 137 }), { number: 137, code: 'B137' });
  assert.deepEqual(orderNumber({ letter: 'A', deviceSeq: 2600 }), { number: 2600, code: 'A2600' }, 'oltre 100 non si riparte: A101, A102…');
});

test('il server numera col progressivo della serata, senza lettera', () => {
  assert.deepEqual(orderNumber({ counter: 1 }), { number: 1, code: '1' });
  assert.deepEqual(orderNumber({ counter: 101 }), { number: 101, code: '101' });
});

test('il numero è sempre un intero uguale in entrambe le fonti', () => {
  assert.equal(orderNumber({ letter: 'C', deviceSeq: 7 }).number, orderNumber({ counter: 7 }).number);
});

test('nextServerNumber incrementa il progressivo della serata e dà il numero nuovo', async () => {
  const calls = [];
  const db = { query: async (sql, params) => { calls.push([sql, params]); return { rows: [{ order_counter: 12 }] }; } };
  assert.deepEqual(await nextServerNumber(db, 5), { number: 12, code: '12' });
  assert.match(calls[0][0], /UPDATE sessions SET order_counter = order_counter \+ 1 WHERE id = \$1 RETURNING order_counter/);
  assert.deepEqual(calls[0][1], [5]);
});
