import express from 'express';
import { authenticate, authorizeAdmin, authorizeRoles } from '../middleware/authenticate.js';
import { tenantScope } from '../middleware/tenantScope.js';
import logger from '../logger.js';
import { validate } from '../middleware/validate.js';
import { idParamsSchema } from '../schemas/common.js';
import { sessionExportQuerySchema, sessionReportQuerySchema } from '../schemas/statsSchema.js';
import { withItems } from '../utils/orderItemsRead.js';
import { isRevenue } from '../utils/revenue.js';
import { requireUnlocked } from '../utils/reservedData.js';
import { linesCsv, productsCsv, exportFileName } from '../utils/sessionExport.js';
import { loadSessionReport, loadProductTotals } from '../utils/sessionReport.js';

const router = express.Router();

const authorizeReport = authorizeRoles(['admin', 'manager'], 'Il report della serata è riservato ad admin e responsabili');

// GET /api/exports/session/:id/csv?type=lines|products&tz=Europe/Rome — il CSV della serata, per Excel.
// `lines` (di partenza): una riga per riga d'ordine, con cassa o tavolo, opzioni, omaggi e sconti. `products`: una riga per prodotto.
router.get('/session/:id/csv', authenticate, authorizeAdmin, validate({ params: idParamsSchema, query: sessionExportQuerySchema }), tenantScope, requireUnlocked, async (req, res) => {
  const sessionId = req.params.id;
  const { type, tz } = req.validQuery;

  try {
    const { rows: sessionRows } = await req.db.query('SELECT id, name FROM sessions WHERE id=$1', [sessionId]);
    if (!sessionRows.length) return res.status(404).json({ error: 'Sessione non trovata' });

    let body;
    if (type === 'products') {
      body = productsCsv(await loadProductTotals(req.db, sessionId));
    } else {
      const { rows } = await req.db.query(
        `SELECT o.id, o.display_code, o.created_at, o.total, o.is_takeaway, d.letter AS device_letter, t.name AS table_name
         FROM orders o
         LEFT JOIN devices d ON d.id = o.device_id
         LEFT JOIN checks c ON c.id = o.check_id
         LEFT JOIN dining_tables t ON t.id = c.table_id
         WHERE ${isRevenue('o')} AND o.session_id = $1
         ORDER BY o.created_at ASC, o.id ASC`,
        [sessionId]
      );
      body = linesCsv(await withItems(req.db, rows), tz);
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=${exportFileName(sessionRows[0].name, sessionId, type === 'products' ? 'prodotti' : 'righe')}`);
    res.status(200).send(body);
  } catch (err) {
    logger.error({ err }, 'Errore CSV');
    res.status(500).json({ error: 'Errore generazione CSV' });
  }
});

// GET /api/exports/session/:id/report?tz=Europe/Rome — i numeri della serata (incasso, cassa, pagamenti, prodotti, ore) per il PDF.
router.get('/session/:id/report', authenticate, authorizeReport, validate({ params: idParamsSchema, query: sessionReportQuerySchema }), tenantScope, requireUnlocked, async (req, res) => {
  try {
    const report = await loadSessionReport(req.db, req.params.id, req.validQuery.tz, req.user.tenantId);
    if (!report) return res.status(404).json({ error: 'Sessione non trovata' });
    res.json(report);
  } catch (err) {
    logger.error({ err }, 'Errore GET /api/exports/session/:id/report');
    res.status(500).json({ error: 'Errore nel calcolo del report' });
  }
});

export default router;
