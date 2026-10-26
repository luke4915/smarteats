// Scarti, rettifiche e scarico semplificato: movimenti scritti a mano, con il costo medio del momento (per valutarli nei report).
// Vanno chiamate dentro una transazione.
import { HttpError } from '../httpError.js';
import { recordMovements } from './ingredientMovementsDb.js';

// Blocca l'ingrediente e ne ritorna quantità e costo medio di adesso.
async function lockIngredient(db, ingredientId) {
  const { rows: [i] } = await db.query('SELECT id, quantity_on_hand, weighted_average_cost FROM ingredients WHERE id = $1 AND active FOR UPDATE', [ingredientId]);
  if (!i) throw new HttpError(400, 'Ingrediente non valido', 'INVALID_INGREDIENT');
  return { id: i.id, onHand: Number(i.quantity_on_hand), averageCost: Number(i.weighted_average_cost) };
}

// Uno scarto: la roba esce dalla dispensa e si tiene il motivo («broken», «expired»…, con la nota dopo i due punti).
export async function recordWaste(db, { ingredientId, quantity, reason, note, userId }) {
  const ingredient = await lockIngredient(db, ingredientId);
  await recordMovements(db, [{ ingredientId, kind: 'waste', quantityChange: -quantity, unitCost: ingredient.averageCost, reason: note ? `${reason}: ${note}` : reason }], { userId });
}

// Una rettifica con segno (+ entra, − esce): per correggere un errore, sempre con la sua nota.
export async function recordAdjustment(db, { ingredientId, quantityChange, note, userId }) {
  const ingredient = await lockIngredient(db, ingredientId);
  await recordMovements(db, [{ ingredientId, kind: 'adjustment', quantityChange, unitCost: ingredient.averageCost, reason: note }], { userId });
}

// Lo scarico semplificato (niente ricette): per ogni riga o si dice quanto è stato usato, o quanto resta (e l'usato si ricava).
export async function recordUsage(db, { lines, userId, sessionId = null }) {
  const ids = lines.map(l => l.ingredient_id).sort((a, b) => a - b);
  const { rows } = await db.query('SELECT id, quantity_on_hand, weighted_average_cost FROM ingredients WHERE id = ANY($1::int[]) AND active ORDER BY id FOR UPDATE', [ids]);
  if (rows.length !== ids.length) throw new HttpError(400, 'Ingrediente non valido', 'INVALID_INGREDIENT');
  const state = new Map(rows.map(r => [r.id, { onHand: Number(r.quantity_on_hand), averageCost: Number(r.weighted_average_cost) }]));
  const movements = lines.map(l => {
    const { onHand, averageCost } = state.get(l.ingredient_id);
    const used = l.used ?? onHand - l.remaining;
    if (used < 0) throw new HttpError(409, 'Ne è rimasto più di quanto c\'era: usa un controllo di magazzino per correggere la dispensa', 'REMAINING_ABOVE_STOCK');
    return { ingredientId: l.ingredient_id, kind: 'usage', quantityChange: -used, unitCost: averageCost };
  }).filter(m => m.quantityChange !== 0);
  await recordMovements(db, movements, { userId, sessionId });
  return movements.length;
}
