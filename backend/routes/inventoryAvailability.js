import express from 'express';
import { authenticate, authorizeRoles } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { tenantScope } from '../middleware/tenantScope.js';
import logger from '../logger.js';
import { logAudit } from '../utils/auditLogger.js';
import { requireModule, getTenantModules } from '../utils/tenantModules.js';
import { loadRecipeBook } from '../utils/inventory/recipeBookDb.js';
import { portionsFromIngredients } from '../utils/inventory/recipeNeeds.js';
import { portionsWhenBackInStock, portionsWhenSoldOut } from '../utils/inventory/portions.js';
import { HttpError, sendHttpError } from '../utils/httpError.js';
import { inTransaction } from '../db.js';
import { idParamsSchema } from '../schemas/common.js';
import { availabilitySchema } from '../schemas/inventorySchema.js';

// Disponibilità dei piatti. Tutto il personale vede quanti piatti permettono gli ingredienti (la cassa e la sala avvisano
// «esaurito»); amministratore, responsabile e cucina segnano un piatto esaurito o di nuovo disponibile con un tocco.
export const inventoryRouter = express.Router();
const guard = [authenticate, requireModule('inventory')];
const kitchenOrManager = authorizeRoles(['admin', 'manager', 'kitchen'], 'Non hai i permessi per cambiare la disponibilità');

// GET /api/inventory/availability — per ogni piatto con ricetta, quante porzioni permette la dispensa (modalità magazzino con
// ricette). Negli altri casi l'elenco è vuoto: i piatti si limitano con le sole porzioni.
inventoryRouter.get('/availability', ...guard, tenantScope, async (req, res) => {
  try {
    const inventory = (await getTenantModules(req.user.tenantId))?.inventory;
    if (inventory?.mode !== 'warehouse' || inventory.depletion !== 'recipes') return res.json({ products: [] });
    const book = await loadRecipeBook(req.db);
    res.json({ products: [...book.productLines.keys()].map(id => ({ product_id: id, ingredient_portions: portionsFromIngredients(id, book) })) });
  } catch (err) {
    logger.error({ err }, 'Errore GET /api/inventory/availability');
    res.status(500).json({ error: 'Errore caricamento disponibilità' });
  }
});

// La route dei piatti è una factory: ogni cambio di disponibilità parte come evento a tutti i dispositivi, che aggiornano la tessera.
export function productAvailabilityRouter(broadcast) {
  const router = express.Router();
  // PUT /api/products/:id/availability — {available: false} segna il piatto esaurito (zero porzioni, resta in carta in grigio);
  // {available: true} lo rimette in vendita (riparte da N se ha quella regola, altrimenti illimitato, e torna visibile).
  // La disponibilità la cambiano cucina, responsabile e amministratore: la riga si blocca per tutta l'operazione (come fanno le vendite,
  // che scalano le porzioni sulla stessa riga) e il risultato arriva a tutti i dispositivi, così nessuno resta con una tessera vecchia.
  router.put('/:id/availability', ...guard, kitchenOrManager, validate({ params: idParamsSchema, body: availabilitySchema }), tenantScope, async (req, res) => {
    try {
      const saved = await inTransaction(req.db, async (db) => {
        const { rows: [product] } = await db.query('SELECT id, name, visible, portions_reset_rule, portions_start FROM products WHERE id = $1 FOR UPDATE', [req.params.id]);
        if (!product) throw new HttpError(404, 'Prodotto non trovato');
        const next = req.body.available ? portionsWhenBackInStock(product) : portionsWhenSoldOut(product);
        const { rows: [row] } = await db.query(
          'UPDATE products SET stock = $2, stock_enabled = $3, visible = $4 WHERE id = $1 RETURNING *', [product.id, next.stock, next.stock_enabled, next.visible]);
        return { row, name: product.name };
      });
      await logAudit(req.db, req.user.id, req.body.available ? 'PRODUCT_AVAILABLE' : 'PRODUCT_SOLD_OUT', { productId: saved.row.id, name: saved.name });
      broadcast?.(req.user.tenantId, { type: 'product_stock_updated', product: { id: saved.row.id, stock: saved.row.stock, stock_enabled: saved.row.stock_enabled, visible: saved.row.visible } });
      res.json(saved.row);
    } catch (err) {
      if (sendHttpError(res, err)) return;
      logger.error({ err }, 'Errore PUT /api/products/:id/availability');
      res.status(500).json({ error: 'Errore aggiornamento disponibilità' });
    }
  });

  return router;
}
