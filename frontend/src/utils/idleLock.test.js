// Il blocco automatico: scatta solo se è acceso e il tempo è passato.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { shouldAutoLock, isAutoLockChoice, autoLockLabel } from './idleLock.js';

describe('blocco automatico', () => {
  const t0 = 1_000_000;
  it('spento (0) non blocca mai', () => assert.equal(shouldAutoLock(0, t0, t0 + 10 * 3_600_000), false));
  it('blocca dopo i minuti scelti senza toccare nulla, non prima', () => {
    assert.equal(shouldAutoLock(5, t0, t0 + 4 * 60_000), false);
    assert.equal(shouldAutoLock(5, t0, t0 + 5 * 60_000), true);
  });
  it('accetta solo le scelte previste', () => {
    assert.equal(isAutoLockChoice(15), true);
    assert.equal(isAutoLockChoice(7), false);
    assert.equal(autoLockLabel(0), 'Mai');
    assert.equal(autoLockLabel(5), '5 min');
  });
});
