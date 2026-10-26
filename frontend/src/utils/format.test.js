import test from 'node:test';
import assert from 'node:assert/strict';
import { formatEuro, formatCents, formatMin, formatElapsed, RESERVED_TEXT } from './format.js';

// Intl separa numero e simbolo con uno spazio che non va a capo: nei confronti si riduce a uno spazio normale.
const plain = (text) => text.replace(/\u00a0/g, ' ');

test('gli importi si scrivono all\'italiana, con la virgola', () => {
  assert.equal(plain(formatEuro(4.5)), '4,50 €');
  assert.equal(plain(formatEuro(0)), '0,00 €');
  assert.equal(plain(formatEuro('17.5')), '17,50 €', 'anche se arriva come testo (PostgreSQL manda i decimali così)');
  assert.equal(plain(formatEuro(12345.6)), '12.345,60 €');
  assert.equal(plain(formatEuro(undefined)), '0,00 €');
});

test('un importo riservato (null) si legge come puntini, mai come zero', () => {
  assert.equal(formatCents(null), RESERVED_TEXT);
  assert.equal(formatCents(undefined), RESERVED_TEXT);
  assert.notEqual(formatCents(0), RESERVED_TEXT, 'zero è un importo vero');
  assert.equal(plain(formatCents(1250)), '12,50 €');
});

test('minuti con un decimale e durate compatte', () => {
  assert.equal(formatMin(36.5), '36,5 min');
  assert.equal(formatMin(0), '0,0 min');
  assert.equal(formatElapsed(47), "47'");
  assert.equal(formatElapsed(60), '1 h');
  assert.equal(formatElapsed(117), "1 h 57'");
  assert.equal(formatElapsed(1519), "25 h 19'");
  assert.equal(formatElapsed(-3), "0'");
});
