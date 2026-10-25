import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shortLinkTarget } from './shortLink.js';

test('il link breve porta al sottodominio del locale', () => {
  assert.equal(shortLinkTarget('/s/pizzeria-rossi/book/AbC123_-xyZ', 'https:', 'smarteats.it'), 'https://pizzeria-rossi.smarteats.it/book/AbC123_-xyZ');
  assert.equal(shortLinkTarget('/s/forno/order/abcdefghij12/', 'https:', 'app.example.it:5173'), 'https://forno.app.example.it:5173/order/abcdefghij12');
});

test('percorsi non validi non portano da nessuna parte', () => {
  for (const p of ['/s/', '/s/rossi/menu/abcdefghij', '/s/ROSSI/book/abcdefghij', '/s/rossi/book/corto', '/s/ro.ssi/book/abcdefghij', '/s/a/b/c/d', '/book/abcdefghij'])
    assert.equal(shortLinkTarget(p, 'https:', 'x.it'), null, p);
});
