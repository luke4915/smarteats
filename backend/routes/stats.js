import express from 'express';
import { authenticate, authorizeRoles } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { tenantScope } from '../middleware/tenantScope.js';
import logger from '../logger.js';
import { statsQuerySchema, compareQuerySchema, matrixQuerySchema } from '../schemas/statsSchema.js';
import { requireModule } from '../utils/tenantModules.js';
import { COMPLETED_ITEMS, LINE_REVENUE } from '../utils/statsSql.js';
import { isRevenue, isKitchenOrder } from '../utils/revenue.js';
import { buildStats } from '../utils/stats.js';
import { buildRestaurantStats } from '../utils/restaurantStats.js';
import { buildOccupancy, buildBookingStats } from '../utils/occupancy.js';
import { requireUnlocked } from '../utils/reservedData.js';
import { loadComparison } from '../utils/sessionComparisonDb.js';
import { loadMenuMatrix } from '../utils/menuMatrixDb.js';

const router = express.Router();

const authorizeStats = authorizeRoles(['admin', 'manager'], 'Le statistiche sono riservate ad admin e responsabili');

// GET /api/stats?sessions=1,2&tz=Europe/Rome — statistiche aggregate dal database (nessun ordine viaggia verso il browser).
// Senza `sessions` valgono tutte le serate. Le ore sono nel fuso `tz` del dispositivo.
router.get('/', authenticate, requireModule('stats'), authorizeStats, validate({ query: statsQuerySchema }), tenantScope, requireUnlocked, async (req, res) => {
  const { sessions, tz } = req.validQuery;
  const sessionFilter = sessions?.length ? sessions : null;
  const inSessions = 'AND ($1::int[] IS NULL OR o.session_id = ANY($1))';
  try {
    const [totals, canceled, byHour, products] = await Promise.all([
      req.db.query(
        `SELECT COUNT(*) FILTER (WHERE ${isKitchenOrder('o')})::int AS n, COALESCE(SUM(o.total), 0) AS total,
                COUNT(*) FILTER (WHERE o.is_takeaway)::int AS takeaway,
                AVG(EXTRACT(EPOCH FROM (o.completed_at - o.created_at)) / 60)
                  FILTER (WHERE ${isKitchenOrder('o')} AND o.completed_at >= o.created_at AND o.completed_at - o.created_at < interval '180 minutes') AS avg_minutes
         FROM orders o WHERE ${isRevenue('o')} ${inSessions}`, [sessionFilter]),
      req.db.query(
        `SELECT COUNT(*)::int AS n, COALESCE(SUM(o.total), 0) AS total
         FROM orders o WHERE o.status = 'canceled' AND ${isKitchenOrder('o')} ${inSessions}`, [sessionFilter]),
      req.db.query(
        `SELECT EXTRACT(hour FROM o.created_at AT TIME ZONE $2)::int AS hour, COUNT(*) FILTER (WHERE ${isKitchenOrder('o')})::int AS n, SUM(o.total) AS total,
                AVG(EXTRACT(EPOCH FROM (o.completed_at - o.created_at)) / 60)
                  FILTER (WHERE ${isKitchenOrder('o')} AND o.completed_at >= o.created_at AND o.completed_at - o.created_at < interval '180 minutes') AS avg_minutes,
                COUNT(*) FILTER (WHERE ${isKitchenOrder('o')} AND o.completed_at >= o.created_at AND o.completed_at - o.created_at < interval '180 minutes')::int AS n_minutes
         FROM orders o WHERE ${isRevenue('o')} ${inSessions}
         GROUP BY 1`, [sessionFilter, tz]),
      // Per id di prodotto, non per nome: un prodotto rinominato resta uno solo.
      // Il mancato incasso degli omaggi usa il prezzo di listino salvato nell'ordine (original_price).
      req.db.query(
        `SELECT i.product_id,
                COALESCE(p.name, MAX(i.name)) AS name,
                COALESCE(MAX(i.category), MAX(p.category), 'Altro') AS category,
                SUM(i.quantity) AS quantity,
                SUM(${LINE_REVENUE}) AS revenue,
                SUM(CASE WHEN ${LINE_REVENUE} = 0
                         THEN COALESCE(i.original_price, p.price, 0) * i.quantity ELSE 0 END) AS missed
         ${COMPLETED_ITEMS} ${inSessions}
         GROUP BY i.product_id, p.name`, [sessionFilter]),
    ]);
    res.json(buildStats({ totals: totals.rows[0], canceled: canceled.rows[0], byHour: byHour.rows, products: products.rows }));
  } catch (err) {
    logger.error({ err }, 'Errore GET /api/stats');
    res.status(500).json({ error: 'Errore nel calcolo delle statistiche' });
  }
});

