import express from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { tenantScope } from '../middleware/tenantScope.js';
import logger from '../logger.js';
import { feedbackSchema } from '../schemas/feedbackSchema.js';

// Feedback sull'app: lo scrive qualsiasi utente collegato (suggerimenti, problemi), lo legge il master (routes/master.js).
const router = express.Router();

router.post('/', authenticate, validate({ body: feedbackSchema }), tenantScope, async (req, res) => {
  const { module, message } = req.body;
  try {
    const { rows: [row] } = await req.db.query(
      'INSERT INTO app_feedback (user_id, username, module, message) VALUES ($1, $2, $3, $4) RETURNING id, created_at',
      [req.user.id, req.user.username, module, message]);
    res.status(201).json({ id: row.id, created_at: row.created_at });
  } catch (err) {
    logger.error({ err }, 'Errore POST /api/feedback');
    res.status(500).json({ error: 'Non siamo riusciti a inviare il feedback, riprova tra poco' });
  }
});

export default router;
