// Lo scarico di merce (la «bolla») come si compila a schermo e come va al server. Logica pura, provata in receipt.test.js.
//
// Una riga a schermo: { key, ingredient_id, purchase_unit_name, content_text, content_unit, quantity_text, price_text, vat }:
//   quantità in confezioni, contenuto di una confezione nell'unità scelta («25 kg»), prezzo di una confezione in euro SENZA IVA,
//   aliquota IVA in percentuale (testo, vuoto = nessuna). Al server arrivano centesimi e unità di base.
import { parseDecimal, toBaseQuantity, toDisplayQuantity } from './units.js';

export const VAT_RATES = ['4', '5', '10', '22'];

let counter = 0;
export const blankReceiptRow = () => ({ key: `scarico-${(counter += 1)}`, ingredient_id: '', purchase_unit_name: '', content_text: '', content_unit: 'g', quantity_text: '', price_text: '', vat: '' });

// Euro scritti a mano («18,50») in centesimi interi, o null se non è un importo.
export function parseEuroToCents(text) {
  const value = parseDecimal(text);
  return value === null || value < 0 ? null : Math.round(value * 100);
}

// Gli importi riservati arrivano `null`: nei campi da compilare restano vuoti (si scrive il prezzo della bolla), a schermo sono `money()`.
export const centsToEuroText = (cents) => (cents === null || cents === undefined ? '' : (cents / 100).toFixed(2).replace('.', ','));

// Un importo in euro da mostrare, o i puntini se è riservato.

// La riga già compilata con ciò che il listino del fornitore ricorda per quell'ingrediente (confezione, contenuto, prezzo, IVA).
export function rowForIngredient(row, ingredientId, ingredients, supplierItems = []) {
  const ingredient = ingredients.find(i => i.id === Number(ingredientId));
  if (!ingredient) return { ...row, ingredient_id: '' };
  const remembered = supplierItems.find(i => i.ingredient_id === ingredient.id);
  if (!remembered) return { ...row, ingredient_id: ingredient.id, content_unit: ingredient.base_unit };
  const content = toDisplayQuantity(remembered.base_units_per_purchase_unit, ingredient.base_unit);
  return {
    ...row, ingredient_id: ingredient.id, purchase_unit_name: remembered.purchase_unit_name,
    content_text: String(content.value).replace('.', ','), content_unit: content.unit,
    price_text: centsToEuroText(remembered.unit_cost_cents), vat: remembered.vat_rate === null ? '' : String(remembered.vat_rate),
  };
}

// I numeri di una riga, se completa: { quantity, content, priceCents, lineCents, vatRate } oppure null.
export function rowAmounts(row) {
  const quantity = parseDecimal(row.quantity_text);
  const content = parseDecimal(row.content_text);
  const priceCents = parseEuroToCents(row.price_text);
  if (!quantity || quantity <= 0 || !content || content <= 0 || priceCents === null) return null;
  const vatRate = row.vat === '' ? null : parseDecimal(row.vat);
  return { quantity, content, priceCents, lineCents: Math.round(quantity * priceCents), vatRate };
}

// Totali dello scarico per l'anteprima: senza IVA, IVA, con IVA (le righe incomplete non contano).
export function summarize(rows) {
  const amounts = rows.map(rowAmounts).filter(Boolean);
  const net = amounts.reduce((sum, a) => sum + a.lineCents, 0);
  const vat = amounts.reduce((sum, a) => sum + Math.round((a.lineCents * (a.vatRate ?? 0)) / 100), 0);
  return { netCents: net, vatCents: vat, grossCents: net + vat };
}

// Le righe che contano: quelle con una quantità scritta. Scelto il fornitore, lo scarico si apre con tutti i suoi prodotti;
// si scrive la quantità solo di quelli arrivati e gli altri si ignorano.
export const arrivedRows = (rows) => rows.filter(r => r.quantity_text.trim() !== '');

