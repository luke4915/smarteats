import express from 'express';
import { authenticate, authorizeManager } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { tenantScope } from '../middleware/tenantScope.js';
import { inTransaction } from '../db.js';
import logger from '../logger.js';
import { logAudit } from '../utils/auditLogger.js';
import { requireModule } from '../utils/tenantModules.js';
import { requireWarehouseMode } from '../utils/inventory/guards.js';
import { createGoodsReceipt } from '../utils/inventory/goodsReceiptDb.js';
import { MAX_DOCUMENT_BYTES, DOCUMENT_TYPES, MAX_DOCUMENTS_PER_RECEIPT, sniffDocumentType, safeFileName } from '../utils/inventory/documents.js';
import { HttpError, sendHttpError } from '../utils/httpError.js';
import { idParamsSchema } from '../schemas/common.js';
import { goodsReceiptSchema, goodsReceiptsQuerySchema, receiptDocumentParamsSchema } from '../schemas/supplierSchema.js';
import { maskReserved } from '../utils/reservedData.js';

// Carichi di merce (la «bolla»): cosa è arrivato, da quale fornitore, a che prezzo; con la foto o il file della bolla.
// Solo amministratore e responsabile (sono costi). Un carico scritto non si modifica: lo storico dei movimenti non si corregge.
const router = express.Router();
const guard = [authenticate, requireModule('inventory'), requireWarehouseMode, authorizeManager];

router.get('/', ...guard, validate({ query: goodsReceiptsQuerySchema }), tenantScope, maskReserved, async (req, res) => {
  const { from, to, supplier_id: supplierId, limit } = req.validQuery;
  try {
    const { rows } = await req.db.query(
      `SELECT r.id, r.supplier_id, s.name AS supplier_name, to_char(r.received_on, 'YYYY-MM-DD') AS received_on, r.document_number, r.total_cost_cents,
              (SELECT count(*)::int FROM goods_receipt_lines l WHERE l.goods_receipt_id = r.id) AS lines,
              (SELECT count(*)::int FROM stored_documents d WHERE d.goods_receipt_id = r.id) AS documents
       FROM goods_receipts r JOIN suppliers s ON s.id = r.supplier_id
       WHERE ($1::date IS NULL OR r.received_on >= $1) AND ($2::date IS NULL OR r.received_on <= $2) AND ($3::int IS NULL OR r.supplier_id = $3)
       ORDER BY r.received_on DESC, r.id DESC LIMIT $4`, [from ?? null, to ?? null, supplierId ?? null, limit]);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, 'Errore GET /api/goods-receipts');
    res.status(500).json({ error: 'Errore caricamento carichi' });
  }
});

router.get('/:id', ...guard, validate({ params: idParamsSchema }), tenantScope, maskReserved, async (req, res) => {
  try {
    const { rows: [receipt] } = await req.db.query(
      `SELECT r.id, r.supplier_id, s.name AS supplier_name, to_char(r.received_on, 'YYYY-MM-DD') AS received_on, r.document_number, r.notes, r.total_cost_cents, r.created_at
       FROM goods_receipts r JOIN suppliers s ON s.id = r.supplier_id WHERE r.id = $1`, [req.params.id]);
    if (!receipt) throw new HttpError(404, 'Scarico non trovato');
    const [{ rows: lines }, { rows: documents }] = await Promise.all([
      req.db.query(
        `SELECT l.ingredient_id, i.name AS ingredient_name, i.base_unit, l.purchase_unit_name, l.quantity, l.base_quantity, l.unit_cost_cents, l.vat_rate, l.line_cost_cents
         FROM goods_receipt_lines l JOIN ingredients i ON i.id = l.ingredient_id WHERE l.goods_receipt_id = $1 ORDER BY l.id`, [req.params.id]),
      req.db.query('SELECT id, file_name, content_type, size_bytes FROM stored_documents WHERE goods_receipt_id = $1 ORDER BY id', [req.params.id]),
    ]);
    res.json({
      ...receipt,
      lines: lines.map(l => ({ ...l, quantity: Number(l.quantity), base_quantity: Number(l.base_quantity), vat_rate: l.vat_rate === null ? null : Number(l.vat_rate) })),
      documents,
    });
  } catch (err) {
    if (sendHttpError(res, err)) return;
    logger.error({ err }, 'Errore GET /api/goods-receipts/:id');
    res.status(500).json({ error: 'Errore caricamento carico' });
  }
});

