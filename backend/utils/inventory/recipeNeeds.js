// Quanto serve di ogni ingrediente per fare un piatto, una riga d'ordine o un intero ordine. Logica pura, senza database:
// la provano i test (tests/recipeNeeds.test.js) e la usano la vendita, lo storno e la disponibilità dei piatti.
//
// Il «libro delle ricette» (`book`) è tutto ciò che serve a calcolare, già caricato (utils/inventory/recipeBookDb.js):
//   ingredients   Map id → { id, name, yield_percent, quantity_on_hand, marked_out, weighted_average_cost }
//   preparations  Map id → { id, output_quantity, lines: [riga di ricetta] }
//   productLines  Map id del piatto → [riga di ricetta]
//   modifierLines Map id dell'opzione → { affects_stock, lines: [{ ingredient_id, quantity_change }] }
// Una riga di ricetta è { ingredient_id, component_preparation_id, quantity }: usa un ingrediente O una preparazione.
// Le quantità sono sempre nell'unità di base (grammi, millilitri, pezzi).

const MAX_DEPTH = 8;   // una preparazione dentro una preparazione dentro un'altra…: oltre è quasi certamente un giro in tondo

// Aggiunge `quantity` di un ingrediente alla mappa dei bisogni.
const add = (needs, ingredientId, quantity) => needs.set(ingredientId, (needs.get(ingredientId) ?? 0) + quantity);

// La quantità in ricetta è quella che finisce nel piatto: se l'ingrediente ha una resa dell'80% bisogna prenderne di più.
const rawQuantity = (book, ingredientId, usable) => usable / ((book.ingredients.get(ingredientId)?.yield_percent ?? 100) / 100);

// Gli ingredienti (quantità da scalare dalla dispensa) di una ricetta: Map ingredientId → quantità.
// `scale` moltiplica tutto (una preparazione usata a metà dose, due porzioni…).
export function needsOfRecipe(lines, book, scale = 1, depth = 0) {
  if (depth > MAX_DEPTH) throw new Error('Ricetta circolare: una preparazione usa se stessa');
  const needs = new Map();
  for (const line of lines ?? []) {
    if (line.ingredient_id != null) {
      add(needs, line.ingredient_id, rawQuantity(book, line.ingredient_id, Number(line.quantity) * scale));
    } else {
      const preparation = book.preparations.get(line.component_preparation_id);
      if (!preparation) continue;
      const inner = needsOfRecipe(preparation.lines, book, (Number(line.quantity) * scale) / Number(preparation.output_quantity), depth + 1);
      for (const [id, quantity] of inner) add(needs, id, quantity);
    }
  }
  return needs;
}

// Cosa serve per UNA porzione di un piatto con le opzioni scelte (`modifierIds`): ricetta più, per ogni opzione che scala il
// magazzino, gli ingredienti che aggiunge o toglie. Mai sotto zero per ingrediente («senza cipolla» non fa avanzare cipolla).
export function needsOfPortion(productId, modifierIds, book) {
  const needs = needsOfRecipe(book.productLines.get(productId), book);
  for (const id of modifierIds ?? []) {
    const modifier = book.modifierLines.get(id);
    if (!modifier?.affects_stock) continue;
    for (const line of modifier.lines) add(needs, line.ingredient_id, rawQuantity(book, line.ingredient_id, Number(line.quantity_change)));
  }
  for (const [id, quantity] of needs) if (quantity <= 0) needs.delete(id);
  return needs;
}

// Le righe di un ordine ({ id, quantity, modifiers: [{ id }] }): ritorna { total, perLine }, dove `total` somma tutto
// (cosa scalare dalla dispensa) e `perLine[i]` è ciò che ha usato la riga i (per il costo del piatto).
export function needsOfItems(items, book) {
  const total = new Map();
  const perLine = items.map(item => {
    const portion = needsOfPortion(Number(item.id), (item.modifiers ?? []).map(m => m.id), book);
    const needs = new Map([...portion].map(([id, quantity]) => [id, quantity * item.quantity]));
    for (const [id, quantity] of needs) add(total, id, quantity);
    return needs;
  });
  return { total, perLine };
}

// Costo in centesimi di un insieme di bisogni, al costo medio di adesso. Arrotondato al centesimo.
export const costCentsOf = (needs, book) => Math.round([...needs].reduce((sum, [id, quantity]) => sum + quantity * Number(book.ingredients.get(id)?.weighted_average_cost ?? 0), 0));

// Gli ingredienti che non bastano per soddisfare `total`: [{ ingredient, needed, available }]. Uno segnato esaurito non basta mai.
export function findShortages(total, book) {
  const shortages = [];
  for (const [id, needed] of total) {
    const ingredient = book.ingredients.get(id);
    if (!ingredient || needed <= 0) continue;
    const available = ingredient.marked_out ? 0 : Math.max(Number(ingredient.quantity_on_hand), 0);
    if (available + 1e-9 < needed) shortages.push({ ingredient, needed, available });
  }
  return shortages;
}

// Quante porzioni di un piatto si possono fare con la dispensa di adesso. null = il piatto non ha ricetta (nessun limite dagli ingredienti).
export function portionsFromIngredients(productId, book) {
  const needs = needsOfPortion(productId, [], book);
  if (needs.size === 0) return null;
  let possible = Infinity;
  for (const [id, needed] of needs) {
    const ingredient = book.ingredients.get(id);
    const available = !ingredient || ingredient.marked_out ? 0 : Math.max(Number(ingredient.quantity_on_hand), 0);
    possible = Math.min(possible, Math.floor((available + 1e-9) / needed));
  }
  return possible;
}

// Una preparazione che, direttamente o no, usa se stessa: rende la ricetta infinita. Si controlla prima di salvare.
// `lines`: le righe che si vogliono salvare per `preparationId`; `preparations`: Map id → { lines } di tutte le altre.
export function usesItself(preparationId, lines, preparations) {
  const visiting = new Set([preparationId]);
  const visit = (rows) => (rows ?? []).some(row => {
    const next = row.component_preparation_id;
    if (next == null) return false;
    if (visiting.has(next)) return true;
    visiting.add(next);
    const found = visit(preparations.get(next)?.lines);
    visiting.delete(next);
    return found;
  });
  return visit(lines);
}
