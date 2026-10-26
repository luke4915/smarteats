// Quanto si spende e a che prezzo: la spesa per fornitore in un periodo e gli ingredienti il cui prezzo d'acquisto è cambiato.
// Costi in centesimi senza IVA, come nei carichi di merce.
import { pricePerBaseUnit, priceChangePercent } from './restockMath.js';

export async function spendingOf(db, { from, to }) {
  const { rows } = await db.query(
    `SELECT s.id AS supplier_id, s.name, count(DISTINCT r.id)::int AS receipts, SUM(l.line_cost_cents)::int AS net_cents,
            ROUND(SUM(l.line_cost_cents * COALESCE(l.vat_rate, 0) / 100))::int AS vat_cents
     FROM goods_receipts r JOIN suppliers s ON s.id = r.supplier_id JOIN goods_receipt_lines l ON l.goods_receipt_id = r.id
     WHERE r.received_on BETWEEN $1::date AND $2::date GROUP BY s.id, s.name ORDER BY net_cents DESC, lower(s.name)`, [from, to]);
  return { total_cents: rows.reduce((sum, r) => sum + r.net_cents, 0), by_supplier: rows };
}

// Per ogni ingrediente e fornitore: l'ultimo carico del periodo contro quello precedente (di qualsiasi data). Si tengono solo i
// prezzi cambiati, dal rincaro più forte; chi ha un solo carico non ha un confronto.
export async function priceChangesOf(db, { from, to }) {
  const { rows } = await db.query(
    `WITH priced AS (
       SELECT l.ingredient_id, r.supplier_id, r.received_on, l.line_cost_cents, l.base_quantity,
              row_number() OVER (PARTITION BY l.ingredient_id, r.supplier_id ORDER BY r.received_on DESC, l.id DESC) AS rn
       FROM goods_receipt_lines l JOIN goods_receipts r ON r.id = l.goods_receipt_id WHERE r.received_on <= $2::date)
     SELECT i.id AS ingredient_id, i.name, i.base_unit, s.name AS supplier_name,
            a.line_cost_cents AS latest_cost, a.base_quantity AS latest_quantity, b.line_cost_cents AS previous_cost, b.base_quantity AS previous_quantity
     FROM priced a JOIN priced b ON b.ingredient_id = a.ingredient_id AND b.supplier_id = a.supplier_id AND b.rn = 2
       JOIN ingredients i ON i.id = a.ingredient_id JOIN suppliers s ON s.id = a.supplier_id
     WHERE a.rn = 1 AND a.received_on >= $1::date`, [from, to]);
  return rows
    .map(r => {
      const previous = pricePerBaseUnit(r.previous_cost, r.previous_quantity);
      const latest = pricePerBaseUnit(r.latest_cost, r.latest_quantity);
      return { ingredient_id: r.ingredient_id, name: r.name, base_unit: r.base_unit, supplier_name: r.supplier_name, previous_per_unit: previous, latest_per_unit: latest, change_percent: priceChangePercent(previous, latest) };
    })
    .filter(c => c.change_percent !== null && c.change_percent !== 0)
    .sort((a, b) => b.change_percent - a.change_percent);
}
