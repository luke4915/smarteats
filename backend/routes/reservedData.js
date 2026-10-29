import express from 'express';
import bcrypt from 'bcrypt';
import { authenticate, authorizeAdmin, authorizeRoles, MANAGER_ROLES } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { tenantScope } from '../middleware/tenantScope.js';
import logger from '../logger.js';
import { logAudit } from '../utils/auditLogger.js';
import { signToken, setCookie } from '../utils/sessionToken.js';
import { DUMMY_HASH } from '../utils/password.js';
import { loadReservedState, UNLOCK_SECONDS } from '../utils/reservedData.js';
import { unlockReservedSchema } from '../schemas/authSchema.js';

// Dati riservati: com'è lo stato (bloccato o no), sblocco con la password di un amministratore e blocco anticipato.
// Lo sblocco vale per la sola sessione di chi lo chiede e finisce da solo dopo UNLOCK_SECONDS. Cosa viene bloccato lo decide
// utils/reservedData.js; qui si gestisce solo il passaggio.
const router = express.Router();
const managers = authorizeRoles(MANAGER_ROLES, 'Non hai i permessi per sbloccare i dati riservati');

// Il token con (o senza) lo sblocco, mantenendo l'inizio della sessione.
const reissue = (req, res, reservedUntil) => setCookie(res, signToken(
  { ...req.user, tenant_id: req.user.tenantId, tenant_name: req.user.tenantName }, req.user.loginAt, { reservedUntil }));

router.get('/status', authenticate, tenantScope, async (req, res) => {
  try { res.json(await loadReservedState(req.db, req.user)); }
  catch (err) {
    logger.error({ err }, 'Errore GET /api/reserved-data/status');
    res.status(500).json({ error: 'Errore caricamento stato dei dati riservati' });
  }
});

// La password è quella di UN amministratore del locale (anche di chi la sta digitando, se lo è): si verifica e non si salva.
// I tentativi sono limitati in app.js (reservedUnlockLimiter). Una password errata è un dato sbagliato (403), non una sessione scaduta (401): il client rinnoverebbe il login per niente.
router.post('/unlock', authenticate, managers, validate({ body: unlockReservedSchema }), tenantScope, async (req, res) => {
  try {
    if (!(await loadReservedState(req.db, req.user)).enabled)
      return res.status(409).json({ error: 'Il blocco dei dati riservati non è attivo', code: 'LOCK_DISABLED' });

    const { rows: admins } = await req.db.query(`SELECT id, username, password_hash FROM users WHERE role = 'admin' AND tenant_id = $1 ORDER BY id`, [req.user.tenantId]);
    let authorizedBy = null;
    for (const admin of admins) {
      if (admin.password_hash?.trim() && await bcrypt.compare(req.body.password, admin.password_hash)) { authorizedBy = admin; break; }
    }
    if (!admins.length) await bcrypt.compare(req.body.password, DUMMY_HASH);   // stesso tempo anche senza amministratori

    if (!authorizedBy) {
      await logAudit(req.db, req.user.id, 'UNLOCK_RESERVED_DATA_FAILED', {});
      return res.status(403).json({ error: 'Password dell\'amministratore non corretta', code: 'WRONG_ADMIN_PASSWORD' });
    }

    const reservedUntil = Math.floor(Date.now() / 1000) + UNLOCK_SECONDS;
    reissue(req, res, reservedUntil);
    await logAudit(req.db, req.user.id, 'UNLOCK_RESERVED_DATA', { authorizedById: authorizedBy.id, authorizedBy: authorizedBy.username, minutes: UNLOCK_SECONDS / 60 });
    res.json({ enabled: true, unlocked: true, locked: false, unlockedUntil: new Date(reservedUntil * 1000).toISOString() });
  } catch (err) {
    logger.error({ err }, 'Errore POST /api/reserved-data/unlock');
    res.status(500).json({ error: 'Errore durante lo sblocco' });
  }
});

// Spegne il blocco: senza la password dell'amministratore che lo chiede non ci si arriva (altrimenti basterebbe un tablet lasciato
// aperto sulle Impostazioni). Vale la password di chi sta facendo la richiesta, non quella di un altro amministratore.
router.post('/disable', authenticate, authorizeAdmin, validate({ body: unlockReservedSchema }), tenantScope, async (req, res) => {
  try {
    const { rows } = await req.db.query('SELECT password_hash FROM users WHERE id = $1 AND tenant_id = $2', [req.user.id, req.user.tenantId]);
    const hash = rows[0]?.password_hash?.trim() ? rows[0].password_hash : DUMMY_HASH;
    const valid = await bcrypt.compare(req.body.password, hash);
    if (!valid || hash === DUMMY_HASH) {
      await logAudit(req.db, req.user.id, 'DISABLE_RESERVED_DATA_FAILED', {});
      return res.status(403).json({ error: 'Password non corretta', code: 'WRONG_ADMIN_PASSWORD' });
    }
    await req.db.query(
      `INSERT INTO settings (key, value) VALUES ('reserved_data_lock', '0') ON CONFLICT (tenant_id, key) DO UPDATE SET value = '0'`);
    await logAudit(req.db, req.user.id, 'DISABLE_RESERVED_DATA', {});
    res.json(await loadReservedState(req.db, req.user));
  } catch (err) {
    logger.error({ err }, 'Errore POST /api/reserved-data/disable');
    res.status(500).json({ error: 'Errore durante lo spegnimento del blocco' });
  }
});

// Richiude subito, senza aspettare i minuti dello sblocco.
router.post('/lock', authenticate, tenantScope, async (req, res) => {
  try {
    reissue(req, res, undefined);
    res.json({ ...(await loadReservedState(req.db, { ...req.user, reservedUntil: undefined })) });
  } catch (err) {
    logger.error({ err }, 'Errore POST /api/reserved-data/lock');
    res.status(500).json({ error: 'Errore durante il blocco' });
  }
});

export default router;
