import { useEffect, useState, useCallback } from 'react';
import { Paperclip, Plus } from 'lucide-react';
import ReceiptModal from './ReceiptModal';
import ReceiptDetailModal from './ReceiptDetailModal';
import { btnPrimary, row } from '../smarteats/floor/ui';
import { fetchWithAuth } from '../utils/apiClient';
import { useToast } from '../context/useToast';
import { centsToEuroText } from './receipt';

// I carichi di merce, dal più recente: chi, quando, quanto. Un tocco apre il dettaglio con righe e bolla allegata.
const ReceiptsPanel = ({ suppliers, ingredients, onChanged }) => {
  const { showToast } = useToast();
  const [receipts, setReceipts] = useState(null);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState(null);
  const load = useCallback(() => fetchWithAuth('/goods-receipts').then(setReceipts).catch(err => showToast(err.message, 'error')), [showToast]);
  useEffect(() => { load(); }, [load]);
  const changed = async () => { await load(); await onChanged(); };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--text-muted)]">Ogni arrivo di merce: la dispensa sale e il costo di ogni ingrediente si aggiorna.</p>
        <button className={btnPrimary} onClick={() => setCreating(true)} disabled={suppliers.length === 0} title={suppliers.length === 0 ? 'Aggiungi prima un fornitore' : undefined}><Plus size={16} /> Nuovo carico</button>
      </div>
      {suppliers.length === 0 && <p className="text-sm text-[var(--text-muted)]">Per registrare un carico serve almeno un fornitore: aggiungilo dalla scheda «Fornitori».</p>}
      {receipts === null && <p className="text-sm text-[var(--text-muted)]">Caricamento…</p>}
      {receipts?.length === 0 && suppliers.length > 0 && <p className="py-10 text-center text-sm text-[var(--text-muted)]">Nessun carico. Registra il primo quando arriva la merce.</p>}
      <ul className="space-y-1.5">
        {(receipts ?? []).map(r => (
          <li key={r.id}>
            <button className={`${row} w-full flex items-center gap-3 text-left cursor-pointer hover:border-[var(--border-hover)]`} onClick={() => setViewing(r.id)}>
              <span className="tabular-nums text-sm text-[var(--text-muted)] w-24 shrink-0">{r.received_on.split('-').reverse().join('/')}</span>
              <span className="min-w-0 flex-1"><span className="block truncate font-medium text-[var(--text-main)]">{r.supplier_name}</span>
                <span className="block text-xs text-[var(--text-muted)]">{r.lines} {r.lines === 1 ? 'riga' : 'righe'}{r.document_number ? ` · bolla ${r.document_number}` : ''}</span></span>
              {r.documents > 0 && <Paperclip size={15} className="text-[var(--text-muted)] shrink-0" aria-label="Con bolla allegata" />}
              <span className="tabular-nums text-[var(--text-main)] w-24 text-right">{centsToEuroText(r.total_cost_cents)} €</span>
            </button>
          </li>))}
      </ul>
      {creating && <ReceiptModal suppliers={suppliers} ingredients={ingredients} onClose={() => setCreating(false)} onSaved={changed} />}
      {viewing && <ReceiptDetailModal receiptId={viewing} onClose={() => setViewing(null)} onChanged={load} />}
    </section>
  );
};

export default ReceiptsPanel;
