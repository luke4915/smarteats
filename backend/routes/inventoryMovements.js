import express from 'express';
import { authenticate, authorizeManager } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { tenantScope } from '../middleware/tenantScope.js';
import { inTransaction } from '../db.js';
import logger from '../logger.js';
import { logAudit } from '../utils/auditLogger.js';
import { requireModule, getTenantModules } from '../utils/tenantModules.js';
import { requireWarehouseMode } from '../utils/inventory/guards.js';
import { recordWaste, recordAdjustment, recordUsage } from '../utils/inventory/adjustmentsDb.js';
import { HttpError, sendHttpError } from '../utils/httpError.js';
import { movementSchema, movementsQuerySchema, usageSchema } from '../schemas/inventorySchema.js';

// Movimenti scritti a mano (scarti e rettifiche), lo scarico semplificato e il registro dei movimenti.
// Amministratore e responsabile: sono quantità e costi.
const router = express.Router();
const guard = [authenticate, requireModule('inventory'), requireWarehouseMode, authorizeManager];

// Il registro, dal più recente: cosa è entrato e uscito, quando, perché e a che costo.
router.get('/movements', ...guard, validate({ query: movementsQuerySchema }), tenantScope, async (req, res) => {
  const { ingredient_id: ingredientId, kind, limit } = req.validQuery;
  try {
    const { rows } = await req.db.query(
      `SELECT m.id, m.ingredient_id, i.name AS ingredient_name, i.base_unit, m.kind, m.quantity_change, m.unit_cost, m.reason,
              m.order_id, m.goods_receipt_id, m.stock_level_id, m.created_at, u.username AS created_by
       FROM ingredient_movements m JOIN ingredients i ON i.id = m.ingredient_id LEFT JOIN users u ON u.id = m.created_by
       WHERE ($1::int IS NULL OR m.ingredient_id = $1) AND ($2::text IS NULL OR m.kind = $2)
       ORDER BY m.created_at DESC, m.id DESC LIMIT $3`, [ingredientId ?? null, kind ?? null, limit]);
    res.json(rows.map(r => ({ ...r, quantity_change: Number(r.quantity_change), unit_cost: r.unit_cost === null ? null : Number(r.unit_cost) })));
  } catch (err) {
    logger.error({ err }, 'Errore GET /api/inventory/movements');
    res.status(500).json({ error: 'Errore caricamento movimenti' });
  }
});

// Uno scarto o una rettifica.
router.post('/movements', ...guard, validate({ body: movementSchema }), tenantScope, async (req, res) => {
  const body = req.body;
  try {
    await inTransaction(req.db, (db) => (body.type === 'waste'
      ? recordWaste(db, { ingredientId: body.ingredient_id, quantity: body.quantity, reason: body.reason, note: body.note, userId: req.user.id })
      : recordAdjustment(db, { ingredientId: body.ingredient_id, quantityChange: body.quantity_change, note: body.note, userId: req.user.id })));
    await logAudit(req.db, req.user.id, body.type === 'waste' ? 'INVENTORY_WASTE' : 'INVENTORY_ADJUSTMENT', { ingredientId: body.ingredient_id });
    res.status(201).json({ success: true });
  } catch (err) {
    if (sendHttpError(res, err)) return;
    logger.error({ err }, 'Errore POST /api/inventory/movements');
    res.status(500).json({ error: 'Errore registrazione movimento' });
  }
});

// Lo scarico semplificato (solo se il locale scala gli ingredienti «a mano»): per ogni ingrediente quanto è stato usato, o quanto resta.
router.post('/usage', ...guard, validate({ body: usageSchema }), tenantScope, async (req, res) => {
  try {
    if ((await getTenantModules(req.user.tenantId))?.inventory?.depletion !== 'simple')
      throw new HttpError(409, 'Questo locale scala gli ingredienti dalle ricette: lo scarico a mano non serve', 'NOT_SIMPLE_DEPLETION');
    const written = await inTransaction(req.db, (db) => recordUsage(db, { lines: req.body.lines, userId: req.user.id }));
    await logAudit(req.db, req.user.id, 'INVENTORY_USAGE', { lines: written });
    res.status(201).json({ written });
  } catch (err) {
    if (sendHttpError(res, err)) return;
    logger.error({ err }, 'Errore POST /api/inventory/usage');
    res.status(500).json({ error: 'Errore registrazione dello scarico' });
  }
});

export default router;
