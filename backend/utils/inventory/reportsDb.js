// Le interrogazioni dei report del magazzino (i calcoli veri sono in reportMath.js, puri e provati). Tutto cade nel periodo
// scelto: per i ricavi si contano i servizi (sessioni) iniziati in quei giorni, per i movimenti la data in cui sono avvenuti.
// Importi in centesimi interi. Solo per chi gestisce il locale (sono costi e margini).
import { isRevenue } from '../revenue.js';
import { dishFigures, overviewFigures, inventoryValueCents } from './reportMath.js';

const DEFAULT_VAT = 10;

// I confini del periodo: gli id dei servizi, l'IVA predefinita e l'intervallo di tempo (per i movimenti).
async function periodOf(db, { from, to, tz }) {
  const [{ rows: sessions }, { rows: [vat] }, { rows: [range] }] = await Promise.all([
    db.query('SELECT id FROM sessions WHERE (start_time AT TIME ZONE $3)::date BETWEEN $1 AND $2', [from, to, tz]),
    db.query(`SELECT value FROM settings WHERE key = 'default_vat_rate'`),
    db.query('SELECT ($1::date::timestamp AT TIME ZONE $3) AS start, (($2::date + 1)::timestamp AT TIME ZONE $3) AS "end"', [from, to, tz]),
  ]);
  const defaultVat = Number(vat?.value);
  return { sessionIds: sessions.map(s => s.id), defaultVat: Number.isFinite(defaultVat) && vat?.value !== null ? defaultVat : DEFAULT_VAT, start: range.start, end: range.end };
}

// Per ogni piatto venduto nel periodo: ricavo, costo teorico, margine e food cost (solo per le righe con ricetta).
async function dishesOf(db, period) {
  if (!period.sessionIds.length) return [];
  const { rows } = await db.query(
    `SELECT oi.product_id, MAX(oi.name) AS name, SUM(oi.quantity)::int AS quantity,
            ROUND(SUM(oi.line_total) * 100)::bigint AS gross_cents,
            ROUND(COALESCE(SUM(oi.line_total) FILTER (WHERE oi.cost_cents IS NOT NULL), 0) * 100)::bigint AS gross_with_cost_cents,
            SUM(oi.cost_cents)::bigint AS cost_cents, COALESCE(MAX(p.vat_rate), $2::numeric) AS vat_rate
     FROM order_items oi JOIN orders o ON o.id = oi.order_id LEFT JOIN products p ON p.id = oi.product_id
     WHERE o.session_id = ANY($1::int[]) AND ${isRevenue('o')} AND oi.product_id IS NOT NULL
     GROUP BY oi.product_id ORDER BY 4 DESC`, [period.sessionIds, period.defaultVat]);
  return rows.map(r => {
    const f = dishFigures({ grossCents: Number(r.gross_cents), grossWithCostCents: Number(r.gross_with_cost_cents), costCents: r.cost_cents === null ? null : Number(r.cost_cents), vatRate: Number(r.vat_rate) });
    return { product_id: Number(r.product_id), name: r.name, quantity: r.quantity, vat_rate: Number(r.vat_rate), net_cents: f.netCents, cost_cents: f.costCents, margin_cents: f.marginCents, food_cost_percent: f.foodCostPercent, has_recipe: f.hasRecipe,
      netWithCostCents: f.hasRecipe ? Math.round(Number(r.gross_with_cost_cents) / (1 + Number(r.vat_rate) / 100)) : 0 };
  });
}

async function wasteOf(db, period) {
  const { rows } = await db.query(
    `SELECT split_part(m.reason, ':', 1) AS reason, m.ingredient_id, i.name, i.base_unit, SUM(-m.quantity_change) AS quantity,
            SUM(-m.quantity_change * COALESCE(m.unit_cost, i.weighted_average_cost)) AS value
     FROM ingredient_movements m JOIN ingredients i ON i.id = m.ingredient_id
     WHERE m.kind = 'waste' AND m.created_at >= $1 AND m.created_at < $2 AND m.quantity_change < 0 GROUP BY 1, 2, 3, 4 ORDER BY 6 DESC`, [period.start, period.end]);
  const items = rows.map(r => ({ reason: r.reason, ingredient_id: r.ingredient_id, name: r.name, base_unit: r.base_unit, quantity: Number(r.quantity), value_cents: Math.round(Number(r.value)) }));
  const byReason = new Map();
  for (const i of items) byReason.set(i.reason, (byReason.get(i.reason) ?? 0) + i.value_cents);
  return { total_cents: items.reduce((s, i) => s + i.value_cents, 0), by_reason: [...byReason].map(([reason, value_cents]) => ({ reason, value_cents })), items };
}

// Teorico contro reale: per gli ingredienti contati nel periodo, quanto mancava (o avanzava) rispetto al registro, e quanto si era usato in teoria.
async function varianceOf(db, period) {
  const { rows } = await db.query(
    `SELECT m.ingredient_id, i.name, i.base_unit,
            SUM(m.quantity_change) FILTER (WHERE m.kind = 'stock_level') AS difference,
            SUM(m.quantity_change * COALESCE(m.unit_cost, i.weighted_average_cost)) FILTER (WHERE m.kind = 'stock_level') AS difference_value,
            -COALESCE(SUM(m.quantity_change) FILTER (WHERE m.kind IN ('sale', 'sale_reversal')), 0) AS theoretical_used
     FROM ingredient_movements m JOIN ingredients i ON i.id = m.ingredient_id
     WHERE m.created_at >= $1 AND m.created_at < $2 GROUP BY 1, 2, 3
     HAVING SUM(m.quantity_change) FILTER (WHERE m.kind = 'stock_level') IS NOT NULL ORDER BY 5`, [period.start, period.end]);
  return rows.map(r => ({ ingredient_id: r.ingredient_id, name: r.name, base_unit: r.base_unit, difference: Number(r.difference), difference_value_cents: Math.round(Number(r.difference_value)), theoretical_used: Number(r.theoretical_used) }));
}

export async function buildReport(db, query) {
  const period = await periodOf(db, query);
  const [dishes, waste, variance, { rows: ingredients }] = await Promise.all([
    dishesOf(db, period), wasteOf(db, period), varianceOf(db, period),
    db.query('SELECT quantity_on_hand, weighted_average_cost FROM ingredients WHERE active'),
  ]);
  const totals = overviewFigures(dishes.map(d => ({ netCents: d.net_cents, netWithCostCents: d.netWithCostCents, costCents: d.cost_cents, hasRecipe: d.has_recipe })));
  return {
    from: query.from, to: query.to, default_vat_rate: period.defaultVat,
    totals: { net_cents: totals.netCents, cost_cents: totals.costCents, margin_cents: totals.marginCents, food_cost_percent: totals.foodCostPercent, recipe_coverage_percent: totals.recipeCoveragePercent },
    dishes: dishes.map(({ netWithCostCents: _unused, ...d }) => d),
    waste, variance, inventory_value_cents: inventoryValueCents(ingredients),
    variance_value_cents: variance.reduce((s, v) => s + v.difference_value_cents, 0),
  };
}


