import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEuroToCents, centsToEuroText, rowForIngredient, rowAmounts, summarize, receiptProblem, receiptPayload, blankReceiptRow, todayText, rowFromPriceItem, priceListProblem, priceListPayload, vatOfLines, money } from './receipt.js';

const ingredients = [{ id: 1, name: 'Farina', base_unit: 'g' }, { id: 2, name: 'Olio', base_unit: 'ml' }];
const row = (changes) => ({ ...blankReceiptRow(), ...changes });
const flourRow = row({ ingredient_id: 1, purchase_unit_name: 'Sacco da 25 kg', content_text: '25', content_unit: 'kg', quantity_text: '4', price_text: '25,00', vat: '4' });

test('gli euro si scrivono con la virgola e diventano centesimi interi', () => {
  assert.equal(parseEuroToCents('18,50'), 1850);
  assert.equal(parseEuroToCents('0.1'), 10);
  assert.equal(parseEuroToCents(''), null);
  assert.equal(parseEuroToCents('-3'), null);
  assert.equal(centsToEuroText(1850), '18,50');
});

test('scegliendo un ingrediente la riga si compila dal listino del fornitore', () => {
  const remembered = [{ ingredient_id: 2, purchase_unit_name: 'Cassa da 6 l', base_units_per_purchase_unit: 6000, unit_cost_cents: 3600, vat_rate: 10 }];
  const filled = rowForIngredient(blankReceiptRow(), 2, ingredients, remembered);
  assert.deepEqual([filled.purchase_unit_name, filled.content_text, filled.content_unit, filled.price_text, filled.vat], ['Cassa da 6 l', '6', 'l', '36,00', '10']);
  const fresh = rowForIngredient(blankReceiptRow(), 1, ingredients, remembered);
  assert.deepEqual([fresh.purchase_unit_name, fresh.content_unit], ['', 'g'], 'ingrediente mai comprato da lui: vuota, con l\'unità giusta');
});

test('i numeri di una riga completa; una incompleta vale null', () => {
  assert.deepEqual(rowAmounts(flourRow), { quantity: 4, content: 25, priceCents: 2500, lineCents: 10000, vatRate: 4 });
  assert.equal(rowAmounts({ ...flourRow, price_text: '' }), null);
  assert.equal(rowAmounts({ ...flourRow, quantity_text: '0' }), null);
});

test('totali: senza IVA, IVA, con IVA; le righe incomplete non contano', () => {
  const oil = row({ ingredient_id: 2, purchase_unit_name: 'Cassa', content_text: '6', content_unit: 'l', quantity_text: '2', price_text: '36', vat: '10' });
  assert.deepEqual(summarize([flourRow, oil, blankReceiptRow()]), { netCents: 10000 + 7200, vatCents: 400 + 720, grossCents: 17200 + 1120 });
});

test('cosa manca per salvare', () => {
  const form = { supplier_id: '3', received_on: '2026-10-20', document_number: '', notes: '' };
  assert.equal(receiptProblem(form, [flourRow]), null);
  assert.ok(receiptProblem({ ...form, supplier_id: '' }, [flourRow]));
  assert.ok(receiptProblem(form, []));
  assert.ok(receiptProblem(form, [row({ ...flourRow, ingredient_id: '' })]));
  assert.ok(receiptProblem(form, [row({ ...flourRow, purchase_unit_name: ' ' })]));
  assert.ok(receiptProblem(form, [row({ ...flourRow, price_text: 'x' })]));
});

test('il corpo della richiesta: contenuto nell\'unità di base, prezzo in centesimi, IVA vuota = nulla', () => {
  const payload = receiptPayload({ supplier_id: '3', received_on: '2026-10-20', document_number: ' DDT 5 ', notes: '' }, [{ ...flourRow, vat: '' }], ingredients);
  assert.deepEqual(payload, { supplier_id: 3, received_on: '2026-10-20', document_number: 'DDT 5', notes: null, lines: [
    { ingredient_id: 1, quantity: 4, purchase_unit_name: 'Sacco da 25 kg', base_units_per_purchase_unit: 25000, unit_cost_cents: 2500, vat_rate: null }] });
});

test('l\'IVA di un carico già registrato si somma riga per riga', () => {
  assert.equal(vatOfLines([{ line_cost_cents: 10000, vat_rate: 4 }, { line_cost_cents: 7200, vat_rate: 10 }, { line_cost_cents: 500, vat_rate: null }]), 400 + 720);
});

test('la data di oggi nel formato che vuole il server', () => {
  assert.equal(todayText(new Date(2026, 9, 5)), '2026-10-05');
});

test('il listino: dalle righe del server a quelle a schermo e ritorno', () => {
  const item = { ingredient_id: 1, purchase_unit_name: 'Sacco da 25 kg', base_units_per_purchase_unit: 25000, unit_cost_cents: 2500, vat_rate: 4 };
  const shown = rowFromPriceItem(item, ingredients);
  assert.deepEqual([shown.content_text, shown.content_unit, shown.price_text, shown.vat], ['25', 'kg', '25,00', '4']);
  assert.deepEqual(priceListPayload([shown], ingredients), { items: [item] });
});

test('il listino: un ingrediente ripetuto o una riga incompleta non si salvano', () => {
  const good = rowFromPriceItem({ ingredient_id: 1, purchase_unit_name: 'Sacco', base_units_per_purchase_unit: 25000, unit_cost_cents: 2500, vat_rate: null }, ingredients);
  assert.equal(priceListProblem([good]), null);
  assert.ok(priceListProblem([good, good]));
  assert.ok(priceListProblem([{ ...good, price_text: '' }]));
  assert.ok(priceListProblem([{ ...good, ingredient_id: '' }]));
});

test('un importo riservato resta vuoto nei campi e diventa puntini a schermo', () => {
  assert.equal(centsToEuroText(null), '');
  assert.equal(money(null), '•••');
  assert.equal(money(1850), '18,50 €');
  assert.equal(money(0), '0,00 €');
});
