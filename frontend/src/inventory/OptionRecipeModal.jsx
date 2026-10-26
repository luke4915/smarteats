import { useEffect, useState } from 'react';
import Modal from '../components/shared/Modal';
import ModalActions from '../components/shared/ModalActions';
import Switch from '../components/shared/Switch';
import RecipeLinesEditor from './RecipeLinesEditor';
import { btnPrimary } from '../smarteats/floor/ui';
import { fetchWithAuth } from '../utils/apiClient';
import { useToast } from '../context/useToast';
import { optionRowsFromLines, optionLinesFromRows, recipeProblem } from './recipeLines';

// Cosa cambia un'opzione di un piatto nel magazzino: ingredienti in più («extra mozzarella») o in meno («senza cipolla»).
// Con l'interruttore spento l'opzione non tocca la dispensa.
const OptionRecipeModal = ({ option, ingredients, onClose }) => {
  const { showToast } = useToast();
  const [state, setState] = useState(null);       // { affects: boolean, rows }
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchWithAuth(`/modifiers/${option.id}/recipe`)
      .then(r => setState({ affects: r.affects_stock, rows: optionRowsFromLines(r.lines, ingredients) }))
      .catch(err => { showToast(err.message, 'error'); onClose(); });
  }, [option.id, ingredients, showToast, onClose]);

  const problem = state ? recipeProblem(state.rows, ingredients, []) : 'Caricamento…';
  const save = async () => {
    setBusy(true);
    try {
      await fetchWithAuth(`/modifiers/${option.id}/recipe`, { method: 'PUT', body: { affects_stock: state.affects, lines: optionLinesFromRows(state.rows) } });
      showToast('Opzione salvata', 'success');
      onClose();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setBusy(false); }
  };

  return (
    <Modal title={`${option.group} · ${option.name}`} size="max-w-2xl" dismissOnBackdrop={false} onClose={onClose} onSubmit={(e) => { e.preventDefault(); if (!problem) save(); }}
      footer={<ModalActions onCancel={onClose}><button type="submit" className={btnPrimary} disabled={busy || !!problem} title={problem ?? undefined}>Salva</button></ModalActions>}>
      {state === null ? <p className="text-sm text-[var(--text-muted)]">Caricamento…</p> : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3"><span className="text-sm text-[var(--text-main)]">Scala il magazzino</span>
            <Switch label="Scala il magazzino" checked={state.affects} onChange={affects => setState(s => ({ ...s, affects }))} /></div>
          {state.affects && (
            <>
              <p className="text-sm text-[var(--text-muted)]">Per ogni porzione che la sceglie: cosa si aggiunge o si toglie rispetto alla ricetta del piatto.</p>
              <RecipeLinesEditor signed rows={state.rows} onChange={rows => setState(s => ({ ...s, rows }))} ingredients={ingredients} />
            </>)}
        </div>)}
    </Modal>
  );
};

export default OptionRecipeModal;
