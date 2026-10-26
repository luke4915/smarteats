import { HttpError } from './httpError.js';
import { formatDisplayCode, formatDeviceCode } from './displayCode.js';
import { sumQuantitiesByProduct, lockAndFindShortages, applyStockChange } from './stock.js';
import { computeExpectedCash, clampToSession } from './session.js';
import { writeOrderItems } from './orderItemsWrite.js';
import { assertIngredientsAvailable, sellIngredients } from './inventory/orderStock.js';

// Creazione di un ordine (POST /orders e le comande dei tavoli): la parte che scrive nel database, senza HTTP.
// La route (routes/orders.js) controlla chi può farlo, ricalcola i prezzi e dopo risponde e avvisa via WebSocket;
// qui stanno la sessione, il numero dell'ordine, lo stock e le righe. Va chiamata dentro una transazione.

// Un ordine offline si può sincronizzare nella sua sessione fino a 24 ore dalla chiusura.
const LATE_SYNC_WINDOW = '24 hours';

// Trova la sessione dell'ordine: quella aperta, oppure (ordini offline sincronizzati in ritardo)
// quella in cui l'ordine è stato battuto.
// Con `useCounter` (ordini senza dispositivo, accodati prima della 018) incrementa anche il contatore
// di sessione: il lock sulla riga mette in fila quegli ordini. Gli altri prendono solo un lock condiviso,
// che non li mette in fila tra loro ma impedisce la chiusura della sessione mentre l'ordine si scrive.
async function findOrderSession(db, sessionId, useCounter) {
  const lock = useCounter ? 'UPDATE sessions SET order_counter = order_counter + 1' : null;
  const target = sessionId === undefined ? 'end_time IS NULL' : 'id = $1 AND (end_time IS NULL OR end_time > now() - $2::interval)';
  const params = sessionId === undefined ? [] : [sessionId, LATE_SYNC_WINDOW];
  const { rows } = lock
    ? await db.query(`${lock} WHERE ${target} RETURNING id, order_counter, start_time, end_time`, params)
    : await db.query(`SELECT id, order_counter, start_time, end_time FROM sessions WHERE ${target} FOR SHARE`, params);
  if (rows.length) return rows[0];
  throw sessionId === undefined
    ? new HttpError(409, 'Nessuna sessione attiva: apri una sessione prima di inviare ordini', 'NO_ACTIVE_SESSION')
    : new HttpError(409, "La sessione dell'ordine non esiste o è chiusa da più di 24 ore", 'SESSION_CLOSED');
}

export const UNIQUE_ORDER_CONSTRAINTS = ['uniq_orders_client_order_id', 'uniq_orders_device_seq'];

// Codice ordine: se la cassa ha inviato dispositivo e numero (battuto e stampato in locale)
// il server ricompone lettera + numero, senza fidarsi del formato del client. Senza dispositivo
// (ordini accodati prima dell'aggiornamento) vale ancora il progressivo di sessione.
async function resolveDisplayCode(db, session, deviceId, deviceSeq) {
  if (deviceId === undefined) return formatDisplayCode(session.order_counter);
  const { rows } = await db.query('SELECT letter FROM devices WHERE id = $1', [deviceId]);
  if (!rows.length) throw new HttpError(400, 'Dispositivo non valido', 'INVALID_DEVICE');
  return formatDeviceCode(rows[0].letter, deviceSeq);
}

export async function findOrderByClientId(db, clientOrderId) {
  const { rows } = await db.query('SELECT id, display_code FROM orders WHERE client_order_id = $1', [clientOrderId]);
  return rows[0] || null;
}

export const duplicateResponse = (order) => ({ success: true, orderId: order.id, displayCode: order.display_code, duplicate: true });

// Scrive l'ordine con le sue righe, aggiorna lo stock (o il totale di cassa, per un ordine in ritardo su una sessione già
// chiusa) e ritorna ciò che serve per rispondere e avvisare. `verifiedItems` e `verifiedTotal` li ha già ricalcolati il
// server dal catalogo (`verifyOrderItems`): dal client non si prende mai un prezzo.
export async function insertOrder(db, { tenantId, userId, role, forceStock, verifiedItems, verifiedTotal, order_type, status, is_takeaway, client_order_id, session_id, client_created_at, device_id, device_seq, check_id }) {
  const isLateSync = session_id !== undefined;
  const session = await findOrderSession(db, session_id, device_id === undefined);
  const sessionOpen = !session.end_time;
  const displayCode = await resolveDisplayCode(db, session, device_id, device_seq);

  // Comanda su un conto: deve essere aperto e della sessione in corso. Il lock condiviso lascia entrare più
  // comande insieme ma impedisce di annullare o chiudere il conto mentre se ne scrive una.
  if (check_id !== undefined) {
    const { rows: checks } = await db.query('SELECT id, status, session_id FROM checks WHERE id = $1 FOR SHARE', [check_id]);
    if (!checks.length) throw new HttpError(404, 'Conto non trovato');
    if (checks[0].status !== 'open' || checks[0].session_id !== session.id)
      throw new HttpError(409, 'Il conto non è aperto', 'CHECK_CLOSED');
  }
  const totals = sumQuantitiesByProduct(verifiedItems);

  // Un ordine sincronizzato in ritardo è già stato venduto: non si rifiuta per stock (né per ingredienti).
  if (!isLateSync) {
    const shortages = await lockAndFindShortages(db, totals);
    if (shortages.length) {
      throw new HttpError(409, `Prodotto esaurito o insufficiente: ${shortages.map(p => p.name).join(', ')}`, 'OUT_OF_STOCK');
    }
  }
  await assertIngredientsAvailable(db, { tenantId, items: verifiedItems, role, force: forceStock, skip: isLateSync });

  // In una sessione già chiusa l'ordine è per forza concluso: entra nel totale
  // di cassa e non finisce in cucina.
  const orderStatus = sessionOpen ? (status || 'pending') : 'completed';
  const createdAt = isLateSync ? clampToSession(client_created_at, session) : null;

  const { rows } = await db.query(
    `INSERT INTO orders (total, status, created_by, order_type, is_takeaway, display_code, session_id, client_order_id, created_at, device_id, device_seq, check_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, now()), $10, $11, $12) RETURNING id, created_at, display_code`,
    [verifiedTotal, orderStatus, userId, order_type, !!is_takeaway,
      displayCode, session.id, client_order_id ?? null, createdAt, device_id ?? null, device_seq ?? null, check_id ?? null]
  );
  // Le righe sono parte dell'ordine: se non si scrivono, l'ordine non nasce (la transazione si annulla).
  await writeOrderItems(db, tenantId, rows[0].id, verifiedItems);
  await sellIngredients(db, { tenantId, orderId: rows[0].id, items: verifiedItems, sessionId: session.id, userId });

  // Lo stock riguarda la serata in corso: dopo la chiusura non si tocca più
  // (all'apertura della successiva riparte comunque da disponibilità illimitata).
  // Per una sessione chiusa si aggiorna invece il totale atteso in cassa.
  let stockUpdates = [];
  if (sessionOpen) {
    stockUpdates = await applyStockChange(db, totals, -1);
  } else {
    await db.query('UPDATE sessions SET expected_cash = $1 WHERE id = $2', [await computeExpectedCash(db, session.id), session.id]);
  }
  return { order: rows[0], orderStatus, sessionOpen, stockUpdates };
}
