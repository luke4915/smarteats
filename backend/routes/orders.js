import express from 'express';
import { inTransaction } from '../db.js';
import { authenticate, authorizeCash, CASH_ROLES, WAITER_ROLES } from '../middleware/authenticate.js';
import { tenantScope, withTenantClient } from '../middleware/tenantScope.js';
import { resolveTenantFromHost } from '../middleware/resolveTenantFromHost.js';
import { verifyOrderItems } from '../utils/orderLines.js';
import logger from '../logger.js';
import { logAudit } from '../utils/auditLogger.js';
import { createOrderSchema, updateOrderStatusSchema, reprintAuditSchema } from '../schemas/orderSchema.js';
import { listOrdersQuerySchema } from '../schemas/statsSchema.js';
import { idParamsSchema } from '../schemas/common.js';
import { validate } from '../middleware/validate.js';
import { toPublicOrder } from '../utils/publicOrder.js';
import { sumQuantitiesByProduct, applyStockChange } from '../utils/stock.js';
import { HttpError, sendHttpError } from '../utils/httpError.js';
import { insertOrder, findOrderByClientId, duplicateResponse, UNIQUE_ORDER_CONSTRAINTS } from '../utils/createOrder.js';
import { loadItems, withItems } from '../utils/orderItemsRead.js';
import { requireModule, getTenantModules } from '../utils/tenantModules.js';
import { setLineStatus } from '../utils/lineStatus.js';
import { afterOrderCompleted } from '../utils/whatsapp/outbox.js';
import { lineStatusSchema } from '../schemas/lineStatusSchema.js';
import { withCheckInfo } from '../utils/orderCheck.js';
import { lockCheck, assertOrderCancelable } from '../utils/payments.js';
import { getCheckSummary } from '../utils/checks.js';
import { returnIngredientsOfOrder, defaultDisposition } from '../utils/inventory/orderStock.js';

const router = express.Router();

const TERMINAL_STATUSES = ['canceled', 'completed'];

// Ordini modalità "semplice": nascono già 'completed' ma senza completed_at
// (valorizzato solo dal flusso cucina). Per questi lo storno è ammesso entro 5 minuti.
const CANCEL_WINDOW_MS = 5 * 60 * 1000;

