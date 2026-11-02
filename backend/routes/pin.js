import express from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../db.js';
import { authenticate, authorizeAdmin } from '../middleware/authenticate.js';
import { tenantScope } from '../middleware/tenantScope.js';
import { validate } from '../middleware/validate.js';
import { idParamsSchema } from '../schemas/common.js';
import { newPinSchema, unlockSchema, switchSchema } from '../schemas/pinSchema.js';
import { setPin, clearPin, listOperators, checkPin } from '../utils/pin.js';
import { canSwitchTo } from '../utils/pinRules.js';
import { signToken, setCookie } from '../utils/sessionToken.js';
import { sessionPayload } from '../utils/sessionPayload.js';
import { logAudit } from '../utils/auditLogger.js';
import { sendHttpError } from '../utils/httpError.js';
import { invalidateUserStatus } from '../utils/userStatus.js';
import logger from '../logger.js';

// PIN personale: l'amministratore lo imposta, l'utente blocca e sblocca lo schermo, il personale operativo si dà il cambio sulla stessa cassa.
// Vale solo su un dispositivo già collegato al locale (serve una sessione valida): il primo accesso resta con la password.
const router = express.Router();

// Cosa risponde un controllo del PIN: 403 (mai 401: un 401 vuol dire sessione scaduta) con un codice che l'interfaccia distingue.
function pinFailure(res, check) {
  if (check.result === 'locked') return res.status(403).json({ error: `Troppi tentativi: riprova tra ${check.minutes} ${check.minutes === 1 ? 'minuto' : 'minuti'}, oppure usa la password.`, code: 'PIN_LOCKED' });
  if (check.result === 'none') return res.status(403).json({ error: 'Per questo utente non c\'è un PIN: usa la password.', code: 'NO_PIN' });
  return res.status(403).json({ error: `PIN errato (${check.attemptsLeft} ${check.attemptsLeft === 1 ? 'tentativo' : 'tentativi'} prima del blocco)`, code: 'WRONG_PIN' });
}

// L'amministratore imposta il PIN di un utente (anche il proprio)
router.put('/users/:id', authenticate, authorizeAdmin, validate({ params: idParamsSchema, body: newPinSchema }), tenantScope, async (req, res) => {
  try {
    const user = await setPin(req.db, req.params.id, req.body.pin);
    await logAudit(req.db, req.user.id, 'PIN_SET', { userId: user.id, username: user.username });
    res.json({ ok: true });
  } catch (err) {
    if (sendHttpError(res, err)) return;
    logger.error({ err }, 'Errore PUT /api/pin/users/:id');
    res.status(500).json({ error: 'Errore salvataggio PIN' });
  }
});

router.delete('/users/:id', authenticate, authorizeAdmin, validate({ params: idParamsSchema }), tenantScope, async (req, res) => {
  try {
    const user = await clearPin(req.db, req.params.id);
    await logAudit(req.db, req.user.id, 'PIN_CLEARED', { userId: user.id, username: user.username });
    res.json({ ok: true });
  } catch (err) {
    if (sendHttpError(res, err)) return;
    logger.error({ err }, 'Errore DELETE /api/pin/users/:id');
    res.status(500).json({ error: 'Errore eliminazione PIN' });
  }
});

// Chi si può scegliere nel cambio utente veloce (nomi e ruoli del personale operativo con un PIN)
router.get('/operators', authenticate, tenantScope, async (req, res) => {
  try { res.json(await listOperators(req.db)); }
  catch (err) { logger.error({ err }, 'Errore GET /api/pin/operators'); res.status(500).json({ error: 'Errore caricamento utenti' }); }
});

// Sblocca lo schermo di chi è collegato: con il suo PIN, oppure con la sua password
router.post('/unlock', authenticate, validate({ body: unlockSchema }), tenantScope, async (req, res) => {
  try {
    if (req.body.password !== undefined) {
      const { rows: [u] } = await req.db.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
      if (!u?.password_hash || !(await bcrypt.compare(req.body.password, u.password_hash))) return res.status(403).json({ error: 'Password errata', code: 'WRONG_PASSWORD' });
      return res.json({ ok: true });
    }
    const check = await checkPin(req.db, req.user.id, req.body.pin);
    if (check.result === 'ok') return res.json({ ok: true, pinSetAt: check.user.pin_set_at });   // l'app lo lega all'impronta locale del PIN
    if (check.justLocked) await logAudit(req.db, req.user.id, 'PIN_LOCKED_OUT', { via: 'unlock' });
    pinFailure(res, check);
  } catch (err) {
    logger.error({ err }, 'Errore POST /api/pin/unlock');
    res.status(500).json({ error: 'Errore sblocco' });
  }
});

// Cambio utente veloce: il PIN di un collega apre la sua sessione sullo stesso dispositivo (nuovo cookie). Personale operativo con qualsiasi PIN, admin e responsabile con un PIN di 6 cifre, e
// non chi deve ancora cambiare la password temporanea.
router.post('/switch', authenticate, validate({ body: switchSchema }), tenantScope, async (req, res) => {
  try {
    const { rows: [target] } = await req.db.query('SELECT id, username, role, must_change_password, pin_length FROM users WHERE id = $1', [req.body.userId]);
    if (!target || !canSwitchTo(target.role, target.pin_length)) return res.status(403).json({ error: 'Con il PIN si cambia utente con il personale di cassa, sala e cucina; per amministratore e responsabile serve un PIN di 6 cifre, altrimenti la password.', code: 'NOT_SWITCHABLE' });
    if (target.must_change_password) return res.status(403).json({ error: 'Questo utente deve prima cambiare la password: accedi con la password.', code: 'PASSWORD_CHANGE_REQUIRED' });
    const check = await checkPin(req.db, target.id, req.body.pin);
    if (check.result !== 'ok') {
      if (check.justLocked) await logAudit(req.db, target.id, 'PIN_LOCKED_OUT', { via: 'switch', by: req.user.id });
      return pinFailure(res, check);
    }
    const { rows: [tenant] } = await pool.query('SELECT name, business_type, modules, inventory_mode, inventory_depletion, expires_at FROM tenants WHERE id = $1', [req.user.tenantId]);
    const user = { ...check.user, tenant_name: tenant.name };
    invalidateUserStatus(req.user.tenantId, user.id);
    setCookie(res, signToken(user));
    await logAudit(req.db, user.id, 'PIN_SWITCH', { from: req.user.id, fromUsername: req.user.username });
    res.json(sessionPayload(user, tenant));
  } catch (err) {
    logger.error({ err }, 'Errore POST /api/pin/switch');
    res.status(500).json({ error: 'Errore cambio utente' });
  }
});

export default router;
