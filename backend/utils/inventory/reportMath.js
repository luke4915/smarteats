// I conti dei report del magazzino: logica pura, provata in tests/reportMath.test.js. Tutto in centesimi interi.

// Un incasso con IVA (prezzi in carta) al netto dell'IVA: 11,00 € al 10% sono 10,00 €.
export const netOfVat = (grossCents, vatRate) => Math.round(grossCents / (1 + vatRate / 100));

// Le righe vendute di un piatto (già sommate): ricavo con IVA, costo teorico delle sole righe con ricetta.
// Ritorna ricavo netto, margine e food cost (percentuale del costo sul ricavo netto), o null se non c'è nulla da confrontare.
export function dishFigures({ grossCents, grossWithCostCents, costCents, vatRate }) {
  const netCents = netOfVat(grossCents, vatRate);
  if (costCents === null || costCents === undefined) return { netCents, hasRecipe: false, costCents: null, marginCents: null, foodCostPercent: null };
  const netWithCost = netOfVat(grossWithCostCents, vatRate);
  return { netCents, hasRecipe: true, costCents, marginCents: netWithCost - costCents, foodCostPercent: netWithCost > 0 ? Math.round((costCents / netWithCost) * 1000) / 10 : null };
}

// Il quadro di un periodo, sommando i piatti: ricavo netto totale, costo e margine di quelli con ricetta, food cost, e quanta parte
// del ricavo è coperta da ricette (se è bassa il food cost è poco significativo).
export function overviewFigures(dishes) {
  const withRecipe = dishes.filter(d => d.hasRecipe);
  const net = dishes.reduce((sum, d) => sum + d.netCents, 0);
  const netWithRecipe = withRecipe.reduce((sum, d) => sum + d.netWithCostCents, 0);
  const cost = withRecipe.reduce((sum, d) => sum + d.costCents, 0);
  return {
    netCents: net,
    costCents: cost,
    marginCents: netWithRecipe - cost,
    foodCostPercent: netWithRecipe > 0 ? Math.round((cost / netWithRecipe) * 1000) / 10 : null,
    recipeCoveragePercent: net > 0 ? Math.round((netWithRecipe / net) * 100) : null,
  };
}

// Il valore della dispensa: ogni ingrediente in magazzino per il suo costo medio (quelli in negativo non contano).
export const inventoryValueCents = (ingredients) =>
  Math.round(ingredients.reduce((sum, i) => sum + Math.max(Number(i.quantity_on_hand), 0) * Number(i.weighted_average_cost), 0));

// Una quantità di base per il suo costo unitario (centesimi per unità di base), in centesimi interi.
export const valueCents = (quantity, unitCost) => Math.round(Number(quantity) * Number(unitCost));

// Quanti giorni dura una scorta al consumo medio giornaliero degli ultimi giorni; null se non si consuma nulla.
export const daysOfStock = (onHand, usedInPeriod, days) => (usedInPeriod > 0 && days > 0 ? Math.round((Math.max(onHand, 0) / (usedInPeriod / days)) * 10) / 10 : null);
