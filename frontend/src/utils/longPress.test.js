import test from 'node:test';
import assert from 'node:assert/strict';
import { LONG_PRESS_MS, pressProgress, pressFired, pressSwallowsClick } from './longPress.js';

test('la pressione lunga scatta a un secondo, non prima', () => {
  assert.equal(LONG_PRESS_MS, 1000);
  assert.equal(pressFired(999), false);
  assert.equal(pressFired(1000), true);
});

test('un tocco normale non fa comparire il riempimento; poi cresce fino a 100', () => {
  assert.equal(pressProgress(0), 0);
  assert.equal(pressProgress(120), 0, 'un tocco veloce non disegna nulla');
  assert.equal(pressProgress(500), 50);
  assert.equal(pressProgress(1000), 100);
  assert.equal(pressProgress(4000), 100, 'mai oltre 100');
});

test('un tocco lento (fino a mezzo secondo) aggiunge ancora il prodotto; più a lungo è un ripensamento', () => {
  assert.equal(pressSwallowsClick(80), false);
  assert.equal(pressSwallowsClick(400), false, 'dito lento o con i guanti: vale come tocco');
  assert.equal(pressSwallowsClick(650), true, 'tenuto premuto e rilasciato prima dello scatto: non aggiunge');
  assert.equal(pressSwallowsClick(1200), true, 'scattata: il tocco normale non si esegue');
});
