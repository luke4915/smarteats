// Scrive le righe di una ricetta (di un piatto o di una preparazione), sostituendo quelle di prima. Prima controlla che
// ingredienti e preparazioni siano del locale (la chiave esterna non passa dalla RLS) e che una preparazione non usi se stessa.
import { HttpError } from '../httpError.js';
import { usesItself } from './recipeNeeds.js';

// `owner`: { productId } oppure { preparationId }. `lines`: [{ ingredient_id, component_preparation_id, quantity }].
export async function saveRecipeLines(db, owner, lines) {
  const ingredientIds = [...new Set(lines.map(l => l.ingredient_id).filter(Boolean))];
  const preparationIds = [...new Set(lines.map(l => l.component_preparation_id).filter(Boolean))];
  if (ingredientIds.length && (await db.query('SELECT id FROM ingredients WHERE id = ANY($1::int[])', [ingredientIds])).rowCount !== ingredientIds.length)
    throw new HttpError(400, 'Ingrediente non valido', 'INVALID_INGREDIENT');
  if (preparationIds.length && (await db.query('SELECT id FROM preparations WHERE id = ANY($1::int[])', [preparationIds])).rowCount !== preparationIds.length)
    throw new HttpError(400, 'Preparazione non valida', 'INVALID_PREPARATION');

  if (owner.preparationId !== undefined && preparationIds.length) {
    const { rows } = await db.query('SELECT preparation_id, component_preparation_id FROM recipe_lines WHERE preparation_id IS NOT NULL AND component_preparation_id IS NOT NULL AND preparation_id <> $1', [owner.preparationId]);
    const others = new Map();
    for (const r of rows) others.set(r.preparation_id, { lines: [...(others.get(r.preparation_id)?.lines ?? []), { component_preparation_id: r.component_preparation_id }] });
    if (usesItself(owner.preparationId, lines, others)) throw new HttpError(400, 'Una preparazione non può usare se stessa, nemmeno passando da un\'altra', 'RECIPE_LOOP');
  }

  const column = owner.productId !== undefined ? 'product_id' : 'preparation_id';
  const ownerId = owner.productId ?? owner.preparationId;
  await db.query(`DELETE FROM recipe_lines WHERE ${column} = $1`, [ownerId]);
  for (const l of lines)
    await db.query(`INSERT INTO recipe_lines (${column}, ingredient_id, component_preparation_id, quantity) VALUES ($1, $2, $3, $4)`, [ownerId, l.ingredient_id, l.component_preparation_id, l.quantity]);
}
