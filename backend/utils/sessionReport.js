// Il report di una serata (per il PDF e per chi vuole i numeri): il database aggrega, qui si compone la risposta. `buildSessionReport`
// è pura (tests/sessionReport.test.js); `loadSessionReport` fa le query. Cosa conta come incasso lo dice sempre utils/revenue.js.
import { isRevenue, isKitchenOrder } from './revenue.js';
import { computeExpectedCash } from './session.js';

const round2 = (n) => parseFloat(Number(n || 0).toFixed(2));
const METHOD_LABEL = { cash: 'Contanti', card: 'Carta', other: 'Altro', register: 'Incasso alla cassa' };
const MAX_CANCELED_LISTED = 30;

// `raw`: i risultati grezzi delle query (stringhe numeriche di pg incluse). Ritorna il report nella forma che il client disegna.
export function buildSessionReport(raw) {
  const { session, locale, totals, adjustments, products, byHour, bySource, methods, registerTotal, checks, canceled, expectedCash } = raw;
  const revenue = round2(totals.total);
  const orders = Number(totals.n);
  const covers = Number(checks.covers ?? 0);
  const declared = session.declared_cash == null ? null : round2(session.declared_cash);

  const categories = new Map();
  for (const p of products) {
    const key = p.category || 'Altro';
    const row = categories.get(key) ?? { category: key, quantity: 0, revenue: 0 };
    row.quantity += Number(p.quantity); row.revenue += Number(p.revenue);
    categories.set(key, row);
  }

  const payments = [
    ...(round2(registerTotal) > 0 ? [{ method: 'register', label: METHOD_LABEL.register, amount: round2(registerTotal) }] : []),
    ...methods.map(m => ({ method: m.method, label: METHOD_LABEL[m.method] ?? m.method, amount: round2(m.amount) })),
  ];

  return {
    locale: { name: locale.name, businessType: locale.business_type },
    session: { id: session.id, name: session.name, start: session.start_time, end: session.end_time, open: !session.end_time },
    summary: {
      revenue, orders,
      averageOrder: orders ? round2(revenue / orders) : 0,
      takeawayOrders: Number(totals.takeaway),
      canceledCount: canceled.length,
      canceledTotal: round2(canceled.reduce((sum, c) => sum + Number(c.total), 0)),
      discountTotal: round2(adjustments.discount),
      giftTotal: round2(adjustments.gift),
      checks: Number(checks.n ?? 0), covers,
      averagePerCover: covers ? round2(revenue / covers) : 0,
      averageCheckMinutes: checks.avg_minutes == null ? null : Math.round(Number(checks.avg_minutes)),
    },
    // Chiusura di cassa: solo contanti. `declared` è ciò che si è contato alla chiusura (nullo se la serata è ancora aperta)
    cash: { expected: round2(expectedCash), declared, difference: declared == null ? null : round2(declared - expectedCash) },
    payments,
    categories: [...categories.values()].map(c => ({ ...c, revenue: round2(c.revenue), share: revenue ? round2((c.revenue / revenue) * 100) : 0 })).sort((a, b) => b.revenue - a.revenue),
    products: products.map(p => ({ name: p.name, category: p.category || 'Altro', quantity: Number(p.quantity), gifts: Number(p.gifts ?? 0), revenue: round2(p.revenue) }))
      .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, 'it')),
    byHour: byHour.map(h => ({ hour: Number(h.hour), orders: Number(h.n), revenue: round2(h.total) })).sort((a, b) => ((a.hour + 12) % 24) - ((b.hour + 12) % 24)),
    // Da dove arrivano gli ordini: la lettera di ogni cassa; `null` = senza cassa (sala, asporto accettato dal locale)
    bySource: bySource.map(s => ({ source: s.letter ?? null, orders: Number(s.n), revenue: round2(s.total) })).sort((a, b) => b.revenue - a.revenue),
    canceled: canceled.slice(0, MAX_CANCELED_LISTED).map(c => ({ code: c.display_code, total: round2(c.total), at: c.created_at })),
  };
}

