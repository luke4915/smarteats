// L'impronta del PIN per lo sblocco senza rete: il PIN giusto passa, quelli sbagliati si contano e al quinto si aspetta.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Il test gira in Node: serve un localStorage finto prima di caricare il modulo
const store = new Map();
globalThis.localStorage = {
  getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k),
  key: i => [...store.keys()][i] ?? null, get length() { return store.size; },
};
const { makeVerifier, matchesVerifier, afterLocalFailure, saveVerifier, checkOffline, hasVerifier, dropStaleVerifier, LOCK_MS } = await import('./pinVerifier.js');

describe('impronta del PIN', () => {
  it('riconosce il PIN giusto e non quello sbagliato; il PIN non è scritto in chiaro', async () => {
    const v = await makeVerifier('4815');
    assert.equal(await matchesVerifier(v, '4815'), true);
    assert.equal(await matchesVerifier(v, '4816'), false);
    assert.ok(!JSON.stringify(v).includes('4815'));
  });
  it('due impronte dello stesso PIN sono diverse (sale casuale)', async () => {
    assert.notEqual((await makeVerifier('4815')).hash, (await makeVerifier('4815')).hash);
  });
});

describe('tentativi senza rete', () => {
  it('al quinto errore si blocca per cinque minuti', () => {
    const now = 1_000_000;
    assert.deepEqual(afterLocalFailure(2, now), { failed: 3, lockedUntil: null });
    assert.deepEqual(afterLocalFailure(4, now), { failed: 0, lockedUntil: now + LOCK_MS });
  });
  it('controlla il PIN di un utente: giusto, sbagliato con il conto dei tentativi, poi bloccato', async () => {
    store.clear();
    assert.equal(hasVerifier(7), false);
    assert.equal((await checkOffline(7, '4815')).result, 'none');
    saveVerifier(7, await makeVerifier('4815'));
    assert.equal(hasVerifier(7), true);
    assert.deepEqual(await checkOffline(7, '0000'), { result: 'wrong', attemptsLeft: 4 });
    assert.equal((await checkOffline(7, '4815')).result, 'ok');
    for (let i = 0; i < 4; i++) await checkOffline(7, '0000');
    assert.equal((await checkOffline(7, '0000')).result, 'locked');
    assert.equal((await checkOffline(7, '4815')).result, 'locked', 'bloccato anche col PIN giusto');
  });
});

describe('impronta vecchia', () => {
  it('si butta se il PIN è stato cambiato o tolto, si tiene se è lo stesso', async () => {
    store.clear();
    saveVerifier(3, await makeVerifier('4815'), '2026-11-01T10:00:00Z');
    dropStaleVerifier(3, { hasPin: true, pinSetAt: '2026-11-01T10:00:00Z' });
    assert.equal(hasVerifier(3), true, 'stesso PIN: resta');
    dropStaleVerifier(3, { hasPin: true, pinSetAt: '2026-11-02T09:00:00Z' });
    assert.equal(hasVerifier(3), false, 'PIN cambiato: il vecchio non sblocca più');
    saveVerifier(3, await makeVerifier('4815'), '2026-11-01T10:00:00Z');
    dropStaleVerifier(3, { hasPin: false, pinSetAt: null });
    assert.equal(hasVerifier(3), false, 'PIN tolto');
    assert.equal((await checkOffline(3, '4815')).result, 'none');
  });
});
