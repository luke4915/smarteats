import test from 'node:test';
import assert from 'node:assert/strict';
import { progressOf, dotState, progressText } from './stepRules.js';

const S = (...done) => ['Ordine', 'Ritiro', 'Dati', 'Pagamento'].map((label, i) => ({ id: String(i), label, done: !!done[i] }));

test('il passo di adesso è il primo non completato; i pallini si riempiono man mano', () => {
  assert.deepEqual(progressOf(S()), { doneCount: 0, total: 4, currentIndex: 0, complete: false, currentLabel: 'Ordine' });
  assert.deepEqual(progressOf(S(1, 1)), { doneCount: 2, total: 4, currentIndex: 2, complete: false, currentLabel: 'Dati' });
  assert.deepEqual(progressOf(S(1, 1, 1, 1)), { doneCount: 4, total: 4, currentIndex: -1, complete: true, currentLabel: null });
});

test('se si torna indietro e si svuota un passo, il pallino si svuota e torna «di adesso»', () => {
  const steps = S(1, 0, 1, 0);                       // il ritiro non c'è più, i dati sì
  assert.equal(progressOf(steps).currentIndex, 1);
  assert.deepEqual([0, 1, 2, 3].map(i => dotState(steps, i)), ['done', 'current', 'done', 'todo']);
});

test('la frase dell\'avanzamento', () => {
  assert.equal(progressText(S(1)), 'Passo 2 di 4: Ritiro');
  assert.equal(progressText(S(1, 1, 1, 1)), 'Tutti i passi completati (4 di 4)');
});
