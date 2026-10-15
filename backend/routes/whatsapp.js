import express from 'express';
import { authenticate, authorizeWaiter } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { tenantScope } from '../middleware/tenantScope.js';
import logger from '../logger.js';
import { requireModule } from '../utils/tenantModules.js';
import { z } from 'zod';

// Stato degli avvisi WhatsApp per il personale (sola lettura, più «invia di nuovo»). La configurazione è solo del Master
// (routes/master.js). Disegno: docs/design-whatsapp.md.
const router = express.Router();
const guard = [authenticate, requireModule('whatsapp'), authorizeWaiter];

const COLUMNS = 'id, ref_type, ref_id, event, status, error, attempts, to_phone, created_at, sent_at';
const listQuery = z.object({ ref_type: z.enum(['reservation', 'takeaway']), ref_id: z.coerce.number().int().positive() });

router.get('/messages', ...guard, validate({ query: listQuery }), tenantScope, async (req, res) => {
  try {
    const { rows } = await req.db.query(
      `SELECT ${COLUMNS} FROM whatsapp_messages WHERE ref_type = $1 AND ref_id = $2 ORDER BY id`, [req.validQuery.ref_type, req.validQuery.ref_id]);
    // il numero completo non serve al personale: si mostrano le ultime cifre
    res.json(rows.map(({ to_phone: phone, ...m }) => ({ ...m, to: phone ? `…${phone.slice(-3)}` : '' })));
  } catch (err) {
    logger.error({ err }, 'Errore GET /api/whatsapp/messages');
    res.status(500).json({ error: 'Errore caricamento avvisi' });
  }
});

// Un invio fallito si può rimettere in coda dal personale (ad esempio dopo aver corretto il numero)
router.post('/messages/:id/retry', ...guard, validate({ params: z.object({ id: z.coerce.number().int().positive() }) }), tenantScope, async (req, res) => {
  try {
    const { rows } = await req.db.query(
      `UPDATE whatsapp_messages SET status = 'queued', error = '', attempts = 0, next_attempt_at = now()
       WHERE id = $1 AND status = 'failed' RETURNING id`, [req.params.id]);
    if (!rows.length) return res.status(409).json({ error: 'Questo avviso non si può rimandare', code: 'NOT_FAILED' });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'Errore POST /api/whatsapp/messages/:id/retry');
    res.status(500).json({ error: 'Errore invio avviso' });
  }
});

export default router;
