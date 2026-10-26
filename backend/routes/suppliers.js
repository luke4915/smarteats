import express from 'express';
import { authenticate, authorizeManager } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { tenantScope } from '../middleware/tenantScope.js';
import { inTransaction } from '../db.js';
import logger from '../logger.js';
import { logAudit } from '../utils/auditLogger.js';
import { requireModule } from '../utils/tenantModules.js';
import { requireWarehouseMode } from '../utils/inventory/guards.js';
import { HttpError, sendHttpError } from '../utils/httpError.js';
import { idParamsSchema } from '../schemas/common.js';
import { supplierSchema, supplierPriceListSchema } from '../schemas/supplierSchema.js';
import { maskReserved } from '../utils/reservedData.js';

// Fornitori del locale (modulo `inventory`, modalità magazzino) e il listino di ciò che vendono (confezione e prezzo, senza IVA).
// Li gestiscono amministratore e responsabile: sono prezzi.
const router = express.Router();
const guard = [authenticate, requireModule('inventory'), requireWarehouseMode, authorizeManager];
const COLUMNS = 'id, name, phone, email, vat_number, notes, active';
const UNIQUE = 'Esiste già un fornitore con questo nome';

async function listSuppliers(db) {
  const [{ rows: suppliers }, { rows: prices }] = await Promise.all([
    db.query(`SELECT ${COLUMNS} FROM suppliers ORDER BY lower(name)`),
    db.query('SELECT supplier_id, ingredient_id, purchase_unit_name, base_units_per_purchase_unit, unit_cost_cents, vat_rate FROM supplier_ingredients ORDER BY id'),
  ]);
  return suppliers.map(s => ({
    ...s,
    items: prices.filter(p => p.supplier_id === s.id).map(p => ({
      ingredient_id: p.ingredient_id, purchase_unit_name: p.purchase_unit_name, base_units_per_purchase_unit: Number(p.base_units_per_purchase_unit),
      unit_cost_cents: p.unit_cost_cents, vat_rate: p.vat_rate === null ? null : Number(p.vat_rate),
    })),
  }));
}

router.get('/', ...guard, tenantScope, maskReserved, async (req, res) => {
  try { res.json(await listSuppliers(req.db)); }
  catch (err) {
    logger.error({ err }, 'Errore GET /api/suppliers');
    res.status(500).json({ error: 'Errore caricamento fornitori' });
  }
});

router.post('/', ...guard, validate({ body: supplierSchema }), tenantScope, maskReserved, async (req, res) => {
  const { name, phone, email, vat_number: vatNumber, notes, active } = req.body;
  try {
    const { rows } = await req.db.query(
      `INSERT INTO suppliers (name, phone, email, vat_number, notes, active) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`, [name, phone, email, vatNumber, notes, active]);
    await logAudit(req.db, req.user.id, 'CREATE_SUPPLIER', { supplierId: rows[0].id, name });
    res.status(201).json((await listSuppliers(req.db)).find(s => s.id === rows[0].id));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: UNIQUE, code: 'SUPPLIER_EXISTS' });
    logger.error({ err }, 'Errore POST /api/suppliers');
    res.status(500).json({ error: 'Errore creazione fornitore' });
  }
});

router.put('/:id', ...guard, validate({ params: idParamsSchema, body: supplierSchema }), tenantScope, maskReserved, async (req, res) => {
  const { name, phone, email, vat_number: vatNumber, notes, active } = req.body;
  try {
    const { rowCount } = await req.db.query(
      'UPDATE suppliers SET name = $1, phone = $2, email = $3, vat_number = $4, notes = $5, active = $6 WHERE id = $7', [name, phone, email, vatNumber, notes, active, req.params.id]);
    if (!rowCount) throw new HttpError(404, 'Fornitore non trovato');
    await logAudit(req.db, req.user.id, 'UPDATE_SUPPLIER', { supplierId: Number(req.params.id), name });
    res.json((await listSuppliers(req.db)).find(s => s.id === Number(req.params.id)));
  } catch (err) {
    if (sendHttpError(res, err)) return;
    if (err.code === '23505') return res.status(409).json({ error: UNIQUE, code: 'SUPPLIER_EXISTS' });
    logger.error({ err }, 'Errore PUT /api/suppliers/:id');
    res.status(500).json({ error: 'Errore aggiornamento fornitore' });
  }
});

// Un fornitore con degli scarichi di merce non si elimina (lo storico dei costi resta): si disattiva.
router.delete('/:id', ...guard, validate({ params: idParamsSchema }), tenantScope, maskReserved, async (req, res) => {
  try {
    if ((await req.db.query('SELECT 1 FROM goods_receipts WHERE supplier_id = $1 LIMIT 1', [req.params.id])).rowCount)
      throw new HttpError(409, 'Questo fornitore ha degli scarichi di merce: disattivalo invece di eliminarlo', 'SUPPLIER_IN_USE');
    const { rows } = await req.db.query('DELETE FROM suppliers WHERE id = $1 RETURNING name', [req.params.id]);
    if (!rows.length) throw new HttpError(404, 'Fornitore non trovato');
    await logAudit(req.db, req.user.id, 'DELETE_SUPPLIER', { supplierId: Number(req.params.id), name: rows[0].name });
    res.json({ success: true });
  } catch (err) {
    if (sendHttpError(res, err)) return;
    logger.error({ err }, 'Errore DELETE /api/suppliers/:id');
    res.status(500).json({ error: 'Errore eliminazione fornitore' });
  }
});

// Il listino del fornitore: ingredienti che vende, con confezione e prezzo. Sostituisce quello di prima.
router.put('/:id/price-list', ...guard, validate({ params: idParamsSchema, body: supplierPriceListSchema }), tenantScope, maskReserved, async (req, res) => {
  try {
    await inTransaction(req.db, async (db) => {
      if (!(await db.query('SELECT 1 FROM suppliers WHERE id = $1 FOR UPDATE', [req.params.id])).rowCount) throw new HttpError(404, 'Fornitore non trovato');
      const ids = req.body.items.map(i => i.ingredient_id);
      if (ids.length && (await db.query('SELECT id FROM ingredients WHERE id = ANY($1::int[])', [ids])).rowCount !== ids.length) throw new HttpError(400, 'Ingrediente non valido', 'INVALID_INGREDIENT');
      await db.query('DELETE FROM supplier_ingredients WHERE supplier_id = $1', [req.params.id]);
      for (const i of req.body.items)
        await db.query(
          `INSERT INTO supplier_ingredients (supplier_id, ingredient_id, purchase_unit_name, base_units_per_purchase_unit, unit_cost_cents, vat_rate) VALUES ($1, $2, $3, $4, $5, $6)`,
          [req.params.id, i.ingredient_id, i.purchase_unit_name, i.base_units_per_purchase_unit, i.unit_cost_cents, i.vat_rate]);
    });
    await logAudit(req.db, req.user.id, 'UPDATE_SUPPLIER_PRICE_LIST', { supplierId: Number(req.params.id), items: req.body.items.length });
    res.json((await listSuppliers(req.db)).find(s => s.id === Number(req.params.id)));
  } catch (err) {
    if (sendHttpError(res, err)) return;
    logger.error({ err }, 'Errore PUT /api/suppliers/:id/price-list');
    res.status(500).json({ error: 'Errore salvataggio listino' });
  }
});

export default router;
