// Le righe per la matrice del menu: per ogni prodotto venduto nelle serate scelte, quanto, a che ricavo e (dove c'è una ricetta) a che costo.
// Gli omaggi non contano: non sono una scelta di acquisto e falserebbero ricavo e popolarità. Vedi menuMatrix.js per i conti.
import { isRevenue, isKitchenOrder } from './revenue.js';
import { buildMenuMatrix } from './menuMatrix.js';

const DEFAULT_VAT = 10;

// `sessions`: gli id delle serate scelte, o null per tutte.
export async function loadMenuMatrix(db, sessions) {
  const { rows: [vat] } = await db.query(`SELECT value FROM settings WHERE key = 'default_vat_rate'`);
  const configured = vat?.value == null ? NaN : Number(vat.value);
  const defaultVat = Number.isFinite(configured) ? configured : DEFAULT_VAT;
  const { rows } = await db.query(
      `SELECT i.product_id, COALESCE(p.name, MAX(i.name)) AS name, COALESCE(MAX(i.category), MAX(p.category), 'Altro') AS category,
              SUM(i.quantity)::int AS quantity, ROUND(SUM(i.line_total) * 100)::bigint AS gross_cents,
              COALESCE(SUM(i.quantity) FILTER (WHERE i.cost_cents IS NOT NULL), 0)::int AS costed_quantity,
              ROUND(COALESCE(SUM(i.line_total) FILTER (WHERE i.cost_cents IS NOT NULL), 0) * 100)::bigint AS gross_with_cost_cents,
              SUM(i.cost_cents)::bigint AS cost_cents, COALESCE(MAX(p.vat_rate), $2::numeric) AS vat_rate
       FROM orders o JOIN order_items i ON i.order_id = o.id LEFT JOIN products p ON p.id = i.product_id
       WHERE ${isRevenue('o')} AND ${isKitchenOrder('o')} AND i.line_type <> 'gift' AND i.product_id IS NOT NULL
         AND ($1::int[] IS NULL OR o.session_id = ANY($1))
       GROUP BY i.product_id, p.name`, [sessions, defaultVat]);
  return buildMenuMatrix(rows.map(r => ({
    product_id: Number(r.product_id), name: r.name, category: r.category, quantity: r.quantity, gross_cents: Number(r.gross_cents),
    costed_quantity: r.costed_quantity, gross_with_cost_cents: Number(r.gross_with_cost_cents), cost_cents: r.cost_cents === null ? null : Number(r.cost_cents),
    vat_rate: Number(r.vat_rate),
  })));
}