// GET /api/stats/restaurant?sessions=1,2&tz=Europe/Rome — statistiche del ristorante: coperti, scontrino medio per coperto,
// durata e rotazione dei conti, andamento per ora, portate, piatti, tempi di cucina, sconti, incassi per metodo.
// Tutto aggregato dal database. Gli importi vengono dalle comande dei conti pagati (`isRevenue`), come le altre statistiche.
router.get('/restaurant', authenticate, requireModule('stats'), requireModule('tables'), authorizeStats, validate({ query: statsQuerySchema }), tenantScope, requireUnlocked, async (req, res) => {
  const { sessions, tz } = req.validQuery;
  const sf = sessions?.length ? sessions : null;
  const inSessions = 'AND ($1::int[] IS NULL OR o.session_id = ANY($1))';
  const checkSessions = 'AND ($1::int[] IS NULL OR c.session_id = ANY($1))';
  const revenueOrders = `${isRevenue('o')} AND ${isKitchenOrder('o')}`;
  try {
    const [checks, revenue, byHour, courses, products, kitchen, discounts, payments, seated, seatTotal, reservations] = await Promise.all([
      req.db.query(
        `SELECT COUNT(*)::int AS n, COALESCE(SUM(c.covers), 0)::int AS covers, COUNT(DISTINCT c.table_id)::int AS tables,
                AVG(EXTRACT(EPOCH FROM (c.closed_at - c.opened_at)) / 60) FILTER (WHERE c.closed_at - c.opened_at < interval '6 hours') AS avg_minutes
         FROM checks c WHERE c.status = 'paid' ${checkSessions}`, [sf]),
      req.db.query(`SELECT COALESCE(SUM(o.total), 0) AS total FROM orders o WHERE ${isRevenue('o')} ${inSessions}`, [sf]),
      req.db.query(
        `SELECT EXTRACT(hour FROM c.opened_at AT TIME ZONE $2)::int AS hour, COUNT(*)::int AS n, SUM(c.covers)::int AS covers,
                SUM((SELECT COALESCE(SUM(o.total), 0) FROM orders o WHERE o.check_id = c.id AND o.status <> 'canceled')) AS revenue
         FROM checks c WHERE c.status = 'paid' ${checkSessions} GROUP BY 1`, [sf, tz]),
      req.db.query(
        `SELECT COALESCE(o.course_name, 'Senza portata') AS course, SUM(i.quantity) AS quantity, SUM(${LINE_REVENUE}) AS revenue
         ${COMPLETED_ITEMS} AND ${isKitchenOrder('o')} ${inSessions} GROUP BY 1`, [sf]),
      req.db.query(
        `SELECT i.product_id, COALESCE(p.name, MAX(i.name)) AS name, SUM(i.quantity) AS quantity, SUM(${LINE_REVENUE}) AS revenue
         ${COMPLETED_ITEMS} AND ${isKitchenOrder('o')} ${inSessions} GROUP BY i.product_id, p.name`, [sf]),
      // Da quando la comanda esce a quando la riga è pronta, per postazione; solo righe che hanno fatto il giro vero
      req.db.query(
        `SELECT CASE WHEN i.print_destination = 'bar' THEN 'bar' ELSE 'kitchen' END AS station,
                AVG(EXTRACT(EPOCH FROM (i.ready_at - o.fired_at)) / 60) AS avg_minutes, COUNT(*)::int AS n
         FROM order_items i JOIN orders o ON o.id = i.order_id
         WHERE o.check_id IS NOT NULL AND o.status <> 'canceled' AND ${isKitchenOrder('o')}
           AND o.fired_at IS NOT NULL AND i.ready_at IS NOT NULL AND i.ready_at >= o.fired_at AND i.ready_at - o.fired_at < interval '120 minutes' ${inSessions}
         GROUP BY 1`, [sf]),
      req.db.query(
        `SELECT COALESCE(SUM(CASE WHEN i.line_type = 'discount' THEN COALESCE(i.original_price, 0) * i.quantity - i.line_total ELSE 0 END), 0) AS discount,
                COALESCE(SUM(CASE WHEN i.line_type = 'gift' THEN COALESCE(i.original_price, 0) * i.quantity ELSE 0 END), 0) AS gift,
                COUNT(*)::int AS lines
         FROM orders o JOIN order_items i ON i.order_id = o.id
         WHERE ${revenueOrders} AND i.line_type <> 'sale' ${inSessions}`, [sf]),
      req.db.query(
        `SELECT p.method, SUM(p.amount) AS amount FROM payments p JOIN checks c ON c.id = p.check_id
         WHERE c.status = 'paid' ${checkSessions} GROUP BY p.method`, [sf]),
      // Riempimento: ogni conto pagato con quando si è seduto, quanto è rimasto e i posti del suo tavolo
      req.db.query(
        `SELECT c.session_id, EXTRACT(EPOCH FROM c.opened_at)::float8 AS opened_at, EXTRACT(EPOCH FROM c.closed_at)::float8 AS closed_at,
                (EXTRACT(hour FROM c.opened_at AT TIME ZONE $2) * 60 + EXTRACT(minute FROM c.opened_at AT TIME ZONE $2))::int AS start,
                c.covers, t.seats, t.seats_min
         FROM checks c LEFT JOIN dining_tables t ON t.id = c.table_id
         WHERE c.status = 'paid' AND c.closed_at IS NOT NULL ${checkSessions}`, [sf, tz]),
      req.db.query(`SELECT COALESCE(SUM(seats), 0)::int AS seats FROM dining_tables WHERE active`),
      // Prenotazioni dei giorni dei servizi scelti (o tutte): anticipo = giorni tra la richiesta e la data
      req.db.query(
        `SELECT r.status, r.source, r.party_size, (r.date - (r.requested_at AT TIME ZONE $2)::date)::int AS lead_days
         FROM reservations r
         WHERE $1::int[] IS NULL OR r.date IN (SELECT (s.start_time AT TIME ZONE $2)::date FROM sessions s WHERE s.id = ANY($1))`, [sf, tz]),
    ]);
    res.json(buildRestaurantStats({
      checks: checks.rows[0], revenue: revenue.rows[0].total, byHour: byHour.rows, courses: courses.rows, products: products.rows,
      kitchen: kitchen.rows, discounts: discounts.rows[0], payments: payments.rows,
      occupancy: buildOccupancy({ checks: seated.rows, seats: seatTotal.rows[0].seats, revenue: revenue.rows[0].total }),
      bookings: buildBookingStats(reservations.rows),
    }));
  } catch (err) {
    logger.error({ err }, 'Errore GET /api/stats/restaurant');
    res.status(500).json({ error: 'Errore nel calcolo delle statistiche' });
  }
});

