// Tavolo e coperti delle comande: un ordine di un conto porta il nome del tavolo, i coperti e il numero del conto,
// così cucina, KDS e stampa dicono "Tavolo 5 · 4 coperti". Gli ordini pagati subito li hanno nulli.
export async function withCheckInfo(db, orders) {
  const ids = [...new Set(orders.map(o => o.check_id).filter(Boolean))];
  const info = new Map();
  if (ids.length) {
    const { rows } = await db.query(
      `SELECT c.id, c.number, c.covers, c.opened_by, t.name AS table_name
       FROM checks c LEFT JOIN dining_tables t ON t.id = c.table_id WHERE c.id = ANY($1)`, [ids]);
    for (const r of rows) info.set(r.id, r);
  }
  // Asporto: l'ordine di cucina porta orario di ritiro, nome di chi ritira e codice di ritiro
  const orderIds = orders.filter(o => o.id !== undefined && o.check_id == null).map(o => o.id);
  const pickups = new Map();
  if (orderIds.length) {
    const { rows } = await db.query('SELECT order_id, pickup_at, customer_name, pickup_code FROM takeaway_orders WHERE order_id = ANY($1)', [orderIds]);
    for (const r of rows) pickups.set(r.order_id, r);
  }
  return orders.map(o => {
    const c = o.check_id ? info.get(o.check_id) : null;
    const p = pickups.get(o.id);
    return {
      ...o, table_name: c?.table_name ?? null, covers: c?.covers ?? null, check_number: c?.number ?? null, check_opened_by: c?.opened_by ?? null,
      pickup_at: p?.pickup_at ?? null, pickup_name: p?.customer_name ?? null, pickup_code: p?.pickup_code ?? null,
    };
  });
}
