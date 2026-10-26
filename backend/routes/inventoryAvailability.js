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
import { idParamsSchema } from '../schemas/common.js';
import { availabilitySchema } from '../schemas/inventorySchema.js';

// Disponibilità dei piatti. Tutto il personale vede quanti piatti permettono gli ingredienti (la cassa e la sala avvisano
// «esaurito»); amministratore, responsabile e cucina segnano un piatto esaurito o di nuovo disponibile con un tocco.
export const inventoryRouter = express.Router();
export const productAvailabilityRouter = express.Router();
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

// PUT /api/products/:id/availability — {available: false} segna il piatto esaurito (zero porzioni, nascosto); {available: true}
// lo rimette in vendita (riparte da N se ha quella regola, altrimenti illimitato).
productAvailabilityRouter.put('/:id/availability', ...guard, kitchenOrManager, validate({ params: idParamsSchema, body: availabilitySchema }), tenantScope, async (req, res) => {
  try {
    const { rows: [product] } = await req.db.query('SELECT id, name, portions_reset_rule, portions_start FROM products WHERE id = $1', [req.params.id]);
    if (!product) throw new HttpError(404, 'Prodotto non trovato');
    const next = req.body.available ? portionsWhenBackInStock(product) : portionsWhenSoldOut();
    const { rows: [saved] } = await req.db.query(
      'UPDATE products SET stock = $2, stock_enabled = $3, visible = $4 WHERE id = $1 RETURNING *', [product.id, next.stock, next.stock_enabled, next.visible]);
    await logAudit(req.db, req.user.id, req.body.available ? 'PRODUCT_AVAILABLE' : 'PRODUCT_SOLD_OUT', { productId: product.id, name: product.name });
    res.json(saved);
  } catch (err) {
    if (sendHttpError(res, err)) return;
    logger.error({ err }, 'Errore PUT /api/products/:id/availability');
    res.status(500).json({ error: 'Errore aggiornamento disponibilità' });
  }
});
