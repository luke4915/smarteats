import { HttpError } from './httpError.js';
import { verifyOrderItems } from './orderLines.js';
import { writeOrderItems } from './orderItemsWrite.js';
import { sumQuantitiesByProduct, lockAndFindShortages, applyStockChange } from './stock.js';
import { formatDisplayCode } from './displayCode.js';
import { PORTAL_TZ, localNow } from './bookingPortal.js';
import { DEFAULTS, slotsOn, orderLoad, pickupIsDue } from './takeaway.js';
import { inTransaction } from '../db.js';
import logger from '../logger.js';

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

// Avvisa la cucina (e chi guarda lo stock) che è nato l'ordine di cucina di un asporto. `broadcast` è quello delle route.
export function announceKitchenOrder(broadcast, tenantId, created, row, pickupAt) {
  created.stockUpdates.forEach(product => broadcast?.(tenantId, { type: 'product_stock_updated', product }));
  broadcast?.(tenantId, { type: 'order_created', order: {
    id: created.order.id, check_id: null, table_name: null, covers: null, check_number: null, display_code: created.order.display_code,
    status: 'pending', created_at: created.order.created_at, items: created.items, total: created.total, is_takeaway: true,
    pickup_at: pickupAt, pickup_name: row.customer_name,
  } });
}

// Fa nascere gli ordini di cucina degli asporti accettati in anticipo il cui ritiro è per oggi (o già passato): si chiama
// all'apertura della serata, quando c'è finalmente una sessione dove metterli (e lo stock è appena ripartito). Ogni ordine
// ha la sua transazione: se uno non riesce (stock esaurito, prodotto cambiato) gli altri partono comunque e quello resta
// accettato, in attesa, con un avviso nel log. Ritorna gli ordini creati, per avvisare la cucina: [{ created, row }].
export async function fireDueTakeaway(db, { tenantId, userId }) {
  const { rows: waiting } = await db.query(
    `SELECT id, to_char(pickup_at AT TIME ZONE $1, 'YYYY-MM-DD') AS date
     FROM takeaway_orders WHERE status = 'accepted' AND order_id IS NULL ORDER BY pickup_at, id`, [PORTAL_TZ]);
  const now = localNow();
  const fired = [];
  for (const { id, date } of waiting.filter(w => pickupIsDue(w.date, now))) {
    try {
      const result = await inTransaction(db, async (tx) => {
        // si rilegge l'ordine bloccandolo: se nel frattempo è stato annullato o acceso da un altro, non si fa nulla
        const { rows: [row] } = await tx.query(
          `SELECT id, customer_name, items, pickup_at, total FROM takeaway_orders WHERE id = $1 AND status = 'accepted' AND order_id IS NULL FOR UPDATE`, [id]);
        if (!row) return null;
        const created = await createKitchenOrder(tx, { tenantId, userId, takeaway: row });
        await tx.query('UPDATE takeaway_orders SET order_id = $2, total = $3 WHERE id = $1', [id, created.order.id, created.total]);
        return { created, row };
      });
      if (result) fired.push(result);
    } catch (err) {
      logger.warn({ err, takeawayId: id }, 'Asporto accettato in anticipo: l\'ordine di cucina non è partito, resta in attesa');
    }
  }
  return fired;
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
