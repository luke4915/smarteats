// Costi del magazzino: logica pura, provata in tests/costing.test.js. I costi sono sempre senza IVA; sul server in centesimi.

const round = (value, decimals) => { const f = 10 ** decimals; return Math.round(value * f) / f; };

// Il costo medio ponderato di un ingrediente dopo un carico: media fra ciò che c'è già (al suo costo medio) e ciò che arriva
// (al suo costo). Una dispensa in negativo (vendite forzate) conta come vuota: il carico non eredita un costo falso.
// `averageCost` e `addedUnitCost` sono per unità di base (centesimi per grammo, millilitro o pezzo), con decimali.
export function nextAverageCost({ onHand, averageCost, addedQuantity, addedUnitCost }) {
  const existing = Math.max(onHand, 0);
  const total = existing + addedQuantity;
  if (total <= 0) return averageCost;
  return round((existing * averageCost + addedQuantity * addedUnitCost) / total, 4);
}

// Una riga di carico: quanto entra in unità di base e quanto costa la riga (centesimi, senza IVA).
// `quantity` è in confezioni, `baseUnitsPerPurchaseUnit` quante unità di base ha una confezione, `unitCostCents` il prezzo di una confezione.
export function lineAmounts({ quantity, baseUnitsPerPurchaseUnit, unitCostCents }) {
  return {
    baseQuantity: round(quantity * baseUnitsPerPurchaseUnit, 3),
    lineCostCents: Math.round(quantity * unitCostCents),
  };
}

// Totale del carico in centesimi, senza IVA, e quanta IVA c'è (per riga: costo × aliquota). Le righe senza aliquota non hanno IVA.
export function receiptTotals(lines) {
  const net = lines.reduce((sum, l) => sum + l.lineCostCents, 0);
  const vat = lines.reduce((sum, l) => sum + Math.round((l.lineCostCents * (l.vatRate ?? 0)) / 100), 0);
  return { netCents: net, vatCents: vat, grossCents: net + vat };
}
