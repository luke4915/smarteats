import { useState } from 'react';
import { Plus } from 'lucide-react';
import Modal from '../components/shared/Modal';
import ModalActions from '../components/shared/ModalActions';
import Switch from '../components/shared/Switch';
import ReceiptLineRow from './ReceiptLineRow';
import { btn, btnPrimary, btnDanger, input, label } from '../smarteats/floor/ui';
import { fetchWithAuth } from '../utils/apiClient';
import { useToast } from '../context/useToast';
import { blankReceiptRow, rowFromPriceItem, priceListProblem, priceListPayload } from './receipt';

const Field = ({ title, children }) => <label className="block"><span className={`${label} block mb-1`}>{title}</span>{children}</label>;

// Un fornitore: i suoi dati e il listino di ciò che vende (confezione e prezzo di ogni ingrediente). Il listino si aggiorna anche
// da solo a ogni carico registrato.
const SupplierModal = ({ supplier, ingredients, onClose, onSaved }) => {
  const { showToast } = useToast();
  const editing = !!supplier;
  const [form, setForm] = useState({ name: supplier?.name ?? '', phone: supplier?.phone ?? '', email: supplier?.email ?? '', vat_number: supplier?.vat_number ?? '', notes: supplier?.notes ?? '', active: supplier?.active ?? true });
  const [rows, setRows] = useState(() => (supplier?.items ?? []).map(item => rowFromPriceItem(item, ingredients)));
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const patch = (changes) => setForm(f => ({ ...f, ...changes }));
  const problem = !form.name.trim() ? 'Scrivi il nome del fornitore' : priceListProblem(rows);

  const run = async (action, done) => {
    setBusy(true);
    try { await action(); showToast(done, 'success'); await onSaved(); onClose(); }
    catch (err) { showToast(err.message, 'error'); }
    finally { setBusy(false); }
  };
  const save = () => run(async () => {
    const body = { name: form.name.trim(), phone: form.phone.trim() || null, email: form.email.trim() || null, vat_number: form.vat_number.trim() || null, notes: form.notes.trim() || null, active: form.active };
    const saved = await fetchWithAuth(editing ? `/suppliers/${supplier.id}` : '/suppliers', { method: editing ? 'PUT' : 'POST', body });
    await fetchWithAuth(`/suppliers/${saved.id}/price-list`, { method: 'PUT', body: priceListPayload(rows, ingredients) });
  }, 'Fornitore salvato');
  const remove = () => run(() => fetchWithAuth(`/suppliers/${supplier.id}`, { method: 'DELETE' }), 'Fornitore eliminato');

  return (
    <Modal title={editing ? 'Modifica fornitore' : 'Nuovo fornitore'} size="max-w-4xl" dismissOnBackdrop={false} onClose={onClose} onSubmit={(e) => { e.preventDefault(); if (!problem) save(); }}
      footer={(
        <ModalActions onCancel={onClose}
          start={editing && <button type="button" className={btnDanger} disabled={busy} onClick={() => (confirmingDelete ? remove() : setConfirmingDelete(true))}>{confirmingDelete ? 'Sì, elimina' : 'Elimina'}</button>}>
          <button type="submit" className={btnPrimary} disabled={busy || !!problem} title={problem ?? undefined}>Salva</button>
        </ModalActions>)}>
      <div className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field title="Nome"><input className={input} autoFocus maxLength={80} value={form.name} onChange={e => patch({ name: e.target.value })} placeholder="Es. Rossi Alimentari" /></Field>
          <Field title="Partita IVA"><input className={input} maxLength={30} value={form.vat_number} onChange={e => patch({ vat_number: e.target.value })} /></Field>
          <Field title="Telefono"><input className={input} inputMode="tel" maxLength={30} value={form.phone} onChange={e => patch({ phone: e.target.value })} /></Field>
          <Field title="Email"><input className={input} type="email" maxLength={120} value={form.email} onChange={e => patch({ email: e.target.value })} /></Field>
        </div>
        <Field title="Note"><input className={input} maxLength={500} value={form.notes} onChange={e => patch({ notes: e.target.value })} placeholder="Giorni di consegna, referente…" /></Field>
        {editing && <div className="flex items-center justify-between gap-3"><span className="text-sm text-[var(--text-main)]">Attivo</span><Switch label="Fornitore attivo" checked={form.active} onChange={active => patch({ active })} /></div>}

        <div className="space-y-2">
          <div><span className={`${label} block`}>Cosa vende</span><p className="text-sm text-[var(--text-muted)]">Confezione e prezzo di ogni ingrediente: nei carichi si compila da solo.</p></div>
          {rows.map(row => (
            <ReceiptLineRow key={row.key} row={row} ingredients={ingredients} showQuantity={false}
              onChange={next => setRows(list => list.map(r => (r.key === row.key ? next : r)))} onRemove={() => setRows(list => list.filter(r => r.key !== row.key))} />))}
          <button type="button" className={btn} onClick={() => setRows(list => [...list, blankReceiptRow()])}><Plus size={16} /> Aggiungi un ingrediente</button>
        </div>
      </div>
    </Modal>
  );
};

export default SupplierModal;
