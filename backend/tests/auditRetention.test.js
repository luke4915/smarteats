import test from 'node:test';
import assert from 'node:assert/strict';
import { retentionDays, DEFAULT_RETENTION_DAYS } from '../utils/auditRetention.js';

test('si tengono 60 giorni di partenza; AUDIT_RETENTION_DAYS cambia il numero se è ragionevole', () => {
  assert.equal(DEFAULT_RETENTION_DAYS, 60);
  assert.equal(retentionDays({}), 60);
  assert.equal(retentionDays({ AUDIT_RETENTION_DAYS: '90' }), 90);
  assert.equal(retentionDays({ AUDIT_RETENTION_DAYS: '365' }), 365);
});

test('un valore sbagliato non azzera il registro: sotto i 7 giorni, non intero o non numero si torna a 60', () => {
  for (const bad of ['0', '1', '6', '-5', '2.5', 'abc', '', '99999']) assert.equal(retentionDays({ AUDIT_RETENTION_DAYS: bad }), 60, `«${bad}»`);
});
