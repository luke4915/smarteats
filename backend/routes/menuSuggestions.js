import express from 'express';
import { authenticate, authorizeAdmin } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { tenantScope } from '../middleware/tenantScope.js';
import { requireModule } from '../utils/tenantModules.js';
import { logAudit } from '../utils/auditLogger.js';
import { menuSuggestionsSchema } from '../schemas/menuSuggestionsSchema.js';
import { SUGGESTIONS_KEY, loadRules } from '../utils/menuSuggestions.js';
import logger from '../logger.js';

// I suggerimenti del menu pubblico (modulo `qr_menu`): li legge e li scrive solo l'amministratore. Dal menu li leggono i clienti, già filtrati
// (`GET /products/menu`). Funzione isolata: per toglierla basta cancellare questo file, `utils/menuSuggestions.js` e i riferimenti.
const router = express.Router();
const guard = [authenticate, requireModule('qr_menu'), authorizeAdmin];

router.get('/', ...guard, tenantScope, async (req, res) => {
  try { res.json({ rules: await loadRules(req.db) }); }
  catch (err) { logger.error({ err }, 'Errore GET /api/menu-suggestions'); res.status(500).json({ error: 'Errore caricamento suggerimenti' }); }
});

router.put('/', ...guard, validate({ body: menuSuggestionsSchema }), tenantScope, async (req, res) => {
  const { rules } = req.body;
  try {
    const wanted = [...new Set(rules.flatMap(r => [r.suggest, r.product].filter(Boolean)))];
    const { rows } = await req.db.query('SELECT id FROM products WHERE id = ANY($1)', [wanted]);
    if (rows.length !== wanted.length) return res.status(400).json({ error: 'Uno dei prodotti scelti non esiste più' });
    await req.db.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (tenant_id, key) DO UPDATE SET value = $2', [SUGGESTIONS_KEY, JSON.stringify(rules)]);
    await logAudit(req.db, req.user.id, 'UPDATE_MENU_SUGGESTIONS', { rules: rules.length });
    res.json({ rules });
  } catch (err) {
    logger.error({ err }, 'Errore PUT /api/menu-suggestions');
    res.status(500).json({ error: 'Errore salvataggio suggerimenti' });
  }
});

export default router;
