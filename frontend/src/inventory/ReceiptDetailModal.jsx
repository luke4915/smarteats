import { useEffect, useState } from 'react';
import { FileText, Trash2 } from 'lucide-react';
import Modal from '../components/shared/Modal';
import DocumentPicker from './DocumentPicker';
import { btn, btnPrimary, iconBtn, row } from '../smarteats/floor/ui';
import { fetchWithAuth } from '../utils/apiClient';
import { useToast } from '../context/useToast';
import { formatQuantity } from './units';
import { centsToEuroText, vatOfLines } from './receipt';
import { uploadReceiptDocuments, documentUrl } from './receiptDocuments';

// Un carico già registrato: righe, totali e allegati. Il carico non si modifica (lo storico dei movimenti non si corregge);
// si possono aggiungere o togliere le foto della bolla.
const ReceiptDetailModal = ({ receiptId, onClose, onChanged }) => {
  const { showToast } = useToast();
  const [receipt, setReceipt] = useState(null);
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const load = () => fetchWithAuth(`/goods-receipts/${receiptId}`).then(setReceipt).catch(err => { showToast(err.message, 'error'); onClose(); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [receiptId]);

  const vat = receipt ? vatOfLines(receipt.lines) : 0;
  const attach = async () => {
    setBusy(true);
    const failed = await uploadReceiptDocuments(receiptId, files);
    if (failed.length) showToast('Qualche allegato non è stato caricato', 'error');
    setFiles([]); setBusy(false);
    await load(); onChanged();
  };
  const removeDocument = async (id) => {
    try { await fetchWithAuth(`/goods-receipts/${receiptId}/documents/${id}`, { method: 'DELETE' }); await load(); onChanged(); }
    catch (err) { showToast(err.message, 'error'); }
  };

  return (
    <Modal title={receipt ? `Carico del ${receipt.received_on.split('-').reverse().join('/')} · ${receipt.supplier_name}` : 'Carico'} size="max-w-3xl" onClose={onClose}
      footer={<div className="flex justify-end"><button type="button" className={btn} onClick={onClose}>Chiudi</button></div>}>
      {!receipt ? <p className="text-sm text-[var(--text-muted)]">Caricamento…</p> : (
        <div className="space-y-5">
          {(receipt.document_number || receipt.notes) && <p className="text-sm text-[var(--text-muted)]">{[receipt.document_number && `Bolla ${receipt.document_number}`, receipt.notes].filter(Boolean).join(' · ')}</p>}
          <ul className="space-y-1.5">
            {receipt.lines.map((l, i) => (
              <li key={i} className={`${row} flex flex-wrap items-center gap-x-3 gap-y-1`}>
                <span className="font-medium text-[var(--text-main)] flex-1 min-w-40">{l.ingredient_name}</span>
                <span className="text-sm text-[var(--text-muted)] tabular-nums">{l.quantity} × {l.purchase_unit_name} = {formatQuantity(l.base_quantity, l.base_unit)}</span>
                <span className="text-sm tabular-nums text-[var(--text-main)] w-24 text-right">{centsToEuroText(l.line_cost_cents)} €</span>
                {l.vat_rate !== null && <span className="text-xs text-[var(--text-muted)]">IVA {l.vat_rate}%</span>}
              </li>))}
          </ul>
          <p className="text-sm text-[var(--text-muted)] tabular-nums text-right">
            Senza IVA <b className="text-[var(--text-main)]">{centsToEuroText(receipt.total_cost_cents)} €</b> · IVA {centsToEuroText(vat)} € · Totale <b className="text-[var(--text-main)]">{centsToEuroText(receipt.total_cost_cents + vat)} €</b>
          </p>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-[var(--text-main)]">Bolla allegata</h3>
            {receipt.documents.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nessun allegato.</p>}
            <ul className="space-y-1">
              {receipt.documents.map(d => (
                <li key={d.id} className="flex items-center gap-2 text-sm">
                  <FileText size={15} className="text-[var(--text-muted)]" />
                  <a href={documentUrl(receiptId, d.id)} target="_blank" rel="noreferrer" className="text-[var(--accent)] hover:underline truncate flex-1">{d.file_name}</a>
                  <button type="button" className={`${iconBtn} hover:!text-red-500`} aria-label={`Elimina ${d.file_name}`} onClick={() => removeDocument(d.id)}><Trash2 size={15} /></button>
                </li>))}
            </ul>
            <DocumentPicker files={files} onChange={setFiles} />
            {files.length > 0 && <button type="button" className={btnPrimary} disabled={busy} onClick={attach}>Allega</button>}
          </div>
        </div>)}
    </Modal>
  );
};

export default ReceiptDetailModal;
