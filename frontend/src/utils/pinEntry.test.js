// Il tastierino del PIN e la verifica senza rete, provati con esempi.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pressKey, canSubmit, failureText, pinFitsRole } from './pinEntry.js';

describe('tastierino del PIN', () => {
  it('le cifre si aggiungono fino a sei, poi i tasti non fanno nulla', () => {
    assert.equal(['4', '8', '1', '5', '9', '3', '7'].reduce(pressKey, ''), '481593');
  });
  it('«cancella» toglie l\'ultima cifra e non si rompe a vuoto', () => {
    assert.equal(pressKey('4815', 'back'), '481');
    assert.equal(pressKey('', 'back'), '');
  });
  it('si può confermare solo da quattro a sei cifre', () => {
    assert.equal(canSubmit('481'), false);
    assert.equal(canSubmit('4815'), true);
    assert.equal(canSubmit('481593'), true);
  });
  it('per admin e responsabile il PIN è di sei cifre, per gli altri da quattro a sei', () => {
    assert.equal(pinFitsRole('4826', 'cashier'), true);
    assert.equal(pinFitsRole('4826', 'admin'), false);
    assert.equal(pinFitsRole('482609', 'manager'), true);
    assert.equal(pinFitsRole('482', 'cashier'), false);
  });
  it('i messaggi di errore dicono quanti tentativi restano o quando riprovare', () => {
    assert.match(failureText({ result: 'wrong', attemptsLeft: 1 }), /1 tentativo prima del blocco/);
    assert.match(failureText({ result: 'wrong', attemptsLeft: 3 }), /3 tentativi/);
    assert.match(failureText({ result: 'locked', minutes: 5 }), /5 minuti.*password/);
  });
});
