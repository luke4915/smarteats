// Le scorte da tenere d'occhio: quanto dura ciò che c'è in dispensa al consumo recente e cosa è sotto la soglia minima.
// Il consumo viene dal registro dei movimenti (vendite, storni e scarichi di fine servizio), non da stime.
import { needsRestock } from './restockMath.js';
import { daysOfStock } from './reportMath.js';

// Gli ingredienti attivi con consumo medio al giorno, giorni di scorta rimasti e se sono da riordinare.
// `days` = quanti giorni indietro si guarda per il consumo; `onlyLow` tiene solo quelli da riordinare.
export async function stockOverview(db, { days, onlyLow }) {
  const { rows } = await db.query(
    `SELECT i.id, i.name, i.base_unit, i.quantity_on_hand, i.reorder_level, i.marked_out,
            COALESCE(-SUM(m.quantity_change) FILTER (WHERE m.kind IN ('sale', 'sale_reversal', 'usage') AND m.created_at >= now() - make_interval(days => $1)), 0) AS used,
            MAX(m.created_at) AS last_movement
     FROM ingredients i LEFT JOIN ingredient_movements m ON m.ingredient_id = i.id
     WHERE i.active GROUP BY i.id ORDER BY lower(i.name)`, [days]);
  const list = rows.map(r => {
    const onHand = Number(r.quantity_on_hand);
    const used = Math.max(Number(r.used), 0);
    return {
      id: r.id, name: r.name, base_unit: r.base_unit, quantity_on_hand: onHand,
      reorder_level: r.reorder_level === null ? null : Number(r.reorder_level), marked_out: r.marked_out,
      used_in_period: used, used_per_day: Math.round((used / days) * 1000) / 1000, days_of_stock: daysOfStock(onHand, used, days),
      low: needsRestock(onHand, r.reorder_level), last_movement: r.last_movement,
    };
  });
  return onlyLow ? list.filter(i => i.low) : list;
}
