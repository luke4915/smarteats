import { test } from 'node:test';
import assert from 'node:assert/strict';
import { itemsFromQr, encodeCart, decodeCart } from './qrCart.js';

const products = [{ id: 1, name: 'Panino', price: '5.00', category: 'Cibo' }, { id: 2, name: 'Birra', price: '4.00' }];

test('nome e prezzo vengono dal catalogo, non dal QR', () => {
  const [item] = itemsFromQr([{ id: 1, name: 'Gratis', price: 0, quantity: 2, type: 'gift' }], products);
  assert.equal(item.name, 'Panino');
  assert.equal(item.price, '5.00');
  assert.equal(item.quantity, 2);
  assert.equal(item.type, 'sale');
});

test('prodotti sconosciuti e quantità non valide si scartano', () => {
  const items = itemsFromQr([{ id: 99, quantity: 1 }, { id: 1, quantity: 0 }, { id: 2, quantity: -3 }, { id: 2, quantity: 'x' }, null, { id: 2, quantity: 5000 }], products);
  assert.deepEqual(items.map(i => [i.id, i.quantity]), [[2, 999]]);
});

test('contenuto che non è un elenco: nessuna riga', () => {
  assert.deepEqual(itemsFromQr({ id: 1 }, products), []);
});

test('il QR compatto: scrive id e quantità, la quantità 1 si omette', () => {
  assert.equal(encodeCart([{ id: 1204, quantity: 2 }, { id: 1207, quantity: 1 }, { id: 1311, quantity: 3 }]), 'SE1:1204*2+1207+1311*3');
  assert.equal(encodeCart([]), '');
});

test('il QR compatto si rilegge uguale, e usa solo i caratteri della modalità alfanumerica (testo corto)', () => {
  const lines = [{ id: 1204, quantity: 2 }, { id: 7, quantity: 1 }, { id: 99999, quantity: 12 }];
  const text = encodeCart(lines);
  assert.deepEqual(decodeCart(text), lines);
  assert.match(text, /^[0-9A-Z $%*+\-./:]+$/);
});

test('la cassa legge ancora il formato di prima (JSON in base64)', () => {
  const old = btoa(JSON.stringify([{ id: 1, quantity: 2 }, { id: 2, quantity: 1 }]));
  assert.deepEqual(decodeCart(old), [{ id: 1, quantity: 2 }, { id: 2, quantity: 1 }]);
});

test('un QR che non è un ordine non si legge: nessuna eccezione', () => {
  for (const bad of ['', 'https://example.com', 'SE1:', 'SE1:12*a', 'SE1:12++3', 'SE1:-5', null, undefined, 42]) assert.equal(decodeCart(bad), null, String(bad));
  assert.equal(decodeCart(btoa('{"id":1}')), null, 'JSON che non è un elenco');
});

test('il testo del QR è molto più corto del formato di prima', () => {
  const lines = Array.from({ length: 25 }, (_, i) => ({ id: 1000 + i * 7, quantity: 1 + (i % 4) }));
  const before = btoa(JSON.stringify(lines)).length;
  assert.ok(encodeCart(lines).length < before / 3, `${encodeCart(lines).length} contro ${before}`);
});
