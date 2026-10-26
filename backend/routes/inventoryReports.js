import express from 'express';
import { authenticate, authorizeManager } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { tenantScope } from '../middleware/tenantScope.js';
import logger from '../logger.js';
import { requireModule } from '../utils/tenantModules.js';
import { requireWarehouseMode } from '../utils/inventory/guards.js';
import { buildReport } from '../utils/inventory/reportsDb.js';
import { reportQuerySchema } from '../schemas/inventorySchema.js';

// Il report del magazzino (food cost, margini per piatto, scarti, teorico contro reale, valore della dispensa) per un periodo.
// Solo amministratore e responsabile: sono costi e margini.
const router = express.Router();

router.get('/', authenticate, requireModule('inventory'), requireWarehouseMode, authorizeManager, validate({ query: reportQuerySchema }), tenantScope, async (req, res) => {
  try { res.json(await buildReport(req.db, req.validQuery)); }
  catch (err) {
    logger.error({ err }, 'Errore GET /api/inventory/report');
    res.status(500).json({ error: 'Errore calcolo del report' });
  }
});

export default router;
