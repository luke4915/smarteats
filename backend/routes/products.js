import express from 'express';
import { authenticate, authorizeAdmin, authorizeStock } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { tenantScope, withTenantClient } from '../middleware/tenantScope.js';
import { resolveTenantFromHost } from '../middleware/resolveTenantFromHost.js';
import logger from '../logger.js';
import { requireModule } from '../utils/tenantModules.js';
import { logAudit } from '../utils/auditLogger.js';
import { idParamsSchema } from '../schemas/common.js';
import { productSchema, bulkVisibilitySchema, stockSchema } from '../schemas/productSchema.js';
import { savePortionsRule } from '../utils/inventory/portionsDb.js';

// I prodotti. La route è una factory: ogni cambio parte come avviso a tutti i dispositivi del locale, così una cassa non resta con una
// tessera vecchia quando un'altra segna «esaurito», il responsabile nasconde un prodotto o cambia un prezzo (`product_stock_updated` per
// scorta e visibilità).
// Creare, modificare o eliminare un prodotto parte come avviso (`product_created`, `product_updated`, `product_deleted`), con `by` = chi l'ha
// fatto: chi lo riceve dal proprio dispositivo non mostra il messaggio «aggiornato!».
export default function productRoutes(broadcast) {
  const router = express.Router();
  const stockEvent = ({ id, stock, stock_enabled, visible }) => ({ type: 'product_stock_updated', product: { id, stock, stock_enabled, visible } });

  // GET /api/products/menu — pubblico, tenant risolto dal sottodominio
  router.get('/menu', resolveTenantFromHost, requireModule('qr_menu'), async (req, res) => {
    try {
      const data = await withTenantClient(req.tenantId, async (db) => {
        const [{ rows: products }, { rows: sessions }, { rows: [tenant] }] = await Promise.all([
          db.query('SELECT id, name, price, category, color FROM products WHERE visible = true ORDER BY category, name'),
          db.query('SELECT name FROM sessions WHERE end_time IS NULL ORDER BY start_time DESC LIMIT 1'),
          db.query('SELECT name FROM tenants WHERE id = $1', [req.tenantId]),
        ]);
        return { tenantName: tenant?.name ?? null, sessionName: sessions[0]?.name || null, products };
      });
      res.json(data);
    } catch (err) {
      logger.error({ err }, 'Errore GET /api/products/menu');
      res.status(500).json({ error: 'Errore caricamento menu' });
    }
  });

  // GET /api/products
  router.get('/', authenticate, tenantScope, async (req, res) => {
    try {
      const { rows } = await req.db.query('SELECT * FROM products ORDER BY category, name');
      res.json(rows);
    } catch (err) {
      logger.error({ err }, 'Errore caricamento prodotti');
      res.status(500).json({ error: 'Errore caricamento prodotti' });
    }
  });

  // PATCH /api/products/bulk-visibility
  router.patch('/bulk-visibility', authenticate, authorizeAdmin, validate({ body: bulkVisibilitySchema }), tenantScope, async (req, res) => {
    const { ids, visible } = req.body;
    try {
      const { rows, rowCount } = await req.db.query('UPDATE products SET visible = $1 WHERE id = ANY($2) RETURNING id, stock, stock_enabled, visible', [visible, ids]);
      await logAudit(req.db, req.user.id, 'BULK_PRODUCT_VISIBILITY', { ids, visible });
      rows.forEach(row => broadcast?.(req.user.tenantId, stockEvent(row)));
      res.json({ message: `Aggiornati ${rowCount} prodotti`, updatedCount: rowCount });
    } catch (err) {
      logger.error({ err }, 'Errore bulk-visibility');
      res.status(500).json({ error: 'Errore aggiornamento multiplo' });
    }
  });

  // PATCH /api/products/:id/stock — stock dalla cassa (admin, responsabile, cassa)
  router.patch('/:id/stock', authenticate, authorizeStock, validate({ params: idParamsSchema, body: stockSchema }), tenantScope, async (req, res) => {
    const { stock, stock_enabled } = req.body;
    try {
      const { rows } = await req.db.query(
        'UPDATE products SET stock = $1, stock_enabled = $2 WHERE id = $3 RETURNING *',
        [stock, stock_enabled, req.params.id]
      );
      if (!rows.length) return res.status(404).json({ error: 'Prodotto non trovato' });
      await logAudit(req.db, req.user.id, 'UPDATE_STOCK', { productId: req.params.id, stock, stock_enabled });
      broadcast?.(req.user.tenantId, stockEvent(rows[0]));
      res.json(rows[0]);
    } catch (err) {
      logger.error({ err }, 'Errore PATCH stock');
      res.status(500).json({ error: 'Errore aggiornamento stock' });
    }
  });

  // La portata di un prodotto deve essere del locale: la chiave esterna non passa dalla RLS, quindi si controlla qui.
  const courseMissing = async (db, courseId) =>
    courseId != null && !(await db.query('SELECT 1 FROM courses WHERE id = $1', [courseId])).rows.length;

  // POST /api/products
  router.post('/', authenticate, authorizeAdmin, validate({ body: productSchema }), tenantScope, async (req, res) => {
    const { name, price, category, color, visible, print_destination, course_id, prep_minutes, portions_reset_rule: rule, portions_start: start, vat_rate: vatRate } = req.body;
    try {
      if (await courseMissing(req.db, course_id)) return res.status(400).json({ error: 'Portata non valida', code: 'INVALID_COURSE' });
      let { rows } = await req.db.query(
        'INSERT INTO products (name, price, category, color, visible, print_destination, course_id, prep_minutes, vat_rate) VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8, 5),$9) RETURNING *',
        [name, price, category, color, visible, print_destination, course_id ?? null, prep_minutes ?? null, vatRate ?? null]
      );
      if (rule) rows = [await savePortionsRule(req.db, rows[0].id, { rule, start })];
      await logAudit(req.db, req.user.id, 'CREATE_PRODUCT', { productId: rows[0].id, name });
      broadcast?.(req.user.tenantId, { type: 'product_created', product: rows[0], by: req.user.id });
      res.status(201).json(rows[0]);
    } catch (err) {
      logger.error({ err }, 'Errore salvataggio prodotto');
      res.status(500).json({ error: 'Errore salvataggio prodotto' });
    }
  });

  // PUT /api/products/:id
  router.put('/:id', authenticate, authorizeAdmin, validate({ params: idParamsSchema, body: productSchema }), tenantScope, async (req, res) => {
    const { name, price, category, color, visible, print_destination, course_id, prep_minutes, portions_reset_rule: rule, portions_start: start, vat_rate: vatRate } = req.body;
    try {
      if (await courseMissing(req.db, course_id)) return res.status(400).json({ error: 'Portata non valida', code: 'INVALID_COURSE' });
      // course_id assente = non si cambia (le sagre non lo mandano); null lo toglie
      let { rows } = await req.db.query(
        `UPDATE products SET name=$1, price=$2, category=$3, color=$4, visible=$5, print_destination=$6,
           course_id = CASE WHEN $8::boolean THEN $9::int ELSE course_id END,
           prep_minutes = COALESCE($10::int, prep_minutes),
           vat_rate = CASE WHEN $11::boolean THEN $12::numeric ELSE vat_rate END WHERE id=$7 RETURNING *`,
        [name, price, category, color, visible, print_destination, req.params.id, course_id !== undefined, course_id ?? null, prep_minutes ?? null, vatRate !== undefined, vatRate ?? null]
      );
      if (!rows.length) return res.status(404).json({ error: 'Prodotto non trovato' });
      if (rule) rows = [await savePortionsRule(req.db, req.params.id, { rule, start })];
      await logAudit(req.db, req.user.id, 'UPDATE_PRODUCT', { productId: req.params.id, name, price, visible });
      broadcast?.(req.user.tenantId, { type: 'product_updated', product: rows[0], by: req.user.id });
      res.json(rows[0]);
    } catch (err) {
      logger.error({ err }, 'Errore aggiornamento prodotto');
      res.status(500).json({ error: 'Errore aggiornamento prodotto' });
    }
  });

  // DELETE /api/products/:id
  router.delete('/:id', authenticate, authorizeAdmin, validate({ params: idParamsSchema }), tenantScope, async (req, res) => {
    try {
      const { rows } = await req.db.query('DELETE FROM products WHERE id=$1 RETURNING name', [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'Prodotto non trovato' });
      await logAudit(req.db, req.user.id, 'DELETE_PRODUCT', { productId: req.params.id, name: rows[0].name });
      broadcast?.(req.user.tenantId, { type: 'product_deleted', id: Number(req.params.id), by: req.user.id });
      res.json({ message: 'Prodotto eliminato' });
    } catch (err) {
      logger.error({ err }, 'Errore eliminazione prodotto');
      res.status(500).json({ error: 'Errore eliminazione prodotto' });
    }
  });


  return router;
}
