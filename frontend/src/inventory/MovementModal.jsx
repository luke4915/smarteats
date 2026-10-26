import { useState } from 'react';
import Modal from '../components/shared/Modal';
import Segmented from '../smarteats/floor/Segmented';
import QuantityInput from './QuantityInput';
import { btn, btnPrimary, input, label } from '../smarteats/floor/ui';
import { fetchWithAuth } from '../utils/apiClient';
import { useToast } from '../context/useToast';
import { WASTE_REASONS, blankEntry, movementProblem, movementPayload } from './controls';

const DIRECTIONS = [{ id: 'remove', label: 'Togli' }, { id: 'add', label: 'Aggiungi' }];

// Uno scarto (merce buttata, scaduta, mangiata dal personale…) o una rettifica (correzione a mano, sempre con il motivo).
// `type` decide quale: lo scarto toglie sempre dalla dispensa, la rettifica può anche aggiungere.
const MovementModal = ({ type, ingredients, onClose, onSaved }) => {
  const { showToast } = useToast();
  const [form, setForm] = useState({ type, ingredient_id: '', text: '', unit: 'g', reason: 'expired', note: '', direction: 'remove' });
  const [busy, setBusy] = useState(false);
  const ingredient = ingredients.find(i => i.id === Number(form.ingredient_id));
  const problem = movementProblem(form);
  const patch = (changes) => setForm(f => ({ ...f, ...changes }));

  const save = async () => {
    setBusy(true);
    try {
      await fetchWithAuth('/inventory/movements', { method: 'POST', body: movementPayload(form) });
      showToast(type === 'waste' ? 'Scarto registrato' : 'Rettifica registrata', 'success');
      await onSaved();
      onClose();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setBusy(false); }
  };

  return (
    <Modal title={type === 'waste' ? 'Registra uno scarto' : 'Registra una rettifica'} size="max-w-lg" dismissOnBackdrop={false} onClose={onClose} onSubmit={(e) => { e.preventDefault(); if (!problem) save(); }}
      footer={(
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-[var(--text-muted)] mr-auto">{problem}</p>
          <button type="button" className={btn} onClick={onClose}>Annulla</button>
          <button type="submit" className={btnPrimary} disabled={busy || !!problem}>{busy ? 'Salvataggio…' : 'Registra'}</button>
        </div>)}>
      <div className="space-y-4">
        <label className="block"><span className={`${label} block mb-1`}>Ingrediente</span>
          <select className={input} aria-label="Ingrediente" value={form.ingredient_id}
            onChange={e => { const next = ingredients.find(i => i.id === Number(e.target.value)); patch({ ingredient_id: e.target.value, ...(next && { unit: blankEntry(next).unit }) }); }}>
            <option value="">Scegli…</option>
            {ingredients.filter(i => i.active).map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select></label>
        {type === 'adjustment' && <Segmented label="Aggiungi o togli" className="w-48" value={form.direction} onChange={direction => patch({ direction })} options={DIRECTIONS} />}
        <div><span className={`${label} block mb-1`}>Quantità</span>
          <QuantityInput label="Quantità" baseUnit={ingredient?.base_unit ?? 'g'} text={form.text} unit={form.unit} onChange={v => patch(v)} /></div>
        {type === 'waste' && (
          <label className="block"><span className={`${label} block mb-1`}>Motivo</span>
            <select className={input} aria-label="Motivo" value={form.reason} onChange={e => patch({ reason: e.target.value })}>
              {WASTE_REASONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select></label>)}
        <label className="block"><span className={`${label} block mb-1`}>{type === 'waste' ? 'Nota' : 'Perché correggi'}</span>
          <input className={input} aria-label={type === 'waste' ? 'Nota' : 'Perché correggi'} maxLength={300} placeholder={type === 'waste' ? 'Facoltativa' : 'Es. errore nel carico'} value={form.note} onChange={e => patch({ note: e.target.value })} /></label>
      </div>
    </Modal>
  );
};

export default MovementModal;
