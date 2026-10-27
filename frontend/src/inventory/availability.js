// Gli ingredienti bastano per un piatto? Logica pura (provata in availability.js.test): la usano la cassa e la sala per scrivere
// «Esaurito» sulle tessere. Il server resta l'unico a decidere (409 INGREDIENT_SHORTAGE): qui è solo un avviso in anticipo.

// Chi può vendere anche con un ingrediente finito (stesso elenco del server, `BYPASS_ROLES` in orderStock.js).
export const canForceSale = (role) => ['admin', 'manager'].includes(role);

// Dall'elenco del server ({ product_id, ingredient_portions }) a una mappa per id.
export const toPortionsMap = (list) => new Map((list ?? []).map(p => [p.product_id, p.ingredient_portions]));

// Quante porzioni restano dopo quelle già nel carrello; null = gli ingredienti non fanno da limite (nessuna ricetta o magazzino spento).
export function ingredientPortionsLeft(portions, productId, inCart = 0) {
  const possible = portions.get(productId);
  return possible === null || possible === undefined ? null : Math.max(possible - inCart, 0);
}

export const isIngredientOut = (portions, productId, inCart = 0) => ingredientPortionsLeft(portions, productId, inCart) === 0;

// Il limite più stretto fra due (porzioni contate e ingredienti); null = nessun limite.
export const tighterLimit = (a, b) => (a === null ? b : b === null ? a : Math.min(a, b));
