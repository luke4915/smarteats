import test from 'node:test';
import assert from 'node:assert/strict';
import { unlockedUntilLabel } from './reservedLabels.js';

test('l\'ora in cui lo sblocco finisce', () => {
  assert.match(unlockedUntilLabel('2026-10-26T21:10:00.000Z'), /^fino alle \d{2}:\d{2}$/);
  assert.equal(unlockedUntilLabel(null), '');
});
