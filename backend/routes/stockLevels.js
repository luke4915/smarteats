import express from 'express';
import { authenticate, authorizeManager } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { tenantScope } from '../middleware/tenantScope.js';
import { inTransaction } from '../db.js';
import logger from '../logger.js';
import { logAudit } from '../utils/auditLogger.js';
import { requireModule } from '../utils/tenantModules.js';
import { requireWarehouseMode } from '../utils/inventory/guards.js';
import { createStockLevel } from '../utils/inventory/stockLevelsDb.js';
import { HttpError, sendHttpError } from '../utils/httpError.js';
import { idParamsSchema } from '../schemas/common.js';
import { stockLevelSchema } from '../schemas/inventorySchema.js';

// Controlli di magazzino (il conteggio fisico della dispensa): si registrano già confermati, in un colpo solo.
// Amministratore e responsabile. Un controllo scritto non si modifica: lo storico non si corregge.
const router = express.Router();
const guard = [authenticate, requireModule('inventory'), requireWarehouseMode, authorizeManager];

router.get('/', ...guard, tenantScope, async (req, res) => {
  try {
    const { rows } = await req.db.query(
      `SELECT l.id, l.kind, l.notes, l.created_at, u.username AS created_by,
              (SELECT count(*)::int FROM stock_level_lines x WHERE x.stock_level_id = l.id) AS lines,
              (SELECT count(*)::int FROM stock_level_lines x WHERE x.stock_level_id = l.id AND x.difference <> 0) AS differences
       FROM stock_levels l LEFT JOIN users u ON u.id = l.created_by ORDER BY l.created_at DESC, l.id DESC LIMIT 100`);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, 'Errore GET /api/stock-levels');
    res.status(500).json({ error: 'Errore caricamento controlli' });
  }
});

router.get('/:id', ...guard, validate({ params: idParamsSchema }), tenantScope, async (req, res) => {
  try {
    const { rows: [level] } = await req.db.query(
      'SELECT l.id, l.kind, l.notes, l.created_at, u.username AS created_by FROM stock_levels l LEFT JOIN users u ON u.id = l.created_by WHERE l.id = $1', [req.params.id]);
    if (!level) throw new HttpError(404, 'Controllo non trovato');
    const { rows: lines } = await req.db.query(
      `SELECT x.ingredient_id, i.name, i.base_unit, x.expected_quantity, x.counted_quantity, x.difference,
              ROUND(x.difference * COALESCE((SELECT m.unit_cost FROM ingredient_movements m WHERE m.stock_level_id = x.stock_level_id AND m.ingredient_id = x.ingredient_id LIMIT 1), i.weighted_average_cost))::int AS difference_value_cents
       FROM stock_level_lines x JOIN ingredients i ON i.id = x.ingredient_id WHERE x.stock_level_id = $1 ORDER BY lower(i.name)`, [req.params.id]);
    res.json({ ...level, lines: lines.map(l => ({ ...l, expected_quantity: Number(l.expected_quantity), counted_quantity: Number(l.counted_quantity), difference: Number(l.difference) })) });
  } catch (err) {
    if (sendHttpError(res, err)) return;
    logger.error({ err }, 'Errore GET /api/stock-levels/:id');
    res.status(500).json({ error: 'Errore caricamento controllo' });
  }
});

router.post('/', ...guard, validate({ body: stockLevelSchema }), tenantScope, async (req, res) => {
  try {
    const created = await inTransaction(req.db, (db) => createStockLevel(db, { userId: req.user.id, ...req.body }));
    await logAudit(req.db, req.user.id, 'CREATE_STOCK_LEVEL', { stockLevelId: created.id, lines: req.body.lines.length, differences: created.differences });
    res.status(201).json(created);
  } catch (err) {
    if (sendHttpError(res, err)) return;
    logger.error({ err }, 'Errore POST /api/stock-levels');
    res.status(500).json({ error: 'Errore registrazione controllo' });
  }
});

export default router;
