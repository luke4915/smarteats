import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMenuMatrix, MIN_PRODUCTS } from '../utils/menuMatrix.js';

// Una riga per prodotto: ricavo lordo in centesimi (IVA 10%), con o senza costo teorico.
const dish = (id, name, quantity, grossCents, cost = null) => ({
  product_id: id, name, category: 'Cibo', quantity, gross_cents: grossCents,
  costed_quantity: cost === null ? 0 : quantity, gross_with_cost_cents: cost === null ? 0 : grossCents, cost_cents: cost, vat_rate: 10,
});
const classOf = (m, name) => m.items.find(i => i.name === name).klass;

test('senza costi la matrice usa il ricavo netto per pezzo (il prezzo) e lo dice', () => {
  const m = buildMenuMatrix([dish(1, 'Panino', 100, 55000), dish(2, 'Birra', 90, 36000), dish(3, 'Tiramisù', 10, 8800), dish(4, 'Torta', 8, 3520)]);
  assert.equal(m.mode, 'price');
  assert.equal(m.enough, true);
  assert.equal(m.items.length, 4);
  assert.deepEqual(m.items.map(i => i.name), ['Panino', 'Birra', 'Tiramisù', 'Torta'], 'dal più venduto');
});

test('i quattro quadranti: popolare e redditizio, popolare e povero, redditizio e raro, raro e povero', () => {
  // prezzi netti ≈ 5,00 / 3,64 / 8,00 / 3,20; vendite 100 / 90 / 10 / 8; media pesata ≈ 4,26
  const m = buildMenuMatrix([dish(1, 'Panino', 100, 55000), dish(2, 'Birra', 90, 36000), dish(3, 'Tiramisù', 10, 8800), dish(4, 'Torta', 8, 3520)]);
  assert.equal(classOf(m, 'Panino'), 'star');
  assert.equal(classOf(m, 'Birra'), 'workhorse');
  assert.equal(classOf(m, 'Tiramisù'), 'puzzle');
  assert.equal(classOf(m, 'Torta'), 'dog');
  assert.deepEqual(m.counts, { star: 1, workhorse: 1, puzzle: 1, dog: 1 });
});

test('la soglia di popolarità è il 70% della quota alla pari', () => {
  const m = buildMenuMatrix([dish(1, 'A', 100, 1000), dish(2, 'B', 100, 1000), dish(3, 'C', 100, 1000), dish(4, 'D', 100, 1000)]);
  assert.equal(m.popularityThreshold, 70);         // quota alla pari 100 pezzi su 400, il 70% è 70
});

test('con i costi di quasi tutto l\'incasso si usa il margine', () => {
  const m = buildMenuMatrix([dish(1, 'Panino', 100, 55000, 20000), dish(2, 'Birra', 90, 36000, 25000), dish(3, 'Tiramisù', 10, 8800, 1000), dish(4, 'Torta', 8, 3520, 800)]);
  assert.equal(m.mode, 'margin');
  assert.equal(m.coveragePercent, 100);
  assert.equal(m.items.find(i => i.name === 'Panino').valueCents, 300);      // (500 netti − 200 di costo) per pezzo
  assert.equal(classOf(m, 'Panino'), 'star');
  assert.equal(classOf(m, 'Birra'), 'workhorse', 'molto venduta ma rende poco per pezzo');
});

test('se i costi coprono poco incasso si resta sul prezzo e nessun prodotto resta fuori', () => {
  const m = buildMenuMatrix([dish(1, 'Panino', 100, 55000, 20000), dish(2, 'Birra', 90, 36000), dish(3, 'Tiramisù', 10, 8800), dish(4, 'Torta', 8, 3520)]);
  assert.equal(m.mode, 'price');
  assert.equal(m.unclassified.length, 0);
});

test('in modalità margine chi non ha ricetta resta fuori dai quadranti e viene elencato', () => {
  const rows = [dish(1, 'A', 100, 55000, 20000), dish(2, 'B', 90, 36000, 15000), dish(3, 'C', 80, 40000, 10000), dish(4, 'D', 70, 30000, 9000), dish(5, 'E', 1, 100)];
  const m = buildMenuMatrix(rows);
  assert.equal(m.mode, 'margin');
  assert.deepEqual(m.unclassified.map(u => u.name), ['E']);
  assert.equal(m.items.length, 4);
});

test(`con meno di ${MIN_PRODUCTS} prodotti non si classifica nulla`, () => {
  const m = buildMenuMatrix([dish(1, 'A', 10, 1000), dish(2, 'B', 10, 1000), dish(3, 'C', 10, 1000)]);
  assert.equal(m.enough, false);
  assert.deepEqual(m.items, []);
  assert.equal(buildMenuMatrix([]).enough, false);
});