export default function (broadcast) {

  // GET /orders — mai l'intero storico: o gli ordini della sessione aperta (`session=active`, `status=` per filtrare),
  // o una pagina alla volta (`limit`, e `before` = id dell'ultimo ricevuto per la pagina successiva).
  // Le statistiche non passano di qui: le calcola il database (routes/stats.js).
  router.get('/', authenticate, validate({ query: listOrdersQuerySchema }), tenantScope, async (req, res) => {
    try {
      const { session, status, limit, before } = req.validQuery;
      const { rows } = await req.db.query(
        `SELECT o.* FROM orders o
         ${session === 'active' ? 'JOIN sessions s ON s.id = o.session_id AND s.end_time IS NULL' : ''}
         WHERE ($1::text[] IS NULL OR o.status = ANY($1))
           AND ($2::int IS NULL OR o.id < $2)
         ORDER BY o.id DESC LIMIT $3`,
        [status ?? null, before ?? null, session === 'active' ? 2000 : limit]
      );

      // 🚀 FIX CRITICO: Recuperiamo la mappatura attuale dei prodotti dal DB per associare le categorie
      const { rows: dbProducts } = await req.db.query('SELECT id, category FROM products');
      const categoryMap = Object.fromEntries(dbProducts.map(p => [p.id, p.category || 'Altro']));

      // Rispediamo i dati mappandoli in modo che ogni item abbia la sua categoria reale
      const mappedRows = (await withCheckInfo(req.db, await withItems(req.db, rows))).map(o => ({
        ...o,
        items: o.items.map(i => ({
          ...i,
          // Se la riga non ha la categoria, la prendiamo dalla mappa aggiornata tramite l'ID prodotto
          category: i.category || categoryMap[i.id] || 'Altro'
        })),
      }));

      res.json(mappedRows);
    } catch (err) {
      logger.error({ err }, 'Errore GET /api/orders:')
      res.status(500).json({ error: 'Errore nel recupero degli ordini' });
    }
  });

  // POST /orders (Creazione Ordine)
  router.post('/', authenticate, authorizeCash, validate({ body: createOrderSchema }), tenantScope, async (req, res) => {
    const { items, status, is_takeaway, client_order_id, session_id, client_created_at, device_id, device_seq, check_id } = req.body;

    // Idempotenza: un ordine già ricevuto (retry dopo un errore di rete o dalla
    // coda offline) non si duplica, si risponde con quello esistente.
    try {
      if (client_order_id) {
        const existing = await findOrderByClientId(req.db, client_order_id);
        if (existing) return res.json(duplicateResponse(existing));
      }

      // Le comande dei tavoli esistono solo nei locali con il modulo `tables`.
      if (check_id !== undefined && !(await getTenantModules(req.user.tenantId))?.modules.includes('tables'))
        return res.status(403).json({ error: 'Funzione non attiva per questo locale', code: 'MODULE_DISABLED' });
    } catch (err) {
      logger.error({ err }, 'Errore POST /api/orders (controlli iniziali)');
      return res.status(500).json({ error: "Errore durante l'invio dell'ordine" });
    }

    const isLateSync = session_id !== undefined;

    try {
      const { items: verifiedItems, total: verifiedTotal, orderType: order_type } = await verifyOrderItems(req.db, items, req.user.role);
      const { order, orderStatus, sessionOpen, stockUpdates } = await inTransaction(req.db, async (db) => {
        return insertOrder(db, { tenantId: req.user.tenantId, userId: req.user.id, role: req.user.role, forceStock: req.body.force_stock, verifiedItems, verifiedTotal, order_type, status, is_takeaway, client_order_id, session_id, client_created_at, device_id, device_seq, check_id });
      });

      await logAudit(req.db, req.user.id, 'CREATE_ORDER', {
        orderId: order.id,
        total: verifiedTotal,
        itemCount: verifiedItems.length,
        ...(check_id !== undefined && { checkId: check_id }),
        ...(isLateSync && { lateSync: true, sessionId: session_id, sessionClosed: !sessionOpen })
      });

      const [withTable] = await withCheckInfo(req.db, [{ check_id }]);
      const orderData = {
        id: order.id,
        check_id: check_id ?? null,
        table_name: withTable.table_name,
        covers: withTable.covers,
        check_number: withTable.check_number,
        display_code: order.display_code,
        status: orderStatus,
        created_at: order.created_at,
        items: verifiedItems,
        total: verifiedTotal,
        is_takeaway: !!is_takeaway
      };

      if (broadcast) {
        stockUpdates.forEach(product => broadcast(req.user.tenantId, { type: 'product_stock_updated', product }));
        if (sessionOpen) broadcast(req.user.tenantId, { type: 'order_created', order: orderData });
        if (check_id !== undefined) broadcast(req.user.tenantId, { type: 'check_updated', check: await getCheckSummary(req.db, check_id) });
      }

      res.json({ success: true, orderId: order.id, displayCode: order.display_code, ...(check_id !== undefined && { checkId: check_id }) });
    } catch (err) {
      // Due invii contemporanei dello stesso ordine: il secondo trova un vincolo di unicità
      // (sulla chiave di idempotenza o sul numero del dispositivo, a seconda di quale scatta prima).
      if (UNIQUE_ORDER_CONSTRAINTS.includes(err.constraint) && client_order_id) {
        const existing = await findOrderByClientId(req.db, client_order_id);
        if (existing) return res.json(duplicateResponse(existing));
      }
      if (['uniq_orders_device_seq', 'uniq_orders_session_source_number'].includes(err.constraint)) {
        return res.status(409).json({ error: 'Numero ordine già usato da questo dispositivo', code: 'DEVICE_SEQ_CONFLICT' });
      }
      if (sendHttpError(res, err)) return;
      logger.error({ err }, 'Errore POST /api/orders');
      res.status(500).json({ error: "Errore durante l'invio dell'ordine" });
    }
  });

  // PUT /orders/:id — cambio stato; lo storno ripristina lo stock nella stessa transazione
  router.put('/:id', authenticate, validate({ params: idParamsSchema, body: updateOrderStatusSchema }), tenantScope, async (req, res) => {
    const { id } = req.params;
    const { status, ingredients: ingredientsChoice } = req.body;

    // La cucina fa avanzare lo stato (in preparazione, completato), ma non storna.
    // Stornano i ruoli di cassa; il cameriere solo le comande dei suoi tavoli (controllo più sotto, sull'ordine)
    if (status === 'canceled' && !WAITER_ROLES.includes(req.user.role))
      return res.status(403).json({ error: 'Non hai i permessi per stornare ordini' });

    try {
      const { previousStatus, updated, stockUpdates } = await inTransaction(req.db, async (db) => {
        // Per stornare una comanda di un conto si blocca prima il conto, poi la comanda: lo stesso ordine di pagamenti
        // e annullo del conto, così non si incastrano a vicenda.
        if (status === 'canceled') {
          const { rows: pre } = await db.query('SELECT check_id FROM orders WHERE id = $1', [id]);
          if (pre[0]?.check_id) await lockCheck(db, pre[0].check_id, { mustBeOpen: false });
        }
        const { rows: current } = await db.query(
          `SELECT o.status, o.completed_at, o.created_at, o.check_id, o.order_type, c.status AS check_status
           FROM orders o LEFT JOIN checks c ON c.id = o.check_id WHERE o.id = $1 FOR UPDATE OF o`,
          [id]
        );
        if (!current.length) throw new HttpError(404, 'Ordine non trovato');
        const order = current[0];
        if (status === 'canceled' && !CASH_ROLES.includes(req.user.role) && !order.check_id)
          throw new HttpError(403, 'Il cameriere storna solo le comande dei tavoli', 'WAITER_CANNOT_CANCEL');
        // Una portata da mandare non entra in cucina: si manda dal conto (POST /checks/:id/fire) o si storna.
        if (order.status === 'scheduled' && status !== 'canceled')
          throw new HttpError(409, 'La portata non è ancora stata mandata', 'ORDER_SCHEDULED');
        if (status === 'canceled' && order.order_type === 'cover')
          throw new HttpError(409, 'Il coperto si cambia dai coperti del tavolo', 'COVER_ORDER');

        const isSimpleModeQuickCancel = status === 'canceled'
          && order.status === 'completed'
          && !order.completed_at
          && (Date.now() - new Date(order.created_at).getTime()) <= CANCEL_WINDOW_MS;
        if (TERMINAL_STATUSES.includes(order.status) && !isSimpleModeQuickCancel) {
          throw new HttpError(409, `Impossibile modificare un ordine in stato "${order.status}"`);
        }

        // Una comanda di un conto già pagato o annullato fa parte dell'incasso: non si storna.
        if (status === 'canceled' && order.check_id) {
          if (order.check_status !== 'open') throw new HttpError(409, 'Il conto è chiuso: la comanda non si può stornare', 'CHECK_CLOSED');
          // Se il conto ha già incassato qualcosa, la comanda non può sparire da sotto i pagamenti.
          await assertOrderCancelable(db, order.check_id, id);
        }

        const { rows } = await db.query(
          `UPDATE orders SET status = $1,
             completed_at = CASE WHEN $1 = 'completed' THEN now() ELSE completed_at END
           WHERE id = $2 RETURNING *`,
          [status, id]
        );
        // Le righe seguono la comanda: completata = tutte pronte, in preparazione = quelle in attesa partono
        if (status === 'completed')
          await db.query(`UPDATE order_items SET prep_status = 'ready', ready_at = COALESCE(ready_at, now()) WHERE order_id = $1 AND prep_status IN ('new', 'preparing')`, [id]);
        else if (status === 'preparing')
          await db.query(`UPDATE order_items SET prep_status = 'preparing' WHERE order_id = $1 AND prep_status = 'new'`, [id]);
        // un ordine da asporto concluso in cucina: il cliente va avvisato che è pronto
        if (status === 'completed' && order.status !== 'completed') await afterOrderCompleted(db, id);
        const [withInfo] = await withCheckInfo(db, [rows[0]]);
        const updated = { ...withInfo, items: (await loadItems(db, [id])).get(id) ?? [] };
        const stockUpdates = status === 'canceled'
          ? await applyStockChange(db, sumQuantitiesByProduct(updated.items.filter(i => i.id !== null)), +1)
          : [];
        // Col magazzino a ricette: gli ingredienti tornano in dispensa o, se la cucina aveva già iniziato, diventano scarto.
        if (status === 'canceled')
          await returnIngredientsOfOrder(db, { tenantId: req.user.tenantId, orderId: Number(id), userId: req.user.id, disposition: ingredientsChoice ?? defaultDisposition(order, updated.items) });
        return { previousStatus: order.status, updated, stockUpdates };
      });

      await logAudit(req.db, req.user.id, 'UPDATE_ORDER_STATUS', {
        orderId: id,
        oldStatus: previousStatus,
        newStatus: status
      });

      if (broadcast) {
        stockUpdates.forEach(product => broadcast(req.user.tenantId, { type: 'product_stock_updated', product }));
        broadcast(req.user.tenantId, { type: 'order_updated', order: updated });
        if (updated.check_id) broadcast(req.user.tenantId, { type: 'check_updated', check: await getCheckSummary(req.db, updated.check_id) });
      }
      res.json(updated);
    } catch (err) {
      if (sendHttpError(res, err)) return;
      logger.error({ err }, 'Errore PUT /api/orders/:id');
      res.status(500).json({ error: 'Errore aggiornamento ordine' });
    }
  });

  // PUT /orders/:id/lines — stato delle righe (in preparazione, pronta, servita): tutte, di una postazione o alcune.
  // Cucina e bar le fanno avanzare; solo il personale di sala le serve (e tocca quelle già servite).
  router.put('/:id/lines', authenticate, validate({ params: idParamsSchema, body: lineStatusSchema }), tenantScope, async (req, res) => {
    const { status, station, line_ids: lineIds } = req.body;
    const canServe = WAITER_ROLES.includes(req.user.role);
    if (status === 'served' && !canServe) return res.status(403).json({ error: 'Solo il personale di sala segna i piatti serviti' });
    try {
      const { changed, updated } = await inTransaction(req.db, async (db) => {
        const { changed } = await setLineStatus(db, req.params.id, { status, station, lineIds, canServe });
        const { rows } = await db.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
        const [withInfo] = await withCheckInfo(db, rows);
        return { changed, updated: { ...withInfo, total: Number(withInfo.total), items: (await loadItems(db, [req.params.id])).get(Number(req.params.id)) ?? [] } };
      });
      if (changed.length) {
        await logAudit(req.db, req.user.id, 'UPDATE_LINE_STATUS', { orderId: Number(req.params.id), status, lines: changed.length });
        if (broadcast) {
          broadcast(req.user.tenantId, { type: 'order_updated', order: updated });
          if (updated.check_id) broadcast(req.user.tenantId, { type: 'check_updated', check: await getCheckSummary(req.db, updated.check_id) });
        }
      }
      res.json(updated);
    } catch (err) {
      if (sendHttpError(res, err)) return;
      logger.error({ err }, 'Errore PUT /api/orders/:id/lines');
      res.status(500).json({ error: 'Errore aggiornamento righe' });
    }
  });

  // POST /orders/reprints — ristampe fatte offline: la cassa le comunica al ritorno della rete.
  // Il 404 (ordine non ancora sincronizzato) è temporaneo: la cassa riprova dopo.
  router.post('/reprints', authenticate, authorizeCash, validate({ body: reprintAuditSchema }), tenantScope, async (req, res) => {
    const { client_order_id, reprinted_at } = req.body;
    try {
      const order = await findOrderByClientId(req.db, client_order_id);
      if (!order) return res.status(404).json({ error: 'Ordine non ancora sincronizzato', code: 'ORDER_NOT_SYNCED' });
      for (const at of reprinted_at) {
        await logAudit(req.db, req.user.id, 'REPRINT_ORDER', { orderId: order.id, offline: true, reprintedAt: at });
      }
      res.json({ success: true });
    } catch (err) {
      logger.error({ err }, 'Errore registrazione ristampe offline');
      res.status(500).json({ error: 'Errore registrazione ristampe' });
    }
  });

  // POST /orders/:id/reprint — la stampa è del client: qui si registra l'azione (audit)
  // e si restituisce l'ordine com'è stato salvato, da cui la cassa ricostruisce le copie.
  router.post('/:id/reprint', authenticate, authorizeCash, validate({ params: idParamsSchema }), tenantScope, async (req, res) => {
    try {
      const { rows } = await req.db.query(
        'SELECT id, display_code, created_at, total, is_takeaway, check_id FROM orders WHERE id = $1', [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'Ordine non trovato' });
      const [order] = await withCheckInfo(req.db, await withItems(req.db, rows));

      await logAudit(req.db, req.user.id, 'REPRINT_ORDER', { orderId: order.id });
      res.json({ ...order, total: parseFloat(order.total) });
    } catch (err) {
      logger.error({ err }, 'Errore ristampa');
      res.status(500).json({ error: 'Errore durante la ristampa' });
    }
  });

  // GET /orders/kds — tenant risolto dal sottodominio
  router.get('/kds', resolveTenantFromHost, requireModule('kds'), async (req, res) => {
    try {
      const data = await withTenantClient(req.tenantId, async (db) => {
        const { rows } = await db.query(
          `SELECT o.id, o.display_code, o.status, o.is_takeaway, o.created_at, o.check_id
           FROM orders o JOIN sessions s ON s.id = o.session_id AND s.end_time IS NULL
           WHERE o.status IN ('pending', 'preparing') ORDER BY o.created_at DESC`
        );
        return (await withCheckInfo(db, await withItems(db, rows))).map(toPublicOrder);
      });
      res.json(data);
    } catch (err) {
      logger.error({ err }, 'Errore GET /api/orders/kds');
      res.status(500).json({ error: 'Errore recupero ordini KDS' });
    }
  });

  return router;
}