// Lo scarico dopo aver scelto un fornitore: restano le righe dove si è già scritto una quantità, poi i prodotti del fornitore
// (con confezione, contenuto, prezzo e IVA dell'ultimo scarico) che non ci sono già. Senza listino, una riga vuota.
export function rowsForSupplier(currentRows, supplier, ingredients) {
  const kept = arrivedRows(currentRows);
  const taken = new Set(kept.map(r => Number(r.ingredient_id)));
  const nameOf = (id) => ingredients.find(i => i.id === id)?.name ?? '';
  const fromList = (supplier?.items ?? [])
    .filter(item => !taken.has(item.ingredient_id) && ingredients.find(i => i.id === item.ingredient_id)?.active)
    .sort((a, b) => nameOf(a.ingredient_id).localeCompare(nameOf(b.ingredient_id), 'it'))
    .map(item => rowFromPriceItem(item, ingredients, ''));
  const rows = [...kept, ...fromList];
  return rows.length ? rows : [blankReceiptRow()];
}

// Cosa manca per poter salvare, o null.
export function receiptProblem(form, allRows) {
  if (!form.supplier_id) return 'Scegli il fornitore';
  if (!form.received_on) return 'Scrivi la data di arrivo';
  const rows = arrivedRows(allRows);
  if (!rows.length) return 'Scrivi la quantità arrivata di almeno un prodotto';
  for (const row of rows) {
    if (!row.ingredient_id) return 'Scegli l\'ingrediente in ogni riga';
    if (!row.purchase_unit_name.trim()) return 'Scrivi com\'è la confezione (es. «Sacco da 25 kg»)';
    if (!rowAmounts(row)) return 'Controlla quantità, contenuto e prezzo di ogni riga';
  }
  return null;
}

// Il corpo della richiesta di creazione.
export function receiptPayload(form, allRows, ingredients) {
  const rows = arrivedRows(allRows);
  return {
    supplier_id: Number(form.supplier_id),
    received_on: form.received_on,
    document_number: form.document_number.trim() || null,
    notes: form.notes.trim() || null,
    lines: rows.map(row => {
      const a = rowAmounts(row);
      const ingredient = ingredients.find(i => i.id === Number(row.ingredient_id));
      return {
        ingredient_id: Number(row.ingredient_id),
        quantity: a.quantity,
        purchase_unit_name: row.purchase_unit_name.trim(),
        base_units_per_purchase_unit: toBaseQuantity(a.content, row.content_unit || ingredient.base_unit),
        unit_cost_cents: a.priceCents,
        vat_rate: a.vatRate,
      };
    }),
  };
}

// Oggi come «AAAA-MM-GG» nel fuso del dispositivo (per la data di arrivo di partenza).
// L'IVA di uno scarico già registrato: ogni riga ha il suo costo (centesimi) e la sua aliquota.
export const vatOfLines = (lines) => lines.reduce((sum, l) => sum + Math.round((l.line_cost_cents * (l.vat_rate ?? 0)) / 100), 0);

export const todayText = (now = new Date()) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

// ── Il listino di un fornitore: le stesse righe dello scarico, senza la quantità ──
export function rowFromPriceItem(item, ingredients, quantityText = '1') {
  const ingredient = ingredients.find(i => i.id === item.ingredient_id);
  const content = toDisplayQuantity(item.base_units_per_purchase_unit, ingredient?.base_unit ?? 'g');
  return {
    key: `scarico-${(counter += 1)}`, ingredient_id: item.ingredient_id, purchase_unit_name: item.purchase_unit_name,
    content_text: String(content.value).replace('.', ','), content_unit: content.unit, quantity_text: quantityText,
    price_text: centsToEuroText(item.unit_cost_cents), vat: item.vat_rate === null ? '' : String(item.vat_rate),
  };
}

export function priceListProblem(rows) {
  const seen = new Set();
  for (const r of rows) {
    if (!r.ingredient_id) return 'Scegli l\'ingrediente in ogni riga del listino';
    if (seen.has(r.ingredient_id)) return 'Un ingrediente è ripetuto nel listino';
    seen.add(r.ingredient_id);
    if (!r.purchase_unit_name.trim() || !rowAmounts({ ...r, quantity_text: '1' })) return 'Controlla confezione, contenuto e prezzo di ogni riga del listino';
  }
  return null;
}

export const priceListPayload = (rows, ingredients) => ({
  items: receiptPayload({ supplier_id: '1', received_on: '2000-01-01', document_number: '', notes: '' }, rows.map(r => ({ ...r, quantity_text: '1' })), ingredients).lines
    .map(l => ({ ingredient_id: l.ingredient_id, purchase_unit_name: l.purchase_unit_name, base_units_per_purchase_unit: l.base_units_per_purchase_unit, unit_cost_cents: l.unit_cost_cents, vat_rate: l.vat_rate })),
});
