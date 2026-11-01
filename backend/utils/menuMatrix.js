// La matrice del menu (menu engineering, Kasavana e Smith): ogni prodotto si colloca per quanto si vende (popolarità) e per quanto rende
// a ogni pezzo venduto, e cade in uno di quattro quadranti. Logica pura, provata in tests/menuMatrix.test.js; le righe le prepara menuMatrixDb.js.
//
// - Popolare: venduto almeno quanto il 70% di una quota «alla pari» (1/n delle vendite): la soglia classica del metodo.
// - Rende molto: il valore per pezzo è almeno la media pesata sulle vendite. Il valore è il **margine** (ricavo netto meno costo teorico, dalle
//   ricette) quando le ricette coprono quasi tutto l'incasso; altrimenti è il **ricavo netto per pezzo** (il prezzo): senza costi non si può dire di più.
import { netOfVat } from './inventory/reportMath.js';

export const MIN_PRODUCTS = 4;                 // sotto questo numero i quadranti non dicono nulla
export const MIN_COVERAGE = 0.8;               // quota dell'incasso che deve avere un costo per usare il margine
export const POPULARITY_FACTOR = 0.7;

export const CLASSES = { star: 'star', workhorse: 'workhorse', puzzle: 'puzzle', dog: 'dog' };

/**
 * @param {Array<{product_id:number|string,name:string,category:string|null,quantity:number,gross_cents:number,costed_quantity:number,
 *   gross_with_cost_cents:number,cost_cents:number|null,vat_rate:number}>} rows  una per prodotto venduto (omaggi esclusi)
 */
export function buildMenuMatrix(rows) {
  const dishes = rows.filter(r => r.quantity > 0).map(r => {
    const net = netOfVat(r.gross_cents, r.vat_rate);
    const costed = r.cost_cents != null && r.costed_quantity > 0;
    const netCosted = costed ? netOfVat(r.gross_with_cost_cents, r.vat_rate) : 0;
    return {
      id: Number(r.product_id), name: r.name, category: r.category || 'Altro', quantity: r.quantity, net, costed,
      unitPrice: Math.round(net / r.quantity), unitMargin: costed ? Math.round((netCosted - r.cost_cents) / r.costed_quantity) : null, netCosted,
    };
  });
  const totalNet = dishes.reduce((s, d) => s + d.net, 0);
  const costedNet = dishes.filter(d => d.costed).reduce((s, d) => s + d.net, 0);
  const costedCount = dishes.filter(d => d.costed).length;
  const coverage = totalNet > 0 ? costedNet / totalNet : 0;
  const mode = costedCount >= MIN_PRODUCTS && coverage >= MIN_COVERAGE ? 'margin' : 'price';

  const valueOf = (d) => (mode === 'margin' ? d.unitMargin : d.unitPrice);
  const classified = dishes.filter(d => valueOf(d) !== null);
  const unclassified = dishes.filter(d => valueOf(d) === null).map(d => ({ id: d.id, name: d.name, category: d.category, quantity: d.quantity }));
  const base = { mode, coveragePercent: Math.round(coverage * 100), unclassified };
  if (classified.length < MIN_PRODUCTS) return { ...base, enough: false, items: [], counts: { star: 0, workhorse: 0, puzzle: 0, dog: 0 }, popularityThreshold: 0, valueThreshold: 0 };

  const totalQty = classified.reduce((s, d) => s + d.quantity, 0);
  const popularityThreshold = (POPULARITY_FACTOR / classified.length) * totalQty;
  const valueThreshold = Math.round(classified.reduce((s, d) => s + valueOf(d) * d.quantity, 0) / totalQty);
  const counts = { star: 0, workhorse: 0, puzzle: 0, dog: 0 };
  const items = classified.map(d => {
    const popular = d.quantity >= popularityThreshold;
    const high = valueOf(d) >= valueThreshold;
    const klass = popular ? (high ? CLASSES.star : CLASSES.workhorse) : (high ? CLASSES.puzzle : CLASSES.dog);
    counts[klass] += 1;
    return { id: d.id, name: d.name, category: d.category, quantity: d.quantity, share: Math.round((d.quantity / totalQty) * 1000) / 10, valueCents: valueOf(d), klass };
  }).sort((x, y) => y.quantity - x.quantity || x.name.localeCompare(y.name, 'it'));
  return { ...base, enough: true, items, counts, popularityThreshold: Math.round(popularityThreshold * 10) / 10, valueThreshold };
}
