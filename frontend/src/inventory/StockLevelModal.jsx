import { useMemo, useState } from 'react';
import Modal from '../components/shared/Modal';
import Segmented from '../smarteats/floor/Segmented';
import SearchField from '../components/shared/SearchField';
import IngredientEntryList from './IngredientEntryList';
import { btn, btnPrimary, input, label } from '../smarteats/floor/ui';
import { fetchWithAuth } from '../utils/apiClient';
import { useToast } from '../context/useToast';
import { stockLevelPayload, countDifference, differenceText, blankEntry } from './controls';
import { formatQuantity } from './units';

const KINDS = [{ id: 'closing', label: 'Fine servizio' }, { id: 'periodic', label: 'Periodico' }];

// Un controllo di magazzino: si conta ciò che c'è davvero e si scrive solo per gli ingredienti contati. Al salvataggio la dispensa
// si allinea al conteggio e ogni differenza resta nel registro (manca = scarto non registrato, avanza = carico mancato).
const StockLevelModal = ({ ingredients, onClose, onSaved }) => {
  const { showToast } = useToast();
  const [kind, setKind] = useState('closing');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [entries, setEntries] = useState({});
  const [busy, setBusy] = useState(false);
  const active = useMemo(() => ingredients.filter(i => i.active), [ingredients]);
  const shown = active.filter(i => i.name.toLowerCase().includes(search.trim().toLowerCase()));
  const payload = stockLevelPayload(kind, notes, active, entries);

  const save = async () => {
    setBusy(true);
    try {
      const res = await fetchWithAuth('/stock-levels', { method: 'POST', body: payload });
      showToast(res.differences ? `Controllo registrato: ${res.differences} ${res.differences === 1 ? 'differenza' : 'differenze'}` : 'Controllo registrato: tutto torna', 'success');
      await onSaved();
      onClose();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setBusy(false); }
  };

  const note = (i, entry) => {
    const difference = countDifference(entry, i.quantity_on_hand);
    return difference === null ? `In dispensa ${formatQuantity(i.quantity_on_hand, i.base_unit)}` : differenceText(difference, i.base_unit);
  };

  return (
    <Modal title="Nuovo controllo di magazzino" size="max-w-3xl" dismissOnBackdrop={false} onClose={onClose} onSubmit={(e) => { e.preventDefault(); if (payload.lines.length) save(); }}
      footer={(
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-[var(--text-muted)] mr-auto">{payload.lines.length === 0 ? 'Scrivi la quantità degli ingredienti che hai contato.' : `${payload.lines.length} contati`}</p>
          <button type="button" className={btn} onClick={onClose}>Annulla</button>
          <button type="submit" className={btnPrimary} disabled={busy || payload.lines.length === 0}>{busy ? 'Salvataggio…' : 'Registra il controllo'}</button>
        </div>)}>
      <div className="space-y-4">
        <Segmented label="Tipo di controllo" className="w-72" value={kind} onChange={setKind} options={KINDS} />
        <SearchField value={search} onChange={setSearch} placeholder="Cerca un ingrediente" />
        {active.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nessun ingrediente da contare.</p>}
        <IngredientEntryList ingredients={shown} entries={entries} note={note}
          onChange={(id, value) => setEntries(all => ({ ...all, [id]: { ...(all[id] ?? blankEntry(ingredients.find(i => i.id === id))), ...value } }))} />
        <label className="block"><span className={`${label} block mb-1`}>Note</span>
          <input className={input} aria-label="Note" maxLength={500} placeholder="Facoltative" value={notes} onChange={e => setNotes(e.target.value)} /></label>
      </div>
    </Modal>
  );
};

export default StockLevelModal;
