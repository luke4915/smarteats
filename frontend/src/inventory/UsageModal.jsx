import { useState } from 'react';
import Modal from '../components/shared/Modal';
import ModalActions from '../components/shared/ModalActions';
import Segmented from '../smarteats/floor/Segmented';
import IngredientEntryList from './IngredientEntryList';
import { btnPrimary } from '../smarteats/floor/ui';
import { fetchWithAuth } from '../utils/apiClient';
import { useToast } from '../context/useToast';
import { usagePayload, blankEntry } from './controls';
import { formatQuantity } from './units';

const MODES = [{ id: 'used', label: 'Quanto ho usato' }, { id: 'remaining', label: 'Quanto è rimasto' }];

// Il consumo di fine servizio, per i locali senza ricette: a ogni ingrediente si scrive quanto è stato usato, oppure quanto è rimasto
// (il server calcola l'usato). Le righe vuote si saltano.
const UsageModal = ({ ingredients, onClose, onSaved }) => {
  const { showToast } = useToast();
  const [mode, setMode] = useState('used');
  const [entries, setEntries] = useState({});
  const [busy, setBusy] = useState(false);
  const active = ingredients.filter(i => i.active);
  const payload = usagePayload(mode, active, entries);

  const save = async () => {
    setBusy(true);
    try {
      await fetchWithAuth('/inventory/usage', { method: 'POST', body: payload });
      showToast('Consumo registrato', 'success');
      await onSaved();
      onClose();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setBusy(false); }
  };

  return (
    <Modal title="Consumo di fine servizio" size="max-w-3xl" dismissOnBackdrop={false} onClose={onClose} onSubmit={(e) => { e.preventDefault(); if (payload.lines.length) save(); }}
      footer={(
        <ModalActions onCancel={onClose} note={payload.lines.length === 0 ? 'Scrivi una quantità per almeno un ingrediente.' : `${payload.lines.length} ingredienti`}>
          <button type="submit" className={btnPrimary} disabled={busy || payload.lines.length === 0}>{busy ? 'Salvataggio…' : 'Registra il consumo'}</button>
        </ModalActions>)}>
      <div className="space-y-4">
        <Segmented label="Come scrivi il consumo" className="w-full sm:w-96" value={mode} onChange={setMode} options={MODES} />
        <IngredientEntryList ingredients={active} entries={entries} note={i => `In dispensa ${formatQuantity(i.quantity_on_hand, i.base_unit)}`}
          onChange={(id, value) => setEntries(all => ({ ...all, [id]: { ...(all[id] ?? blankEntry(ingredients.find(i => i.id === id))), ...value } }))} />
      </div>
    </Modal>
  );
};

export default UsageModal;
