import test from 'node:test';
import assert from 'node:assert/strict';

// migrations/run.js (db:baseline e migrate) importa `appConnectionConfig` da db.js. Se la tolgono come «export non usato»
// le migrazioni non partono più (è successo: CI rossa su backend ed e2e): questo test lo impedisce.
test('db.js esporta appConnectionConfig, usata da migrations/run.js', async () => {
  const db = await import('../db.js');
  assert.equal(typeof db.appConnectionConfig, 'object');
  assert.ok('user' in db.appConnectionConfig && 'database' in db.appConnectionConfig);
});
