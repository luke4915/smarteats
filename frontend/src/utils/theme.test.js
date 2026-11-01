import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTheme, resolveTheme, DEFAULT_THEME } from './theme.js';

test('un valore salvato non valido torna alla scelta di partenza', () => {
  assert.equal(DEFAULT_THEME, 'dark');
  assert.equal(parseTheme(null), 'dark');
  assert.equal(parseTheme('rosa'), 'dark');
  for (const ok of ['auto', 'light', 'dark']) assert.equal(parseTheme(ok), ok);
});

test('«auto» segue il sistema, le altre scelte no', () => {
  assert.equal(resolveTheme('auto', true), 'dark');
  assert.equal(resolveTheme('auto', false), 'light');
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme('dark', false), 'dark');
});

test('un valore non valido vale la scelta di partenza, che per le pagine dei clienti è «auto»', async () => {
  const { parseTheme } = await import('./theme.js');
  assert.equal(parseTheme(null), 'dark');
  assert.equal(parseTheme(null, 'auto'), 'auto');
  assert.equal(parseTheme('light', 'auto'), 'light');
});
