import express from 'express';
import logger from '../logger.js';
import { verifySignature } from '../utils/whatsapp/driver.js';
import { handleWebhook } from '../utils/whatsapp/webhook.js';

// Webhook di Meta per gli avvisi WhatsApp: verifica del collegamento (GET) ed eventi (POST: stati dei messaggi e
// risposte dei clienti). Non ha login né tenant: vale solo la firma con il segreto dell'app (`WHATSAPP_APP_SECRET`).
// Il corpo grezzo lo conserva express.json in `req.rawBody` (app.js). Disegno: docs/design-whatsapp.md.
const router = express.Router();

router.get('/', (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
  if (mode === 'subscribe' && process.env.WHATSAPP_VERIFY_TOKEN && token === process.env.WHATSAPP_VERIFY_TOKEN && challenge) return res.status(200).send(String(challenge));
  res.status(403).json({ error: 'Verifica non riuscita' });
});

router.post('/', async (req, res) => {
  if (!verifySignature(req.rawBody, req.get('x-hub-signature-256'), process.env.WHATSAPP_APP_SECRET))
    return res.status(401).json({ error: 'Firma non valida' });
  try {
    const handled = await handleWebhook(req.body);
    res.status(200).json({ ok: true, handled });
  } catch (err) {
    // 500: Meta riprova più tardi
    logger.error({ err }, 'Errore webhook WhatsApp');
    res.status(500).json({ error: 'Errore elaborazione' });
  }
});

export default router;
