// Il confronto tra due serate (o servizi): i numeri di ciascuna, ogni prodotto affiancato e l'andamento per ora. Il database aggrega
// (utils/sessionComparisonDb.js), qui si compone la risposta. Funzioni pure, provate in tests/sessionComparison.test.js.
const round2 = (n) => parseFloat(Number(n || 0).toFixed(2));

// Ordine delle ore di una serata: da mezzogiorno a mezzogiorno, come nel resto delle statistiche.
const SERVICE_HOURS = [...Array.from({ length: 12 }, (_, i) => i + 12), ...Array.from({ length: 12 }, (_, i) => i)];

function sideOf(session, totals) {
  const t = totals.find(r => r.session_id === session.id);
  const orders = t?.n ?? 0;
  const revenue = round2(t?.revenue);
  return {
    id: session.id, name: session.name || null, startTime: session.start_time,
    revenue, orders, avgOrder: orders ? round2(revenue / orders) : 0,
    avgMinutes: t?.avg_minutes == null ? null : parseFloat(Number(t.avg_minutes).toFixed(1)),
  };
}

/**
 * @param {object} input
 * @param {[{id:number,name:string|null,start_time:string}, {id:number,name:string|null,start_time:string}]} input.sessions  A e B
 * @param {Array<{session_id:number,n:number,revenue:string|number,avg_minutes:number|null}>} input.totals
 * @param {Array<{session_id:number,product_id:string|number,name:string,category:string|null,quantity:string|number,revenue:string|number}>} input.products
 * @param {Array<{session_id:number,hour:number,n:number,revenue:string|number}>} input.hours
 */
export function buildComparison({ sessions: [a, b], totals, products, hours }) {
  const byProduct = new Map();
  for (const r of products) {
    const id = Number(r.product_id);
    const entry = byProduct.get(id) ?? { id, name: r.name, category: r.category || 'Altro', a: { qty: 0, revenue: 0 }, b: { qty: 0, revenue: 0 } };
    const side = r.session_id === a.id ? entry.a : entry.b;
    side.qty += Number(r.quantity);
    side.revenue = round2(side.revenue + Number(r.revenue));
    byProduct.set(id, entry);
  }
  const list = [...byProduct.values()].map(p => ({ ...p, status: p.a.qty && p.b.qty ? 'both' : p.b.qty ? 'new' : 'gone' }))
    .sort((x, y) => (y.a.qty + y.b.qty) - (x.a.qty + x.b.qty) || x.name.localeCompare(y.name, 'it'));

  const hourOf = (sessionId, h) => hours.find(r => r.session_id === sessionId && r.hour === h);
  const active = SERVICE_HOURS.filter(h => hourOf(a.id, h) || hourOf(b.id, h));
  return {
    a: sideOf(a, totals), b: sideOf(b, totals), products: list,
    hours: active.map(h => ({ hour: h, a: { orders: hourOf(a.id, h)?.n ?? 0, revenue: round2(hourOf(a.id, h)?.revenue) }, b: { orders: hourOf(b.id, h)?.n ?? 0, revenue: round2(hourOf(b.id, h)?.revenue) } })),
  };
}
