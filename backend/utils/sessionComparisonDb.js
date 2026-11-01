// Le interrogazioni del confronto tra due serate: tutto aggregato dal database, per serata. La composizione è in sessionComparison.js.
import { isRevenue, isKitchenOrder } from './revenue.js';
import { COMPLETED_ITEMS, LINE_REVENUE } from './statsSql.js';
import { buildComparison } from './sessionComparison.js';

const FAST = `o.completed_at >= o.created_at AND o.completed_at - o.created_at < interval '180 minutes'`;

// `a` e `b` sono gli id delle due serate; ritorna null se una non esiste.
export async function loadComparison(db, a, b, tz) {
  const ids = [a, b];
  const { rows: found } = await db.query('SELECT id, name, start_time FROM sessions WHERE id = ANY($1)', [ids]);
  const sessions = ids.map(id => found.find(s => s.id === id));
  if (sessions.some(s => !s)) return null;
  const [totals, products, hours] = await Promise.all([
    db.query(
      `SELECT o.session_id, COUNT(*) FILTER (WHERE ${isKitchenOrder('o')})::int AS n, COALESCE(SUM(o.total), 0) AS revenue,
              AVG(EXTRACT(EPOCH FROM (o.completed_at - o.created_at)) / 60) FILTER (WHERE ${isKitchenOrder('o')} AND ${FAST}) AS avg_minutes
       FROM orders o WHERE ${isRevenue('o')} AND o.session_id = ANY($1) GROUP BY o.session_id`, [ids]),
    // Per id di prodotto, non per nome: un prodotto rinominato resta uno solo.
    db.query(
      `SELECT o.session_id, i.product_id, COALESCE(p.name, MAX(i.name)) AS name, COALESCE(MAX(i.category), MAX(p.category), 'Altro') AS category,
              SUM(i.quantity) AS quantity, SUM(${LINE_REVENUE}) AS revenue
       ${COMPLETED_ITEMS} AND o.session_id = ANY($1) GROUP BY o.session_id, i.product_id, p.name`, [ids]),
    db.query(
      `SELECT o.session_id, EXTRACT(hour FROM o.created_at AT TIME ZONE $2)::int AS hour, COUNT(*) FILTER (WHERE ${isKitchenOrder('o')})::int AS n, SUM(o.total) AS revenue
       FROM orders o WHERE ${isRevenue('o')} AND o.session_id = ANY($1) GROUP BY 1, 2`, [ids, tz]),
  ]);
  return buildComparison({ sessions, totals: totals.rows, products: products.rows, hours: hours.rows });
}
