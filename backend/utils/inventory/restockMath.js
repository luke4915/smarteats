// I conti del riordino e dei prezzi d'acquisto: logica pura, provata in tests/restockMath.test.js.

// Un ingrediente è «da riordinare» quando ha una scorta minima e in dispensa ce n'è quanto o meno di quella.
export const needsRestock = (onHand, reorderLevel) => reorderLevel !== null && reorderLevel !== undefined && Number(onHand) <= Number(reorderLevel);

// Il prezzo di una riga di carico per unità di base (centesimi per grammo, millilitro o pezzo), con 4 decimali.
export const pricePerBaseUnit = (lineCostCents, baseQuantity) => (Number(baseQuantity) > 0 ? Math.round((Number(lineCostCents) / Number(baseQuantity)) * 10000) / 10000 : null);

// Di quanto è cambiato un prezzo, in percentuale con un decimale (+12,5 = rincarato); null se manca il confronto.
export function priceChangePercent(previous, latest) {
  if (!previous || previous <= 0 || latest === null || latest === undefined) return null;
  return Math.round(((latest - previous) / previous) * 1000) / 10;
}
