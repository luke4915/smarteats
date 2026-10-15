import { HttpError } from './httpError.js';
import { verifyOrderItems } from './orderLines.js';
import { writeOrderItems } from './orderItemsWrite.js';
import { sumQuantitiesByProduct, lockAndFindShortages, applyStockChange } from './stock.js';
import { formatDisplayCode } from './displayCode.js';
import { PORTAL_TZ } from './bookingPortal.js';
import { DEFAULTS, slotsOn, orderLoad } from './takeaway.js';

// Accesso ai dati dell'asporto, condiviso da chi gestisce (routes/takeaway.js) e dai clienti (routes/publicTakeaway.js).
// Va chiamato con la connessione del locale (RLS).

const KEYS = ['takeaway_portal_enabled', 'takeaway_slot_minutes', 'takeaway_slot_capacity', 'takeaway_min_lead_minutes', 'takeaway_phone', 'takeaway_welcome'];

export async function loadSettings(db) {
  const { rows } = await db.query('SELECT key, value FROM settings WHERE key = ANY($1)', [KEYS]);
  const s = Object.fromEntries(rows.map(r => [r.key, r.value]));
  const int = (v, d) => (Number.isInteger(Number(v)) && v !== undefined && v !== null && v !== '' ? Number(v) : d);
  return {
    enabled: s.takeaway_portal_enabled === '1',
    slotMinutes: int(s.takeaway_slot_minutes, DEFAULTS.slotMinutes),
    capacity: int(s.takeaway_slot_capacity, DEFAULTS.capacity),
    minLeadMinutes: int(s.takeaway_min_lead_minutes, DEFAULTS.minLeadMinutes),
    phone: s.takeaway_phone ?? '',
    welcome: s.takeaway_welcome ?? '',
  };
}

export async function loadHours(db) {
  const { rows } = await db.query(
    `SELECT id, weekday, to_char(open_time, 'HH24:MI') AS open_time, to_char(close_time, 'HH24:MI') AS close_time FROM takeaway_hours ORDER BY weekday, open_time`);
  return rows;
}

// Carico già preso in ogni fascia di un giorno: gli ordini vivi (da approvare o accettati) contano, gli altri no.
export async function loadByTime(db, date, { excludeId = null } = {}) {
  const { rows } = await db.query(
    `SELECT to_char(pickup_at AT TIME ZONE $2, 'HH24:MI') AS time, SUM(load)::int AS load
     FROM takeaway_orders
     WHERE status IN ('requested', 'accepted') AND (pickup_at AT TIME ZONE $2)::date = $1::date AND ($3::int IS NULL OR id <> $3)
     GROUP BY 1`, [date, PORTAL_TZ, excludeId]);
  return new Map(rows.map(r => [r.time, r.load]));
}

// Il carico di una lista di righe `{ id, quantity }`, dal catalogo.
export async function loadOfItems(db, items) {
  const ids = [...new Set(items.map(i => i.id))];
  const { rows } = await db.query('SELECT id, takeaway_load FROM products WHERE id = ANY($1)', [ids]);
  const map = new Map(rows.map(r => [r.id, r.takeaway_load]));
  return orderLoad(items, id => map.get(id));
}

export { slotsOn };

// L'ordine di cucina di un ordine da asporto accettato: sulla sessione aperta, con righe e stock. Ritorna i dati per
// avvisare la cucina. Lancia HttpError (409 NO_ACTIVE_SESSION, 409 OUT_OF_STOCK, 400 prodotto non valido).
export async function createKitchenOrder(db, { tenantId, userId, takeaway, role = 'cashier' }) {
  const { rows: sessions } = await db.query(
    'UPDATE sessions SET order_counter = order_counter + 1 WHERE end_time IS NULL RETURNING id, order_counter');
  if (!sessions.length) throw new HttpError(409, 'Nessun servizio aperto: aprilo prima di accettare ordini', 'NO_ACTIVE_SESSION');
  const session = sessions[0];

  // Si ricalcolano le righe dal catalogo (il prezzo può essere cambiato dopo la richiesta)
  const { items, total } = await verifyOrderItems(db, takeaway.items.map(i => ({ id: i.id, quantity: i.quantity, note: i.note || '' })), role);
  const totals = sumQuantitiesByProduct(items);
  const shortages = await lockAndFindShortages(db, totals);
  if (shortages.length) throw new HttpError(409, `Prodotto esaurito o insufficiente: ${shortages.map(p => p.name).join(', ')}`, 'OUT_OF_STOCK');

  const displayCode = formatDisplayCode(session.order_counter);
  const { rows: [order] } = await db.query(
    `INSERT INTO orders (total, status, created_by, order_type, is_takeaway, display_code, session_id)
     VALUES ($1, 'pending', $2, 'sale', true, $3, $4) RETURNING id, created_at, display_code`,
    [total, userId, displayCode, session.id]);
  await writeOrderItems(db, tenantId, order.id, items);
  const stockUpdates = await applyStockChange(db, totals, -1);
  return { order, items, total, stockUpdates };
}

// Annulla l'ordine di cucina (rifiuto dopo l'accettazione, annullo del locale): lo stock torna disponibile.
export async function cancelKitchenOrder(db, orderId) {
  const { rows } = await db.query(`UPDATE orders SET status = 'canceled' WHERE id = $1 AND status <> 'canceled' RETURNING id`, [orderId]);
  if (!rows.length) return [];
  const { rows: items } = await db.query('SELECT product_id AS id, quantity FROM order_items WHERE order_id = $1 AND product_id IS NOT NULL', [orderId]);
  return applyStockChange(db, sumQuantitiesByProduct(items.map(i => ({ id: Number(i.id), quantity: i.quantity }))), +1);
}

// Le righe come si conservano nella richiesta: quel che serve a mostrarla (nome, quantità, nota, importo di riga).
// L'ordine di cucina si ricalcola dal catalogo all'accettazione.
export const snapshotItems = (items) => items.map(i => ({ id: i.id, name: i.name, quantity: i.quantity, note: i.note || '', line_total: i.line_total }));