// Una riga per prodotto venduto nella serata (per id, non per nome: un prodotto rinominato resta uno solo). Serve al report e al CSV dei prodotti.
export async function loadProductTotals(db, sessionId) {
  const { rows } = await db.query(
    `SELECT i.product_id, COALESCE(p.name, MAX(i.name)) AS name, COALESCE(MAX(i.category), MAX(p.category), 'Altro') AS category,
            SUM(i.quantity) AS quantity, COALESCE(SUM(i.quantity) FILTER (WHERE i.line_type = 'gift'), 0) AS gifts, SUM(i.line_total) AS revenue
     FROM orders o JOIN order_items i ON i.order_id = o.id LEFT JOIN products p ON p.id = i.product_id
     WHERE ${isRevenue('o')} AND o.session_id = $1 GROUP BY i.product_id, p.name`, [sessionId]);
  return rows;
}

// Raccoglie dal database tutto ciò che serve al report di `sessionId`. Ritorna null se la serata non esiste.
export async function loadSessionReport(db, sessionId, tz, tenantId) {
  const { rows: [session] } = await db.query('SELECT id, name, start_time, end_time, declared_cash FROM sessions WHERE id = $1', [sessionId]);
  if (!session) return null;
  const inSession = 'o.session_id = $1';
  const kitchen = isKitchenOrder('o');
  const [locale, totals, adjustments, products, byHour, bySource, methods, register, checks, canceled] = await Promise.all([
    db.query('SELECT name, business_type FROM tenants WHERE id = $1', [tenantId]),
    db.query(
      `SELECT COUNT(*) FILTER (WHERE ${kitchen})::int AS n, COALESCE(SUM(o.total), 0) AS total, COUNT(*) FILTER (WHERE ${kitchen} AND o.is_takeaway)::int AS takeaway
       FROM orders o WHERE ${isRevenue('o')} AND ${inSession}`, [sessionId]),
    db.query(
      `SELECT COALESCE(SUM(CASE WHEN i.line_type = 'discount' THEN COALESCE(i.original_price, 0) * i.quantity - i.line_total ELSE 0 END), 0) AS discount,
              COALESCE(SUM(CASE WHEN i.line_type = 'gift' THEN COALESCE(i.original_price, 0) * i.quantity ELSE 0 END), 0) AS gift
       FROM orders o JOIN order_items i ON i.order_id = o.id
       WHERE ${isRevenue('o')} AND ${kitchen} AND i.line_type <> 'sale' AND ${inSession}`, [sessionId]),
    loadProductTotals(db, sessionId),
    db.query(
      `SELECT EXTRACT(hour FROM o.created_at AT TIME ZONE $2)::int AS hour, COUNT(*) FILTER (WHERE ${kitchen})::int AS n, SUM(o.total) AS total
       FROM orders o WHERE ${isRevenue('o')} AND ${inSession} GROUP BY 1`, [sessionId, tz]),
    db.query(
      `SELECT d.letter, COUNT(*) FILTER (WHERE ${kitchen})::int AS n, SUM(o.total) AS total
       FROM orders o LEFT JOIN devices d ON d.id = o.device_id WHERE ${isRevenue('o')} AND ${inSession} GROUP BY d.letter`, [sessionId]),
    db.query(
      `SELECT p.method, SUM(p.amount) AS amount FROM payments p JOIN checks c ON c.id = p.check_id
       WHERE c.status = 'paid' AND c.session_id = $1 GROUP BY p.method ORDER BY p.method`, [sessionId]),
    db.query(`SELECT COALESCE(SUM(o.total), 0) AS total FROM orders o WHERE o.check_id IS NULL AND ${isRevenue('o')} AND ${inSession}`, [sessionId]),
    db.query(
      `SELECT COUNT(*)::int AS n, COALESCE(SUM(c.covers), 0)::int AS covers,
              AVG(EXTRACT(EPOCH FROM (c.closed_at - c.opened_at)) / 60) FILTER (WHERE c.closed_at - c.opened_at < interval '6 hours') AS avg_minutes
       FROM checks c WHERE c.status = 'paid' AND c.session_id = $1`, [sessionId]),
    db.query(
      `SELECT o.display_code, o.total, o.created_at FROM orders o WHERE o.status = 'canceled' AND ${kitchen} AND ${inSession} ORDER BY o.created_at`, [sessionId]),
  ]);
  return buildSessionReport({
    session, locale: locale.rows[0] ?? { name: '', business_type: 'street_food' }, totals: totals.rows[0], adjustments: adjustments.rows[0], products,
    byHour: byHour.rows, bySource: bySource.rows, methods: methods.rows, registerTotal: register.rows[0].total, checks: checks.rows[0], canceled: canceled.rows,
    expectedCash: await computeExpectedCash(db, sessionId),
  });
}
