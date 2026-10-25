import express from 'express';
import { authenticate, authorizeManager } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { tenantScope } from '../middleware/tenantScope.js';
import { inTransaction } from '../db.js';
import logger from '../logger.js';
import { logAudit } from '../utils/auditLogger.js';
import { requireModule } from '../utils/tenantModules.js';
import { requireWarehouseMode } from '../utils/inventory/guards.js';
import { saveRecipeLines } from '../utils/inventory/recipeLinesDb.js';
import { HttpError, sendHttpError } from '../utils/httpError.js';
import { idParamsSchema } from '../schemas/common.js';
import { preparationSchema } from '../schemas/inventorySchema.js';

// Preparazioni del locale (il sugo base): una ricetta con una quantità prodotta, usata dai piatti come fosse un ingrediente.
const router = express.Router();
const guard = [authenticate, requireModule('inventory'), requireWarehouseMode, authorizeManager];
const UNIQUE = 'Esiste già una preparazione con questo nome';

async function listPreparations(db) {
  const [{ rows: preparations }, { rows: lines }] = await Promise.all([
    db.query('SELECT id, name, base_unit, output_quantity, active FROM preparations ORDER BY lower(name)'),
    db.query('SELECT preparation_id, ingredient_id, component_preparation_id, quantity FROM recipe_lines WHERE preparation_id IS NOT NULL ORDER BY id'),
  ]);
  return preparations.map(p => ({
    ...p, output_quantity: Number(p.output_quantity),
    lines: lines.filter(l => l.preparation_id === p.id).map(l => ({ ingredient_id: l.ingredient_id, component_preparation_id: l.component_preparation_id, quantity: Number(l.quantity) })),
  }));
}

router.get('/', ...guard, tenantScope, async (req, res) => {
  try { res.json(await listPreparations(req.db)); }
  catch (err) {
    logger.error({ err }, 'Errore GET /api/preparations');
    res.status(500).json({ error: 'Errore caricamento preparazioni' });
  }
});

router.post('/', ...guard, validate({ body: preparationSchema }), tenantScope, async (req, res) => {
  const { name, base_unit: baseUnit, output_quantity: output, active, lines } = req.body;
  try {
    const id = await inTransaction(req.db, async (db) => {
      const { rows: [p] } = await db.query('INSERT INTO preparations (name, base_unit, output_quantity, active) VALUES ($1, $2, $3, $4) RETURNING id', [name, baseUnit, output, active]);
      await saveRecipeLines(db, { preparationId: p.id }, lines);
      return p.id;
    });
    await logAudit(req.db, req.user.id, 'CREATE_PREPARATION', { preparationId: id, name });
    res.status(201).json((await listPreparations(req.db)).find(p => p.id === id));
  } catch (err) {
    if (sendHttpError(res, err)) return;
    if (err.code === '23505') return res.status(409).json({ error: UNIQUE, code: 'PREPARATION_EXISTS' });
    logger.error({ err }, 'Errore POST /api/preparations');
    res.status(500).json({ error: 'Errore creazione preparazione' });
  }
});

router.put('/:id', ...guard, validate({ params: idParamsSchema, body: preparationSchema }), tenantScope, async (req, res) => {
  const { name, base_unit: baseUnit, output_quantity: output, active, lines } = req.body;
  try {
    await inTransaction(req.db, async (db) => {
      const { rowCount } = await db.query('UPDATE preparations SET name = $1, base_unit = $2, output_quantity = $3, active = $4 WHERE id = $5', [name, baseUnit, output, active, req.params.id]);
      if (!rowCount) throw new HttpError(404, 'Preparazione non trovata');
      await saveRecipeLines(db, { preparationId: Number(req.params.id) }, lines);
    });
    await logAudit(req.db, req.user.id, 'UPDATE_PREPARATION', { preparationId: Number(req.params.id), name });
    res.json((await listPreparations(req.db)).find(p => p.id === Number(req.params.id)));
  } catch (err) {
    if (sendHttpError(res, err)) return;
    if (err.code === '23505') return res.status(409).json({ error: UNIQUE, code: 'PREPARATION_EXISTS' });
    logger.error({ err }, 'Errore PUT /api/preparations/:id');
    res.status(500).json({ error: 'Errore aggiornamento preparazione' });
  }
});

// Una preparazione usata da un piatto o da un'altra preparazione non si elimina: prima si toglie da lì.
router.delete('/:id', ...guard, validate({ params: idParamsSchema }), tenantScope, async (req, res) => {
  try {
    const used = await req.db.query('SELECT 1 FROM recipe_lines WHERE component_preparation_id = $1 LIMIT 1', [req.params.id]);
    if (used.rowCount) throw new HttpError(409, 'Questa preparazione è usata in una ricetta: toglila da lì prima', 'PREPARATION_IN_USE');
    const { rows } = await req.db.query('DELETE FROM preparations WHERE id = $1 RETURNING name', [req.params.id]);
    if (!rows.length) throw new HttpError(404, 'Preparazione non trovata');
    await logAudit(req.db, req.user.id, 'DELETE_PREPARATION', { preparationId: Number(req.params.id), name: rows[0].name });
    res.json({ success: true });
  } catch (err) {
    if (sendHttpError(res, err)) return;
    logger.error({ err }, 'Errore DELETE /api/preparations/:id');
    res.status(500).json({ error: 'Errore eliminazione preparazione' });
  }
});

export default router;
