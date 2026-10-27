import express from 'express';
import { authenticate, authorizeAdmin } from '../middleware/authenticate.js';
import { tenantScope, withTenantClient } from '../middleware/tenantScope.js';
import { resolveTenantFromHost } from '../middleware/resolveTenantFromHost.js';
import logger from '../logger.js';
import { logAudit } from '../utils/auditLogger.js';
import { SETTINGS_KEYS, PUBLIC_SETTINGS_KEYS, settingParamsSchema, settingValueSchema } from '../schemas/settingsSchema.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();

// GET /api/settings — pubblico (menu con QR): solo le chiavi in PUBLIC_SETTINGS_KEYS
router.get('/', resolveTenantFromHost, async (req, res) => {
    try {
        const settings = await withTenantClient(req.tenantId, async (db) => {
            const { rows } = await db.query(
                'SELECT key, value FROM settings WHERE key = ANY($1)',
                [PUBLIC_SETTINGS_KEYS]
            );
            return Object.fromEntries(rows.map(r => [r.key, r.value]));
        });
        res.json(settings);
    } catch (err) {
        logger.error({ err }, 'Errore GET /api/settings');
        res.status(500).json({ error: 'Errore caricamento impostazioni' });
    }
});

// GET /api/settings/all — utenti autenticati: tutte le chiavi note, comprese quelle private
// (contenuto degli scontrini), che la cassa conserva in locale per stampare anche offline
router.get('/all', authenticate, tenantScope, async (req, res) => {
    try {
        const { rows } = await req.db.query('SELECT key, value FROM settings WHERE key = ANY($1)', [SETTINGS_KEYS]);
        res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
    } catch (err) {
        logger.error({ err }, 'Errore GET /api/settings/all');
        res.status(500).json({ error: 'Errore caricamento impostazioni' });
    }
});

// PUT /api/settings/:key — solo admin, solo chiavi note
router.put('/:key', authenticate, authorizeAdmin, validate({ params: settingParamsSchema, body: settingValueSchema }), tenantScope, async (req, res) => {
    const { key } = req.params;
    let { value } = req.body;
    if (key === 'cover_charge' && value !== null && value !== '') {
        // Euro per persona: numero da 0 a 100 con al massimo due decimali, salvato col punto
        const text = value.trim().replace(',', '.');
        if (!/^\d{1,3}(\.\d{1,2})?$/.test(text) || Number(text) > 100)
            return res.status(400).json({ error: 'value: indica un importo in euro da 0 a 100 (es. 2,50)' });
        value = Number(text).toFixed(2);
    }
    if (key === 'default_vat_rate' && !(typeof value === 'string' && /^\d{1,2}([.,]\d{1,2})?$/.test(value.trim()) && Number(value.trim().replace(',', '.')) <= 99))
        return res.status(400).json({ error: 'value: indica un\'aliquota IVA da 0 a 99 (es. 10)' });
    if (key === 'default_vat_rate') value = String(Number(value.trim().replace(',', '.')));
    if (key === 'reserved_data_lock' && !['0', '1'].includes(value))
        return res.status(400).json({ error: 'value: usa 1 (acceso) o 0 (spento)' });
    if (key === 'booking_portal_enabled' && !['0', '1'].includes(value))
        return res.status(400).json({ error: 'value: usa 1 (acceso) o 0 (spento)' });
    if (key === 'booking_portal_phone' && value && !/^[+\d][\d\s./-]{4,38}$/.test(value.trim()))
        return res.status(400).json({ error: 'value: scrivi un numero di telefono (cifre, spazi, + . / -)' });
    if (key === 'takeaway_portal_enabled' && !['0', '1'].includes(value))
        return res.status(400).json({ error: 'value: usa 1 (acceso) o 0 (spento)' });
    if (key === 'takeaway_slot_minutes' && !['10', '15', '20', '30', '60'].includes(String(value)))
        return res.status(400).json({ error: 'value: la fascia dura 10, 15, 20, 30 o 60 minuti' });
    if (key === 'takeaway_slot_capacity' && !(/^\d{1,3}$/.test(String(value)) && Number(value) >= 1))
        return res.status(400).json({ error: 'value: indica quante pizze per fascia (da 1 a 999)' });
    if (key === 'takeaway_min_lead_minutes' && !(/^\d{1,3}$/.test(String(value)) && Number(value) <= 240))
        return res.status(400).json({ error: 'value: l\'anticipo minimo va da 0 a 240 minuti' });
    if (key === 'takeaway_phone' && value && !/^[+\d][\d\s./-]{4,38}$/.test(value.trim()))
        return res.status(400).json({ error: 'value: scrivi un numero di telefono (cifre, spazi, + . / -)' });
    if (key === 'takeaway_welcome' && value && value.length > 500)
        return res.status(400).json({ error: 'value: il messaggio è lungo al massimo 500 caratteri' });
    if (key === 'booking_portal_welcome' && value && value.length > 500)
        return res.status(400).json({ error: 'value: il testo di benvenuto è lungo al massimo 500 caratteri' });
    try {
        await req.db.query(
            'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (tenant_id, key) DO UPDATE SET value = $2',
            [key, value]
        );
        await logAudit(req.db, req.user.id, 'UPDATE_SETTING', { key: key });
        res.json({ key: key, value });
    } catch (err) {
        logger.error({ err }, 'Errore PUT /api/settings/:key');
        res.status(500).json({ error: 'Errore salvataggio impostazione' });
    }
});

export default router;
