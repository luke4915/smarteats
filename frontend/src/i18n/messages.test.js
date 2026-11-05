import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MESSAGES } from './messages.js';

const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');

test('italiano e inglese hanno le stesse chiavi; le altre lingue non ne hanno di sconosciute (le frasi che mancano si leggono in inglese)', () => {
  const keys = Object.keys(MESSAGES.it).sort();
  assert.deepEqual(Object.keys(MESSAGES.en).sort(), keys);
  for (const lang of ['de', 'fr', 'es']) assert.deepEqual(Object.keys(MESSAGES[lang]).filter(k => !keys.includes(k)), [], lang);
});

test('i segnaposto sono gli stessi in ogni lingua (altrimenti manca un nome o un numero)', () => {
  for (const [lang, messages] of Object.entries(MESSAGES))
    for (const [key, text] of Object.entries(messages)) assert.equal(placeholders(text), placeholders(MESSAGES.it[key]), `${lang}: ${key}`);
});

test('nessun testo è vuoto', () => {
  for (const [lang, messages] of Object.entries(MESSAGES)) for (const [key, text] of Object.entries(messages)) assert.ok(text.trim(), `${lang}: ${key}`);
});

test('i quattordici allergeni hanno un nome in ogni lingua', () => {
  const ids = ['gluten', 'crustaceans', 'eggs', 'fish', 'peanuts', 'soybeans', 'milk', 'tree_nuts', 'celery', 'mustard', 'sesame', 'sulphites', 'lupin', 'molluscs'];
  for (const messages of Object.values(MESSAGES)) for (const id of ids) assert.ok(messages[`allergen.${id}`], id);
});
