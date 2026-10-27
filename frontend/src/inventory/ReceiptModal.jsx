import { useState } from 'react';
import { Plus } from 'lucide-react';
import Modal from '../components/shared/Modal';
import ModalActions from '../components/shared/ModalActions';
import ReceiptLineRow from './ReceiptLineRow';
import DocumentPicker from './DocumentPicker';
import { btn, btnPrimary, input, label } from '../smarteats/floor/ui';
import { fetchWithAuth } from '../utils/apiClient';
import { useToast } from '../context/useToast';
import { blankReceiptRow, summarize, receiptProblem, receiptPayload, rowsForSupplier, arrivedRows, todayText, centsToEuroText } from './receipt';
import { uploadReceiptDocuments } from './receiptDocuments';

// Uno scarico di merce nuovo (la «bolla»): fornitore, data, righe con confezione e prezzo, e la foto o il file della bolla.
// Al salvataggio la dispensa sale e il costo medio degli ingredienti si aggiorna.
const ReceiptModal = ({ suppliers, ingredients, onClose, onSaved }) => {
  const { showToast } = useToast();
  const [form, setForm] = useState({ supplier_id: '', received_on: todayText(), document_number: '', notes: '' });
  const [rows, setRows] = useState([blankReceiptRow()]);
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const supplier = suppliers.find(s => s.id === Number(form.supplier_id));
  const totals = summarize(rows);
  const problem = receiptProblem(form, rows);
  const patch = (changes) => setForm(f => ({ ...f, ...changes }));
  // Scelto il fornitore, lo scarico si riempie con i suoi prodotti: basta scrivere quanti ne sono arrivati
  const chooseSupplier = (id) => {
    patch({ supplier_id: id });
    setRows(current => rowsForSupplier(current, suppliers.find(s => s.id === Number(id)), ingredients));
  };

  const save = async () => {
    setBusy(true);
    try {
      const { id } = await fetchWithAuth('/goods-receipts', { method: 'POST', body: receiptPayload(form, rows, ingredients) });
      const failed = await uploadReceiptDocuments(id, files);
      showToast(failed.length ? `Scarico registrato, ma ${failed.length} allegat${failed.length === 1 ? 'o' : 'i'} non caricat${failed.length === 1 ? 'o' : 'i'}` : 'Scarico registrato', failed.length ? 'info' : 'success');
      await onSaved();
      onClose();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setBusy(false); }
  };

  return (
    <Modal title="Nuovo scarico di merce" size="max-w-4xl" dismissOnBackdrop={false} onClose={onClose} onSubmit={(e) => { e.preventDefault(); if (!problem) save(); }}
      footer={(
        <ModalActions onCancel={onClose} note={(
          <span className="tabular-nums">
            {arrivedRows(rows).length} {arrivedRows(rows).length === 1 ? 'prodotto' : 'prodotti'} · 
            Senza IVA <b className="text-[var(--text-main)]">{centsToEuroText(totals.netCents)} €</b> · IVA {centsToEuroText(totals.vatCents)} € · Totale <b className="text-[var(--text-main)]">{centsToEuroText(totals.grossCents)} €</b>
          </span>)}>
          <button type="submit" className={btnPrimary} disabled={busy || !!problem} title={problem ?? undefined}>{busy ? 'Salvataggio…' : 'Registra lo scarico'}</button>
        </ModalActions>)}>
      <div className="space-y-5">
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="block"><span className={`${label} block mb-1`}>Fornitore</span>
            <select className={input} aria-label="Fornitore" value={form.supplier_id} onChange={e => chooseSupplier(e.target.value)}>
              <option value="">Scegli…</option>
              {suppliers.filter(s => s.active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select></label>
          <label className="block"><span className={`${label} block mb-1`}>Data di arrivo</span>
            <input type="date" className={input} aria-label="Data di arrivo" value={form.received_on} onChange={e => patch({ received_on: e.target.value })} /></label>
          <label className="block"><span className={`${label} block mb-1`}>Numero della bolla</span>
            <input className={input} aria-label="Numero della bolla" maxLength={40} placeholder="Facoltativo" value={form.document_number} onChange={e => patch({ document_number: e.target.value })} /></label>
        </div>

        <div className="space-y-2">
          <span className={`${label} block`}>Cosa è arrivato</span>
          {supplier?.items.length > 0 && <p className="text-sm text-[var(--text-muted)]">Scrivi la quantità di ciò che è arrivato: i prodotti senza quantità si ignorano. Confezione e prezzo sono quelli dell'ultimo scarico.</p>}
          {rows.map(row => (
            <ReceiptLineRow key={row.key} row={row} ingredients={ingredients} supplierItems={supplier?.items ?? []}
              onChange={next => setRows(list => list.map(r => (r.key === row.key ? next : r)))} onRemove={() => setRows(list => list.filter(r => r.key !== row.key))} />))}
          <button type="button" className={btn} onClick={() => setRows(list => [...list, blankReceiptRow()])}><Plus size={16} /> Aggiungi una riga</button>
        </div>

        <div className="space-y-2">
          <span className={`${label} block`}>Foto o file della bolla</span>
          <DocumentPicker files={files} onChange={setFiles} />
        </div>
        <label className="block"><span className={`${label} block mb-1`}>Note</span>
          <input className={input} aria-label="Note" maxLength={500} placeholder="Facoltative" value={form.notes} onChange={e => patch({ notes: e.target.value })} /></label>
      </div>
    </Modal>
  );
};

export default ReceiptModal;
