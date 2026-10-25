import { useState } from 'react';
import Modal from '../components/shared/Modal';
import Segmented from '../smarteats/floor/Segmented';
import QuantityInput from './QuantityInput';
import RecipeLinesEditor from './RecipeLinesEditor';
import { btn, btnPrimary, btnDanger, input, label } from '../smarteats/floor/ui';
import { fetchWithAuth } from '../utils/apiClient';
import { useToast } from '../context/useToast';
import { BASE_UNITS, parseDecimal, toBaseQuantity, toDisplayQuantity } from './units';
import { rowsFromLines, recipeProblem, linesFromRows } from './recipeLines';

// Una preparazione (il sugo base): cosa contiene e quanto se ne ottiene. I piatti la usano come un ingrediente.
const PreparationModal = ({ preparation, ingredients, preparations, onClose, onSaved }) => {
  const { showToast } = useToast();
  const editing = !!preparation;
  const output = toDisplayQuantity(preparation?.output_quantity ?? 0, preparation?.base_unit ?? 'g');
  const others = preparations.filter(p => p.id !== preparation?.id);
  const [form, setForm] = useState({ name: preparation?.name ?? '', base_unit: preparation?.base_unit ?? 'g', out_text: preparation ? String(output.value).replace('.', ',') : '', out_unit: output.unit });
  const [rows, setRows] = useState(() => rowsFromLines(preparation?.lines ?? [], ingredients, preparations));
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const patch = (changes) => setForm(f => ({ ...f, ...changes }));

  const outputQuantity = parseDecimal(form.out_text);
  const problem = !form.name.trim() ? 'Scrivi il nome' : !outputQuantity || outputQuantity <= 0 ? 'Scrivi quanto se ne ottiene' : !rows.length ? 'Serve almeno un ingrediente' : recipeProblem(rows, ingredients, preparations);

  const run = async (action, done) => {
    setBusy(true);
    try { await action(); showToast(done, 'success'); await onSaved(); onClose(); }
    catch (err) { showToast(err.message, 'error'); }
    finally { setBusy(false); }
  };
  const save = () => run(() => fetchWithAuth(editing ? `/preparations/${preparation.id}` : '/preparations', {
    method: editing ? 'PUT' : 'POST',
    body: { name: form.name.trim(), base_unit: form.base_unit, output_quantity: toBaseQuantity(outputQuantity, form.out_unit), active: true, lines: linesFromRows(rows) },
  }), 'Preparazione salvata');
  const remove = () => run(() => fetchWithAuth(`/preparations/${preparation.id}`, { method: 'DELETE' }), 'Preparazione eliminata');

  return (
    <Modal title={editing ? 'Modifica preparazione' : 'Nuova preparazione'} size="max-w-2xl" dismissOnBackdrop={false} onClose={onClose} onSubmit={(e) => { e.preventDefault(); if (!problem) save(); }}
      footer={(
        <div className="flex gap-2">
          {editing && <button type="button" className={btnDanger} disabled={busy} onClick={() => (confirmingDelete ? remove() : setConfirmingDelete(true))}>{confirmingDelete ? 'Sì, elimina' : 'Elimina'}</button>}
          <button type="button" className={`${btn} ml-auto`} onClick={onClose}>Annulla</button>
          <button type="submit" className={btnPrimary} disabled={busy || !!problem} title={problem ?? undefined}>Salva</button>
        </div>)}>
      <div className="space-y-4">
        <label className="block"><span className={`${label} block mb-1`}>Nome</span>
          <input className={input} autoFocus maxLength={60} value={form.name} onChange={e => patch({ name: e.target.value })} placeholder="Es. Sugo base" /></label>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><span className={`${label} block mb-1`}>Si misura in</span>
            <Segmented label="Unità di base" value={form.base_unit} onChange={base_unit => patch({ base_unit, out_unit: base_unit })} options={Object.entries(BASE_UNITS).map(([id, text]) => ({ id, label: text }))} /></div>
          <div><span className={`${label} block mb-1`}>Quanto se ne ottiene</span>
            <QuantityInput baseUnit={form.base_unit} label="Quantità ottenuta" text={form.out_text} unit={form.out_unit} onChange={({ text, unit }) => patch({ out_text: text, out_unit: unit })} /></div>
        </div>
        <div><span className={`${label} block mb-2`}>Ingredienti usati</span>
          <RecipeLinesEditor rows={rows} onChange={setRows} ingredients={ingredients} preparations={others} /></div>
      </div>
    </Modal>
  );
};

export default PreparationModal;
