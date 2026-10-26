import express from 'express';
import { authenticate, authorizeManager } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { tenantScope } from '../middleware/tenantScope.js';
import logger from '../logger.js';
import { requireModule } from '../utils/tenantModules.js';
import { requireWarehouseMode } from '../utils/inventory/guards.js';
import { stockOverview } from '../utils/inventory/restockDb.js';
import { restockQuerySchema } from '../schemas/inventorySchema.js';

// Le scorte con i giorni che durano e quelle da riordinare (`?only=low`, alimenta anche la campanella).
// Solo amministratore e responsabile.
const router = express.Router();

router.get('/', authenticate, requireModule('inventory'), requireWarehouseMode, authorizeManager, validate({ query: restockQuerySchema }), tenantScope, async (req, res) => {
  try { res.json(await stockOverview(req.db, { days: req.validQuery.days, onlyLow: req.validQuery.only === 'low' })); }
  catch (err) {
    logger.error({ err }, 'Errore GET /api/inventory/restock');
    res.status(500).json({ error: 'Errore caricamento scorte' });
  }
});

export default router;
