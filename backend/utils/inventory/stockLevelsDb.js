// Il controllo di magazzino (conteggio fisico della dispensa): per ogni ingrediente contato si confronta quanto c'è davvero con
// quanto il registro si aspettava; la differenza diventa un movimento `stock_level` e la dispensa si allinea al conteggio.
// Va chiamata dentro una transazione.
import { HttpError } from '../httpError.js';
import { recordMovements } from './ingredientMovementsDb.js';

export async function createStockLevel(db, { userId, kind, notes, lines }) {
  const ids = lines.map(l => l.ingredient_id).sort((a, b) => a - b);
  const { rows } = await db.query('SELECT id, quantity_on_hand, weighted_average_cost FROM ingredients WHERE id = ANY($1::int[]) AND active ORDER BY id FOR UPDATE', [ids]);
  if (rows.length !== ids.length) throw new HttpError(400, 'Ingrediente non valido', 'INVALID_INGREDIENT');
  const expected = new Map(rows.map(r => [r.id, { quantity: Number(r.quantity_on_hand), averageCost: Number(r.weighted_average_cost) }]));

  const { rows: [session] } = await db.query('SELECT id FROM sessions ORDER BY (end_time IS NULL) DESC, start_time DESC LIMIT 1');
  const { rows: [level] } = await db.query(
    `INSERT INTO stock_levels (session_id, kind, status, notes, created_by, confirmed_at) VALUES ($1, $2, 'confirmed', $3, $4, now()) RETURNING id, created_at`,
    [session?.id ?? null, kind, notes, userId]);

  const movements = [];
  for (const l of lines) {
    const { quantity, averageCost } = expected.get(l.ingredient_id);
    await db.query('INSERT INTO stock_level_lines (stock_level_id, ingredient_id, expected_quantity, counted_quantity) VALUES ($1, $2, $3, $4)', [level.id, l.ingredient_id, quantity, l.counted_quantity]);
    movements.push({ ingredientId: l.ingredient_id, kind: 'stock_level', quantityChange: Math.round((l.counted_quantity - quantity) * 1000) / 1000, unitCost: averageCost, stockLevelId: level.id, reason: kind });
  }
  await recordMovements(db, movements, { userId, sessionId: session?.id ?? null });
  return { id: level.id, differences: movements.filter(m => m.quantityChange !== 0).length };
}
