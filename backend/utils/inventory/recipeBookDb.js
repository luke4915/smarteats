// Carica dal database il «libro delle ricette» (la forma è descritta in recipeNeeds.js). Le quantità arrivano da PostgreSQL
// come testo (numeric): qui diventano numeri. Il libro è del locale corrente: ci pensa la RLS.

const toNumber = (value) => (value === null || value === undefined ? value : Number(value));

export async function loadRecipeBook(db, { modifierIds = [] } = {}) {
  const [ingredients, preparations, lines, modifiers] = await Promise.all([
    db.query('SELECT id, name, base_unit, yield_percent, quantity_on_hand, marked_out, weighted_average_cost FROM ingredients'),
    db.query('SELECT id, output_quantity FROM preparations'),
    db.query('SELECT product_id, preparation_id, ingredient_id, component_preparation_id, quantity FROM recipe_lines ORDER BY id'),
    modifierIds.length
      ? db.query(
        `SELECT m.id, m.affects_stock, l.ingredient_id, l.quantity_change
         FROM modifiers m LEFT JOIN modifier_recipe_lines l ON l.modifier_id = m.id WHERE m.id = ANY($1::int[])`, [modifierIds])
      : { rows: [] },
  ]);

  const book = {
    ingredients: new Map(ingredients.rows.map(i => [i.id, {
      ...i, yield_percent: Number(i.yield_percent), quantity_on_hand: Number(i.quantity_on_hand), weighted_average_cost: Number(i.weighted_average_cost),
    }])),
    preparations: new Map(preparations.rows.map(p => [p.id, { id: p.id, output_quantity: Number(p.output_quantity), lines: [] }])),
    productLines: new Map(),
    modifierLines: new Map(),
  };
  for (const row of lines.rows) {
    const line = { ingredient_id: row.ingredient_id, component_preparation_id: row.component_preparation_id, quantity: Number(row.quantity) };
    if (row.preparation_id != null) book.preparations.get(row.preparation_id)?.lines.push(line);
    else book.productLines.set(Number(row.product_id), [...(book.productLines.get(Number(row.product_id)) ?? []), line]);
  }
  for (const row of modifiers.rows) {
    const entry = book.modifierLines.get(row.id) ?? { affects_stock: row.affects_stock, lines: [] };
    if (row.ingredient_id != null) entry.lines.push({ ingredient_id: row.ingredient_id, quantity_change: toNumber(row.quantity_change) });
    book.modifierLines.set(row.id, entry);
  }
  return book;
}

// Blocca (FOR UPDATE, in ordine di id: niente deadlock fra ordini insieme) gli ingredienti che un ordine sta per usare e
// aggiorna nel libro le quantità con quelle fresche. Va chiamata dentro la transazione dell'ordine.
export async function lockIngredients(db, book, ingredientIds) {
  if (!ingredientIds.length) return;
  const { rows } = await db.query(
    'SELECT id, quantity_on_hand, marked_out FROM ingredients WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE', [ingredientIds]);
  for (const row of rows) Object.assign(book.ingredients.get(row.id) ?? {}, { quantity_on_hand: Number(row.quantity_on_hand), marked_out: row.marked_out });
}
