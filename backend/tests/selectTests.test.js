import test from 'node:test';
import assert from 'node:assert/strict';
import { selectTests } from '../../scripts/select-tests.mjs';

// I test col database «finti»: nome e un po' di testo, quanto basta per capire cosa nominano.
const TESTS = [
  { file: 'takeaway.test.js', text: "client.get('/public/takeaway/info')" },
  { file: 'orders.test.js', text: "post('/orders')" },
  { file: 'checks.test.js', text: "post('/checks') orders" },
  { file: 'rooms.test.js', text: "get('/rooms')" },
];

test('solo documenti: niente da provare', () => {
  assert.deepEqual(selectTests(['docs/rilasci.md', 'README.md', 'CLAUDE.md'], TESTS), { code: false, full: false, integration: [], e2e: [] });
});

test('una schermata: solo i test nel browser che la attraversano, nessun test col database', () => {
  const r = selectTests(['frontend/src/smarteats/floorplan/FloorEditor.jsx'], TESTS);
  assert.deepEqual([r.code, r.full, r.integration, r.e2e], [true, false, [], ['floorplan.spec.js']]);
});

test('un file del backend: i test col database che ne nominano il dominio, e nessun browser', () => {
  const r = selectTests(['backend/utils/takeawayDb.js'], TESTS);
  assert.deepEqual([r.full, r.integration, r.e2e], [false, ['takeaway.test.js'], []]);
});

test('un file del backend che nessun test nomina: tutti i test col database (prudenza)', () => {
  assert.equal(selectTests(['backend/utils/misterioso.js'], TESTS).integration, 'all');
});

test('il cuore del backend e l\'infrastruttura: ciclo completo', () => {
  for (const f of ['backend/db.js', 'backend/middleware/authenticate.js', 'backend/migrations/056_x.sql', 'backend/schema.sql', 'frontend/package-lock.json', '.github/workflows/ci.yml', 'scripts/check.sh']) {
    const r = selectTests([f], TESTS);
    assert.deepEqual([r.full, r.integration, r.e2e], [true, 'all', 'all'], f);
  }
});

test('componenti condivisi o file sconosciuti del frontend: tutti i test nel browser', () => {
  assert.equal(selectTests(['frontend/src/components/shared/Modal.jsx'], TESTS).e2e, 'all');
  assert.equal(selectTests(['frontend/src/index.css'], TESTS).e2e, 'all');
});

test('più file insieme: le scelte si sommano senza doppioni', () => {
  const r = selectTests(['frontend/src/smarteats/takeaway/NewOrder.jsx', 'frontend/src/smarteats/catalog/CatalogPage.jsx', 'frontend/src/smarteats/takeaway/TakeawayPage.jsx'], TESTS);
  assert.deepEqual(r.e2e, ['catalog.spec.js', 'takeaway-shop.spec.js', 'takeaway.spec.js']);
});

test('i test della logica non fanno scattare altro: li lancia già la base', () => {
  const r = selectTests(['frontend/src/utils/whatsNew.test.js', 'backend/tests/pricing.test.js'], TESTS);
  assert.deepEqual([r.code, r.integration, r.e2e], [true, [], []]);
});

test('un test col database o nel browser modificato si lancia da solo', () => {
  const r = selectTests(['backend/tests/integration/rooms.test.js', 'frontend/e2e/legal.spec.js'], TESTS);
  assert.deepEqual([r.integration, r.e2e], [['rooms.test.js'], ['legal.spec.js']]);
});
