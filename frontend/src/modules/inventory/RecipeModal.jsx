import { useEffect, useRef, useState } from 'react';
import Modal from '../../components/shared/Modal';
import ModalActions from '../../components/shared/ModalActions';
import RecipeLinesEditor from './RecipeLinesEditor';
import { btnPrimary } from '../../components/shared/styles';
import { fetchWithAuth } from '../../utils/apiClient';
import { useToast } from '../../context/useToast';
import { rowsFromLines, recipeProblem, linesFromRows } from './recipeLines';
import { formatCents } from '../../utils/format';
import Loading from '../../components/shared/Loading';

// La ricetta di un piatto: cosa si scala dalla dispensa a ogni porzione. Mostra il costo di una porzione al costo medio di adesso.
const RecipeModal = ({ product, dish, showCosts, ingredients, preparations, onClose, onSaved }) => {
  const { showToast } = useToast();
  const [rows, setRows] = useState(null);
  const [summary, setSummary] = useState(null);
  const [busy, setBusy] = useState(false);

  // La ricetta si carica **una volta** per piatto. Prima l'effetto dipendeva da `onClose` e dagli elenchi, che cambiano a ogni ridisegno della
  // pagina: bastava un avviso in tempo reale (un ordine, un prodotto cambiato da un altro) mentre si scriveva per ricaricarla dal server e
  // cancellare le righe appena inserite. I valori più recenti si leggono da un riferimento, senza far ripartire il caricamento.
  const latest = useRef(null);
  latest.current = { ingredients, preparations, showToast, onClose };
  useEffect(() => {
    let cancelled = false;
    fetchWithAuth(`/products/${product.id}/recipe`)
      .then(recipe => { if (!cancelled) { setRows(rowsFromLines(recipe.lines, latest.current.ingredients, latest.current.preparations)); setSummary(recipe); } })
      .catch(err => { if (!cancelled) { latest.current.showToast(err.message, 'error'); latest.current.onClose(); } });
    return () => { cancelled = true; };
  }, [product.id]);

  const problem = rows ? recipeProblem(rows, ingredients, preparations) : 'Caricamento…';
  const save = async () => {
    setBusy(true);
    try {
      await fetchWithAuth(`/products/${product.id}/recipe`, { method: 'PUT', body: { lines: linesFromRows(rows) } });
      showToast('Ricetta salvata', 'success');
      await onSaved();
      onClose();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setBusy(false); }
  };

  return (
    <Modal title={`Ricetta · ${product.name}`} size="max-w-2xl" dismissOnBackdrop={false} onClose={onClose} onSubmit={(e) => { e.preventDefault(); if (!problem) save(); }}
      footer={<ModalActions onCancel={onClose}><button type="submit" className={btnPrimary} disabled={busy || !!problem} title={problem ?? undefined}>Salva</button></ModalActions>}>
      {rows === null ? <Loading /> : (
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-muted)]">Ciò che serve per <b className="text-[var(--text-main)]">una porzione</b> di questo {dish}. A ogni vendita si scala dalla dispensa.</p>
          <RecipeLinesEditor rows={rows} onChange={setRows} ingredients={ingredients} preparations={preparations} />
          {showCosts && summary && rows.length > 0 && (
            <p className="text-sm text-[var(--text-muted)]">Costo di una porzione (prima del salvataggio): <b className="text-[var(--text-main)] tabular-nums">{formatCents(summary.cost_cents_per_portion)}</b></p>)}
        </div>)}
    </Modal>
  );
};

export default RecipeModal;