// GET /api/stats/compare?a=1&b=2&tz=Europe/Rome — il confronto tra due serate: numeri di ciascuna, ogni prodotto affiancato e le ore.
router.get('/compare', authenticate, requireModule('stats'), authorizeStats, validate({ query: compareQuerySchema }), tenantScope, requireUnlocked, async (req, res) => {
  const { a, b, tz } = req.validQuery;
  try {
    const result = await loadComparison(req.db, a, b, tz);
    if (!result) return res.status(404).json({ error: 'Una delle due serate non esiste' });
    res.json(result);
  } catch (err) {
    logger.error({ err }, 'Errore GET /api/stats/compare');
    res.status(500).json({ error: 'Errore nel confronto' });
  }
});

// GET /api/stats/menu-matrix?sessions=1,2 — la matrice del menu: ogni prodotto per popolarità e rendimento (margine, o prezzo senza ricette).
router.get('/menu-matrix', authenticate, requireModule('stats'), authorizeStats, validate({ query: matrixQuerySchema }), tenantScope, requireUnlocked, async (req, res) => {
  try {
    res.json(await loadMenuMatrix(req.db, req.validQuery.sessions?.length ? req.validQuery.sessions : null));
  } catch (err) {
    logger.error({ err }, 'Errore GET /api/stats/menu-matrix');
    res.status(500).json({ error: 'Errore nel calcolo della matrice del menu' });
  }
});

export default router;
