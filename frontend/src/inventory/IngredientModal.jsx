import { useState } from 'react';
import Modal from '../components/shared/Modal';
import ModalActions from '../components/shared/ModalActions';
import Switch from '../components/shared/Switch';
import Segmented from '../smarteats/floor/Segmented';
import QuantityInput from './QuantityInput';
import IngredientHistory from './IngredientHistory';
import { btnPrimary, btnDanger, input, label } from '../smarteats/floor/ui';
import { fetchWithAuth } from '../utils/apiClient';
import { useToast } from '../context/useToast';
import { BASE_UNITS, parseDecimal, toBaseQuantity, toDisplayQuantity } from './units';

// Un ingrediente nuovo o da modificare: nome, unità di base, resa (facoltativa) e scorta minima (facoltativa). Se esiste già, in fondo
// ci sono scarto e correzione della quantità (`onMovement`) e gli ultimi movimenti.
const IngredientModal = ({ ingredient, onClose, onSaved, onMovement }) => {
  const { showToast } = useToast();
  const editing = !!ingredient;
  const shown = ingredient?.reorder_level != null ? toDisplayQuantity(ingredient.reorder_level, ingredient.base_unit) : { value: '', unit: ingredient?.base_unit ?? 'g' };
  const [form, setForm] = useState({
    name: ingredient?.name ?? '', base_unit: ingredient?.base_unit ?? 'g', yield_percent: String(ingredient?.yield_percent ?? 100), active: ingredient?.active ?? true,
    reorder_text: String(shown.value).replace('.', ','), reorder_unit: shown.unit,
  });
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const patch = (changes) => setForm(f => ({ ...f, ...changes }));

  const yieldPercent = parseDecimal(form.yield_percent);
  const reorder = form.reorder_text.trim() === '' ? null : parseDecimal(form.reorder_text);
  const problem = !form.name.trim() ? 'Scrivi il nome' : yieldPercent === null || yieldPercent <= 0 || yieldPercent > 100 ? 'La resa va da 1 a 100' : reorder !== null && reorder < 0 ? 'La scorta minima non può essere negativa' : null;

  const run = async (action, done) => {
    setBusy(true);
    try { await action(); showToast(done, 'success'); await onSaved(); onClose(); }
    catch (err) { showToast(err.message, 'error'); }
    finally { setBusy(false); }
  };
  const save = () => run(() => fetchWithAuth(editing ? `/ingredients/${ingredient.id}` : '/ingredients', {
    method: editing ? 'PUT' : 'POST',
    body: { name: form.name.trim(), base_unit: form.base_unit, yield_percent: yieldPercent, active: form.active, reorder_level: reorder === null ? null : toBaseQuantity(reorder, form.reorder_unit) },
  }), 'Ingrediente salvato');
  const remove = () => run(() => fetchWithAuth(`/ingredients/${ingredient.id}`, { method: 'DELETE' }), 'Ingrediente eliminato');

  return (
    <Modal title={editing ? 'Modifica ingrediente' : 'Nuovo ingrediente'} onClose={onClose} onSubmit={(e) => { e.preventDefault(); if (!problem) save(); }}
      footer={(
        <ModalActions onCancel={onClose}
          start={editing && <button type="button" className={btnDanger} disabled={busy} onClick={() => (confirmingDelete ? remove() : setConfirmingDelete(true))}>{confirmingDelete ? 'Sì, elimina' : 'Elimina'}</button>}>
          <button type="submit" className={btnPrimary} disabled={busy || !!problem} title={problem ?? undefined}>Salva</button>
        </ModalActions>)}>
      <div className="space-y-4">
        <label className="block"><span className={`${label} block mb-1`}>Nome</span>
          <input className={input} autoFocus maxLength={60} value={form.name} onChange={e => patch({ name: e.target.value })} placeholder="Es. Farina 00" /></label>
        <div><span className={`${label} block mb-1`}>Si misura in</span>
          <Segmented label="Unità di base" value={form.base_unit} onChange={base_unit => patch({ base_unit, reorder_unit: base_unit })}
            options={Object.entries(BASE_UNITS).map(([id, text]) => ({ id, label: text }))} />
          {editing && <p className="text-xs text-[var(--text-muted)] mt-1">Con dei movimenti già scritti l&apos;unità non si può cambiare.</p>}</div>
        <label className="block"><span className={`${label} block mb-1`}>Resa (%)</span>
          <input className={`${input} tabular-nums`} inputMode="decimal" value={form.yield_percent} onChange={e => patch({ yield_percent: e.target.value })} />
          <span className="text-xs text-[var(--text-muted)] mt-1 block">Quanta parte è utilizzabile: 1 kg di carne che dà 800 g puliti ha resa 80. Lascia 100 se non c&apos;è scarto.</span></label>
        <div><span className={`${label} block mb-1`}>Scorta minima (facoltativa)</span>
          <QuantityInput baseUnit={form.base_unit} label="Scorta minima" text={form.reorder_text} unit={form.reorder_unit} onChange={({ text, unit }) => patch({ reorder_text: text, reorder_unit: unit })} />
          <span className="text-xs text-[var(--text-muted)] mt-1 block">Sotto questa quantità l&apos;ingrediente risulta da riordinare.</span></div>
        {editing && (
          <div className="flex items-center justify-between gap-3"><span className="text-sm text-[var(--text-main)]">Attivo</span>
            <Switch label="Ingrediente attivo" checked={form.active} onChange={active => patch({ active })} /></div>)}
        {editing && onMovement && <IngredientHistory ingredient={ingredient} onMovement={onMovement} />}
      </div>
    </Modal>
  );
};

export default IngredientModal;
