import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGroups, categoriesOf, hiddenCount, soldOutCount, viewOptions, effectiveView, toggleMany, allSelected, selectionText } from './catalogView.js';

const P = (id, name, category, visible) => ({ id, name, category, ...(visible !== undefined && { visible }) });
const products = [P(1, 'Panino', 'Panini'), P(2, 'Hamburger', 'Panini', false), P(3, 'Birra', 'Bevande'), P(4, 'Acqua', 'Bevande', false), P(5, 'Sale', undefined)];

test('di partenza si vedono tutti, i nascosti compresi, raggruppati per categoria nell\'ordine in cui compaiono', () => {
  const groups = buildGroups(products);
  assert.deepEqual(groups.map(g => g.category), ['Panini', 'Bevande', 'Generico']);
  assert.deepEqual(groups[0].items.map(p => p.id), [1, 2]);
});

test('un prodotto senza categoria non sparisce: va in «Generico», come nella carta della cassa', () => {
  assert.deepEqual(buildGroups(products, { category: 'Generico' })[0].items.map(p => p.id), [5]);
  assert.ok(categoriesOf(products).includes('Generico'));
});

test('il filtro «Visibili» e «Nascosti» e il conto dei nascosti', () => {
  assert.deepEqual(buildGroups(products, { view: 'visible' }).flatMap(g => g.items.map(p => p.id)), [1, 3, 5]);
  assert.deepEqual(buildGroups(products, { view: 'hidden' }).flatMap(g => g.items.map(p => p.id)), [2, 4]);
  assert.equal(hiddenCount(products), 2);
  assert.equal(hiddenCount([P(1, 'X', 'Y')]), 0, 'senza il campo `visible` il prodotto è visibile');
});

test('categoria e ricerca si combinano; la ricerca non distingue le maiuscole e i gruppi vuoti spariscono', () => {
  assert.deepEqual(buildGroups(products, { category: 'Bevande', search: 'BIR' }).flatMap(g => g.items.map(p => p.id)), [3]);
  assert.deepEqual(buildGroups(products, { search: 'zzz' }), []);
  assert.deepEqual(buildGroups(products, { view: 'hidden', category: 'Panini' }).flatMap(g => g.items.map(p => p.id)), [2]);
});

test('«Tutti»: aggiunge quelli che mancano senza toccare gli altri; se ci sono già tutti li toglie', () => {
  assert.deepEqual(toggleMany([9], [1, 2, 3]), [9, 1, 2, 3]);
  assert.deepEqual(toggleMany([2, 9], [1, 2, 3]), [2, 9, 1, 3]);
  assert.deepEqual(toggleMany([1, 2, 3, 9], [1, 2, 3]), [9]);
  assert.equal(allSelected([1, 2], [1, 2]), true);
  assert.equal(allSelected([1], [1, 2]), false);
  assert.equal(allSelected([], []), false, 'nessun elemento: non è «tutti selezionati»');
});

test('il testo della barra di selezione', () => {
  assert.equal(selectionText(0, 'piatto'), 'Tocca i piatti da cambiare');
  assert.equal(selectionText(0, 'prodotto'), 'Tocca i prodotti da cambiare');
  assert.equal(selectionText(1, 'prodotto'), '1 selezionato');
  assert.equal(selectionText(4, 'prodotto'), '4 selezionati');
});

test('il filtro «Esauriti» e il conto: solo la scorta contata e finita, non l\'illimitato', () => {
  const list = [{ ...P(1, 'A', 'X'), stock_enabled: true, stock: 0 }, { ...P(2, 'B', 'X'), stock_enabled: true, stock: 4 }, P(3, 'C', 'X'), { ...P(4, 'D', 'X', false), stock_enabled: true, stock: 0 }];
  assert.equal(soldOutCount(list), 2);
  assert.deepEqual(buildGroups(list, { view: 'soldout' }).flatMap(g => g.items.map(p => p.id)), [1, 4], 'un esaurito nascosto è comunque esaurito');
});

test('il filtro per stato compare solo se serve, con i conti; se la scelta non esiste più si torna a «Tutti»', () => {
  assert.deepEqual(viewOptions([P(1, 'A', 'X')]), [], 'niente nascosti né esauriti: nessun filtro');
  const list = [P(1, 'A', 'X', false), { ...P(2, 'B', 'X'), stock_enabled: true, stock: 0 }, P(3, 'C', 'X')];
  assert.deepEqual(viewOptions(list).map(o => o.label), ['Tutti', 'Visibili', 'Esauriti 1', 'Nascosti 1']);
  assert.deepEqual(viewOptions([{ ...P(2, 'B', 'X'), stock_enabled: true, stock: 0 }]).map(o => o.id), ['all', 'soldout']);
  assert.equal(effectiveView(list, 'hidden'), 'hidden');
  assert.equal(effectiveView([P(1, 'A', 'X')], 'hidden'), 'all');
});
