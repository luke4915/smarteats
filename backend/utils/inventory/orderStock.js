// Gli ingredienti di un ordine: si scalano alla vendita e tornano (o diventano scarto) allo storno. È l'unico punto che le
// route e le funzioni degli ordini chiamano; le regole di calcolo sono in recipeNeeds.js (pure e provate).
//
// Vale solo per i locali con il magazzino in modalità «magazzino» e scarico «dalle ricette»: negli altri casi non fa nulla,
// quindi si può chiamare sempre senza controllare prima.
import { HttpError } from '../httpError.js';
import { getTenantModules } from '../tenantModules.js';
import { needsOfItems, findShortages, costCentsOf } from './recipeNeeds.js';
import { loadRecipeBook, lockIngredients } from './recipeBookDb.js';
import { recordMovements } from './ingredientMovementsDb.js';

const BYPASS_ROLES = ['admin', 'manager'];       // chi può vendere anche se un ingrediente non basta

const scalesFromRecipes = async (tenantId) => {
  const inventory = (await getTenantModules(tenantId))?.inventory;
  return inventory?.mode === 'warehouse' && inventory.depletion === 'recipes';
};

const modifierIdsOf = (items) => [...new Set(items.flatMap(i => (i.modifiers ?? []).map(m => m.id)))];

// Prima di scrivere l'ordine: gli ingredienti bastano? Se no, 409 INGREDIENT_SHORTAGE; admin e responsabile possono
// forzare (`force`). Blocca gli ingredienti usati: altri ordini nello stesso momento aspettano il loro turno.
// Non serve per un ordine già venduto (sincronizzato in ritardo): passare `skip: true`.
export async function assertIngredientsAvailable(db, { tenantId, items, role, force = false, skip = false }) {
  if (skip || !(await scalesFromRecipes(tenantId))) return;
  const book = await loadRecipeBook(db, { modifierIds: modifierIdsOf(items) });
  const { total } = needsOfItems(items, book);
  await lockIngredients(db, book, [...total.keys()].sort((a, b) => a - b));
  const shortages = findShortages(total, book);
  if (!shortages.length || (force && BYPASS_ROLES.includes(role))) return;
  const names = shortages.map(s => s.ingredient.name).join(', ');
  throw new HttpError(409, `Ingrediente esaurito o insufficiente: ${names}`, 'INGREDIENT_SHORTAGE');
}

// Dopo aver scritto l'ordine e le sue righe: scala gli ingredienti (un movimento `sale` per ingrediente) e salva il costo
// teorico di ogni riga (`order_items.cost_cents`, il costo medio del momento). Ritorna true se ha scalato qualcosa.
export async function sellIngredients(db, { tenantId, orderId, items, sessionId, userId }) {
  if (!(await scalesFromRecipes(tenantId))) return false;
  const book = await loadRecipeBook(db, { modifierIds: modifierIdsOf(items) });
  const { total, perLine } = needsOfItems(items, book);

  for (const [position, needs] of perLine.entries()) {
    if (!needs.size) continue;
    await db.query('UPDATE order_items SET cost_cents = $1 WHERE order_id = $2 AND position = $3', [costCentsOf(needs, book), orderId, position]);
  }
  await recordMovements(db, [...total].map(([ingredientId, quantity]) => ({ ingredientId, kind: 'sale', quantityChange: -quantity, orderId })), { sessionId, userId });
  return total.size > 0;
}

// Cosa fare degli ingredienti di un ordine stornato quando chi storna non lo dice: se in cucina non è partito nulla tornano
// in dispensa, altrimenti il cibo è già stato fatto e diventa scarto. `order` ha lo stato; `lines` lo stato di ogni riga.
export const defaultDisposition = (order, lines) =>
  (['preparing', 'completed'].includes(order.status) || lines.some(l => l.prep_status && l.prep_status !== 'new') ? 'waste' : 'return');

// Allo storno di un ordine: rimette in dispensa ciò che la vendita aveva scalato (`disposition: 'return'`) oppure lo registra
// come scarto (`'waste'`: il cibo è stato preparato). Legge il registro, quindi si può chiamare più volte: la seconda non fa nulla.
export async function returnIngredientsOfOrder(db, { tenantId, orderId, disposition, userId = null }) {
  const inventory = (await getTenantModules(tenantId))?.inventory;
  if (!inventory) return;
  const { rows } = await db.query(
    `SELECT ingredient_id, SUM(quantity_change) AS net FROM ingredient_movements
     WHERE order_id = $1 AND kind IN ('sale', 'sale_reversal') GROUP BY ingredient_id HAVING SUM(quantity_change) < -0.0000001`, [orderId]);
  if (!rows.length) return;
  const { rows: [order] } = await db.query('SELECT session_id FROM orders WHERE id = $1', [orderId]);
  const movements = rows.flatMap(({ ingredient_id: ingredientId, net }) => {
    const quantity = -Number(net);
    return [
      { ingredientId, kind: 'sale_reversal', quantityChange: quantity, orderId },
      ...(disposition === 'waste' ? [{ ingredientId, kind: 'waste', quantityChange: -quantity, orderId, reason: 'Ordine stornato, già preparato' }] : []),
    ];
  });
  await recordMovements(db, movements, { sessionId: order?.session_id ?? null, userId });
}
