import { useEffect, useState, useCallback } from 'react';
import { ClipboardCheck, ClipboardList } from 'lucide-react';
import StockLevelModal from './StockLevelModal';
import StockLevelDetailModal from './StockLevelDetailModal';
import UsageModal from './UsageModal';
import { btn, btnPrimary, row } from '../smarteats/floor/ui';
import { fetchWithAuth } from '../utils/apiClient';
import { useToast } from '../context/useToast';

// I controlli di magazzino, dal più recente: quando, chi, e quante differenze sono uscite. Un tocco apre il dettaglio.
// Nei locali senza ricette (`simpleDepletion`) c'è anche lo scarico di fine servizio: quanto si è usato o quanto è rimasto.
const StockLevelsPanel = ({ ingredients, simpleDepletion, onChanged }) => {
  const { showToast } = useToast();
  const [levels, setLevels] = useState(null);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [usage, setUsage] = useState(false);
  const load = useCallback(() => fetchWithAuth('/stock-levels').then(setLevels).catch(err => showToast(err.message, 'error')), [showToast]);
  useEffect(() => { load(); }, [load]);
  const changed = async () => { await load(); await onChanged(); };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--text-muted)]">Conta cosa c'è davvero in dispensa: ogni differenza con il registro resta scritta.</p>
        <div className="flex flex-wrap gap-2 justify-end">
          {simpleDepletion && <button className={btn} onClick={() => setUsage(true)} disabled={ingredients.length === 0}><ClipboardList size={16} /> Scarico di fine servizio</button>}
          <button className={btnPrimary} onClick={() => setCreating(true)} disabled={ingredients.length === 0}><ClipboardCheck size={16} /> Nuovo controllo</button>
        </div>
      </div>
      {levels === null && <p className="text-sm text-[var(--text-muted)]">Caricamento…</p>}
      {levels?.length === 0 && <p className="py-10 text-center text-sm text-[var(--text-muted)]">Nessun controllo. Il primo si fa di solito a fine servizio.</p>}
      <ul className="space-y-1.5">
        {(levels ?? []).map(l => (
          <li key={l.id}>
            <button className={`${row} w-full flex items-center gap-3 text-left cursor-pointer hover:border-[var(--border-hover)]`} onClick={() => setViewing(l.id)}>
              <span className="tabular-nums text-sm text-[var(--text-muted)] w-24 shrink-0">{new Date(l.created_at).toLocaleDateString('it-IT')}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-[var(--text-main)]">{l.kind === 'closing' ? 'Fine servizio' : 'Periodico'}</span>
                <span className="block text-xs text-[var(--text-muted)]">{l.lines} contati{l.created_by ? ` · ${l.created_by}` : ''}{l.notes ? ` · ${l.notes}` : ''}</span>
              </span>
              <span className={`text-sm tabular-nums ${l.differences ? 'text-amber-500' : 'text-[var(--text-muted)]'}`}>{l.differences ? `${l.differences} ${l.differences === 1 ? 'differenza' : 'differenze'}` : 'Torna tutto'}</span>
            </button>
          </li>))}
      </ul>
      {creating && <StockLevelModal ingredients={ingredients} onClose={() => setCreating(false)} onSaved={changed} />}
      {usage && <UsageModal ingredients={ingredients} onClose={() => setUsage(false)} onSaved={changed} />}
      {viewing && <StockLevelDetailModal levelId={viewing} onClose={() => setViewing(null)} />}
    </section>
  );
};

export default StockLevelsPanel;
