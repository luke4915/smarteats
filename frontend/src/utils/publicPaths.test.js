import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPublicPath } from './publicPaths.js';

test('le pagine dei clienti e dello schermo cucina sono pubbliche, anche con un codice dopo', () => {
  for (const p of ['/menu', '/book', '/book/abc123', '/order', '/order/xyz', '/s/locale/book/codice', '/privacy', '/terms', '/kds', '/master', '/mock-checkout/abc']) assert.equal(isPublicPath(p), true, p);
});

test('la barra finale non cambia pagina', () => {
  for (const p of ['/menu/', '/privacy/', '/kds/']) assert.equal(isPublicPath(p), true, p);
});

test('il lavoro del locale non è pubblico, e un percorso che comincia in modo simile nemmeno', () => {
  for (const p of ['/', '/login', '/config', '/stats', '/menus', '/booking', '/orders', '/sagra']) assert.equal(isPublicPath(p), false, p);
});
