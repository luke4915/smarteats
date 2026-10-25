import express from 'express';
import { authenticate, authorizeManager, authorizeRoles } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { tenantScope } from '../middleware/tenantScope.js';
import logger from '../logger.js';
import { logAudit } from '../utils/auditLogger.js';
import { requireModule } from '../utils/tenantModules.js';
import { requireWarehouseMode } from '../utils/inventory/guards.js';
import { HttpError, sendHttpError } from '../utils/httpError.js';
import { idParamsSchema } from '../schemas/common.js';
import { ingredientSchema, availabilitySchema } from '../schemas/inventorySchema.js';

// Ingredienti del locale (modulo `inventory`, modalità magazzino): l'elenco con ciò che c'è in dispensa. Li gestiscono
// amministratore e responsabile; la cucina li vede (e può segnarli esauriti) ma non ne conosce il costo.
const router = express.Router();
const guard = [authenticate, requireModule('inventory'), requireWarehouseMode];
const seesKitchen = authorizeRoles(['admin', 'manager', 'kitchen'], 'Non hai i permessi per vedere il magazzino');
const COLUMNS = 'id, name, base_unit, yield_percent, reorder_level, quantity_on_hand, weighted_average_cost, marked_out, active';
const UNIQUE = 'Esiste già un ingrediente con questo nome';

// I numeri di PostgreSQL arrivano come testo: qui diventano numeri. Il costo lo vedono solo i ruoli di gestione.
const present = (row, role) => ({
  ...row,
  yield_percent: Number(row.yield_percent),
  reorder_level: row.reorder_level === null ? null : Number(row.reorder_level),
  quantity_on_hand: Number(row.quantity_on_hand),
  weighted_average_cost: role === 'kitchen' ? undefined : Number(row.weighted_average_cost),
});

router.get('/', ...guard, seesKitchen, tenantScope, async (req, res) => {
  try {
    const { rows } = await req.db.query(`SELECT ${COLUMNS} FROM ingredients ORDER BY lower(name)`);
    res.json(rows.map(r => present(r, req.user.role)));
  } catch (err) {
    logger.error({ err }, 'Errore GET /api/ingredients');
    res.status(500).json({ error: 'Errore caricamento ingredienti' });
  }
});

router.post('/', ...guard, authorizeManager, validate({ body: ingredientSchema }), tenantScope, async (req, res) => {
  const { name, base_unit: baseUnit, yield_percent: yieldPercent, reorder_level: reorderLevel, active } = req.body;
  try {
    const { rows } = await req.db.query(
      `INSERT INTO ingredients (name, base_unit, yield_percent, reorder_level, active) VALUES ($1, $2, $3, $4, $5) RETURNING ${COLUMNS}`,
      [name, baseUnit, yieldPercent, reorderLevel, active]);
    await logAudit(req.db, req.user.id, 'CREATE_INGREDIENT', { ingredientId: rows[0].id, name });
    res.status(201).json(present(rows[0], req.user.role));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: UNIQUE, code: 'INGREDIENT_EXISTS' });
    logger.error({ err }, 'Errore POST /api/ingredients');
    res.status(500).json({ error: 'Errore creazione ingrediente' });
  }
});

router.put('/:id', ...guard, authorizeManager, validate({ params: idParamsSchema, body: ingredientSchema }), tenantScope, async (req, res) => {
  const { name, base_unit: baseUnit, yield_percent: yieldPercent, reorder_level: reorderLevel, active } = req.body;
  try {
    const { rows: [current] } = await req.db.query('SELECT base_unit FROM ingredients WHERE id = $1', [req.params.id]);
    if (!current) throw new HttpError(404, 'Ingrediente non trovato');
    // Cambiare unità con dei movimenti già scritti falserebbe lo storico (grammi che diventano litri)
    if (current.base_unit !== baseUnit && (await req.db.query('SELECT 1 FROM ingredient_movements WHERE ingredient_id = $1 LIMIT 1', [req.params.id])).rowCount)
      throw new HttpError(409, "L'unità non si cambia: l'ingrediente ha già dei movimenti", 'UNIT_LOCKED');
    const { rows } = await req.db.query(
      `UPDATE ingredients SET name = $1, base_unit = $2, yield_percent = $3, reorder_level = $4, active = $5 WHERE id = $6 RETURNING ${COLUMNS}`,
      [name, baseUnit, yieldPercent, reorderLevel, active, req.params.id]);
    await logAudit(req.db, req.user.id, 'UPDATE_INGREDIENT', { ingredientId: rows[0].id, name });
    res.json(present(rows[0], req.user.role));
  } catch (err) {
    if (sendHttpError(res, err)) return;
    if (err.code === '23505') return res.status(409).json({ error: UNIQUE, code: 'INGREDIENT_EXISTS' });
    logger.error({ err }, 'Errore PUT /api/ingredients/:id');
    res.status(500).json({ error: 'Errore aggiornamento ingrediente' });
  }
});

// Un ingrediente usato in una ricetta o con dei movimenti non si elimina (si perderebbe lo storico): si disattiva.
router.delete('/:id', ...guard, authorizeManager, validate({ params: idParamsSchema }), tenantScope, async (req, res) => {
  try {
    const used = await req.db.query(
      `SELECT 1 FROM recipe_lines WHERE ingredient_id = $1 UNION ALL SELECT 1 FROM modifier_recipe_lines WHERE ingredient_id = $1
       UNION ALL SELECT 1 FROM ingredient_movements WHERE ingredient_id = $1 LIMIT 1`, [req.params.id]);
    if (used.rowCount) throw new HttpError(409, 'Questo ingrediente è usato o ha uno storico: disattivalo invece di eliminarlo', 'INGREDIENT_IN_USE');
    const { rows } = await req.db.query('DELETE FROM ingredients WHERE id = $1 RETURNING name', [req.params.id]);
    if (!rows.length) throw new HttpError(404, 'Ingrediente non trovato');
    await logAudit(req.db, req.user.id, 'DELETE_INGREDIENT', { ingredientId: Number(req.params.id), name: rows[0].name });
    res.json({ success: true });
  } catch (err) {
    if (sendHttpError(res, err)) return;
    logger.error({ err }, 'Errore DELETE /api/ingredients/:id');
    res.status(500).json({ error: 'Errore eliminazione ingrediente' });
  }
});

// «Esaurito» e «di nuovo disponibile»: anche la cucina, con un tocco. Un ingrediente esaurito blocca i piatti che lo usano.
router.put('/:id/availability', ...guard, seesKitchen, validate({ params: idParamsSchema, body: availabilitySchema }), tenantScope, async (req, res) => {
  try {
    const { rows } = await req.db.query('UPDATE ingredients SET marked_out = $1 WHERE id = $2 RETURNING id, name, marked_out', [!req.body.available, req.params.id]);
    if (!rows.length) throw new HttpError(404, 'Ingrediente non trovato');
    await logAudit(req.db, req.user.id, req.body.available ? 'INGREDIENT_AVAILABLE' : 'INGREDIENT_SOLD_OUT', { ingredientId: rows[0].id, name: rows[0].name });
    res.json(rows[0]);
  } catch (err) {
    if (sendHttpError(res, err)) return;
    logger.error({ err }, 'Errore PUT /api/ingredients/:id/availability');
    res.status(500).json({ error: 'Errore aggiornamento disponibilità' });
  }
});

export default router;