router.post('/', ...guard, validate({ body: goodsReceiptSchema }), tenantScope, maskReserved, async (req, res) => {
  const { supplier_id: supplierId, received_on: receivedOn, document_number: documentNumber, notes, lines } = req.body;
  try {
    const created = await inTransaction(req.db, (db) => createGoodsReceipt(db, { userId: req.user.id, supplierId, receivedOn, documentNumber, notes, lines }));
    await logAudit(req.db, req.user.id, 'CREATE_GOODS_RECEIPT', { goodsReceiptId: created.id, supplierId, lines: lines.length, totalCostCents: created.totalCostCents });
    res.status(201).json(created);
  } catch (err) {
    if (sendHttpError(res, err)) return;
    logger.error({ err }, 'Errore POST /api/goods-receipts');
    res.status(500).json({ error: 'Errore registrazione scarico' });
  }
});

// ── Foto o file della bolla ──
// Il file arriva come corpo grezzo (PUT, `Content-Type` del file, nome in `X-File-Name`): niente librerie in più. Il tipo si
// controlla sui primi byte, non solo sull'intestazione.
const rawDocument = express.raw({ type: DOCUMENT_TYPES, limit: MAX_DOCUMENT_BYTES });

router.put('/:id/documents', ...guard, validate({ params: idParamsSchema }), rawDocument, tenantScope, maskReserved, async (req, res) => {
  try {
    const body = req.body;
    if (!Buffer.isBuffer(body) || !body.length) throw new HttpError(400, 'Allega una foto (JPG, PNG, WebP) o un PDF', 'INVALID_DOCUMENT');
    const type = sniffDocumentType(body);
    if (!type || type !== req.headers['content-type']?.split(';')[0]) throw new HttpError(400, 'Il file non è una foto o un PDF valido', 'INVALID_DOCUMENT');
    const { rows: [counted] } = await req.db.query(
      'SELECT (SELECT count(*)::int FROM stored_documents WHERE goods_receipt_id = $1) AS n, EXISTS (SELECT 1 FROM goods_receipts WHERE id = $1) AS found', [req.params.id]);
    if (!counted.found) throw new HttpError(404, 'Scarico non trovato');
    if (counted.n >= MAX_DOCUMENTS_PER_RECEIPT) throw new HttpError(409, `Al massimo ${MAX_DOCUMENTS_PER_RECEIPT} allegati per scarico`, 'TOO_MANY_DOCUMENTS');
    const { rows: [doc] } = await req.db.query(
      `INSERT INTO stored_documents (goods_receipt_id, file_name, content_type, size_bytes, data) VALUES ($1, $2, $3, $4, $5) RETURNING id, file_name, content_type, size_bytes`,
      [req.params.id, safeFileName(req.headers['x-file-name']), type, body.length, body]);
    await logAudit(req.db, req.user.id, 'ADD_RECEIPT_DOCUMENT', { goodsReceiptId: Number(req.params.id), documentId: doc.id });
    res.status(201).json(doc);
  } catch (err) {
    if (sendHttpError(res, err)) return;
    logger.error({ err }, 'Errore PUT /api/goods-receipts/:id/documents');
    res.status(500).json({ error: 'Errore salvataggio allegato' });
  }
});

// Apre un allegato: foto o PDF, sempre come file (mai come pagina), con una politica di sicurezza che non lascia eseguire nulla.
router.get('/:id/documents/:documentId', ...guard, validate({ params: receiptDocumentParamsSchema }), tenantScope, maskReserved, async (req, res) => {
  try {
    const { rows: [doc] } = await req.db.query('SELECT file_name, content_type, data FROM stored_documents WHERE id = $1 AND goods_receipt_id = $2', [req.params.documentId, req.params.id]);
    if (!doc) throw new HttpError(404, 'Allegato non trovato');
    res.set({
      'Content-Type': doc.content_type,
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(doc.file_name)}`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; img-src 'self'; object-src 'self'; frame-ancestors 'self'",
      'Cache-Control': 'private, no-store',
    });
    res.send(doc.data);
  } catch (err) {
    if (sendHttpError(res, err)) return;
    logger.error({ err }, 'Errore GET /api/goods-receipts/:id/documents/:documentId');
    res.status(500).json({ error: 'Errore apertura allegato' });
  }
});

router.delete('/:id/documents/:documentId', ...guard, validate({ params: receiptDocumentParamsSchema }), tenantScope, maskReserved, async (req, res) => {
  try {
    const { rowCount } = await req.db.query('DELETE FROM stored_documents WHERE id = $1 AND goods_receipt_id = $2', [req.params.documentId, req.params.id]);
    if (!rowCount) throw new HttpError(404, 'Allegato non trovato');
    await logAudit(req.db, req.user.id, 'DELETE_RECEIPT_DOCUMENT', { goodsReceiptId: Number(req.params.id), documentId: Number(req.params.documentId) });
    res.json({ success: true });
  } catch (err) {
    if (sendHttpError(res, err)) return;
    logger.error({ err }, 'Errore DELETE /api/goods-receipts/:id/documents/:documentId');
    res.status(500).json({ error: 'Errore eliminazione allegato' });
  }
});

export default router;
