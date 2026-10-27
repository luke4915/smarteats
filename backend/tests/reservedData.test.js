import test from 'node:test';
import assert from 'node:assert/strict';
import { reservedState, maskReservedKeys, UNLOCK_SECONDS } from '../utils/reservedData.js';

const NOW = 1_800_000_000;

test('blocco spento: i dati non sono mai bloccati', () => {
  assert.deepEqual(reservedState({ lockEnabled: false, reservedUntil: undefined }, NOW), { enabled: false, unlocked: false, locked: false, unlockedUntil: null });
});

test('blocco acceso: bloccato finché la sessione non è sbloccata, poi di nuovo allo scadere', () => {
  assert.equal(reservedState({ lockEnabled: true, reservedUntil: undefined }, NOW).locked, true);
  const open = reservedState({ lockEnabled: true, reservedUntil: NOW + UNLOCK_SECONDS }, NOW);
  assert.deepEqual([open.locked, open.unlocked, open.unlockedUntil], [false, true, new Date((NOW + UNLOCK_SECONDS) * 1000).toISOString()]);
  assert.equal(reservedState({ lockEnabled: true, reservedUntil: NOW + 1 }, NOW).locked, false);
  assert.equal(reservedState({ lockEnabled: true, reservedUntil: NOW }, NOW).locked, true, 'allo scadere si richiude');
  assert.equal(reservedState({ lockEnabled: true, reservedUntil: 'tra poco' }, NOW).locked, true, 'un valore strano non sblocca');
});

test('i campi con i costi diventano null, anche annidati; il resto non cambia', () => {
  const body = [{ id: 1, name: 'Olio', weighted_average_cost: 0.9, items: [{ unit_cost_cents: 3600, vat_rate: 10 }], when: new Date(0) }, { total_cost_cents: 100, lines: 2 }];
  assert.deepEqual(maskReservedKeys(body), [{ id: 1, name: 'Olio', weighted_average_cost: null, items: [{ unit_cost_cents: null, vat_rate: 10 }], when: new Date(0) }, { total_cost_cents: null, lines: 2 }]);
  assert.equal(body[0].weighted_average_cost, 0.9, 'l\'originale non si tocca');
  assert.equal(maskReservedKeys(null), null);
  assert.equal(maskReservedKeys('testo'), 'testo');
});
