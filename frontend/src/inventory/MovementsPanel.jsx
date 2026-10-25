import { useEffect, useState, useCallback } from 'react';
import { Trash2, SlidersHorizontal, ClipboardList } from 'lucide-react';
import MovementModal from './MovementModal';
import UsageModal from './UsageModal';
import Segmented from '../smarteats/floor/Segmented';
import { btn, row } from '../smarteats/floor/ui';
import { fetchWithAuth } from '../utils/apiClient';
import { useToast } from '../context/useToast';
import { kindLabel, reasonText, MOVEMENT_FILTERS } from './controls';
import { formatQuantity } from './units';

// Il registro dei movimenti della dispensa (ogni cosa che entra o esce, con chi e perché) e le azioni a mano: scarto, rettifica
// e, nei locali senza ricette, lo scarico di fine servizio.
const MovementsPanel = ({ ingredients, simpleDepletion, onChanged }) => {
  const { showToast } = useToast();
  const [kind, setKind] = useState('');
  const [movements, setMovements] = useState(null);
  const [dialog, setDialog] = useState(null);                    // 'waste' | 'adjustment' | 'usage'
  const load = useCallback(() => fetchWithAuth(`/inventory/movements${kind ? `?kind=${kind}` : ''}`).then(setMovements).catch(err => showToast(err.message, 'error')), [kind, showToast]);
  useEffect(() => { load(); }, [load]);
  const changed = async () => { await load(); await onChanged(); };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented scroll label="Filtro del registro" className="w-fit max-w-full" value={kind} onChange={setKind} options={MOVEMENT_FILTERS} />
        <div className="flex flex-wrap gap-2">
          {simpleDepletion && <button className={btn} onClick={() => setDialog('usage')}><ClipboardList size={16} /> Scarico di fine servizio</button>}
          <button className={btn} onClick={() => setDialog('waste')}><Trash2 size={16} /> Scarto</button>
          <button className={btn} onClick={() => setDialog('adjustment')}><SlidersHorizontal size={16} /> Rettifica</button>
        </div>
      </div>
      {movements === null && <p className="text-sm text-[var(--text-muted)]">Caricamento…</p>}
      {movements?.length === 0 && <p className="py-10 text-center text-sm text-[var(--text-muted)]">Nessun movimento.</p>}
      <ul className="space-y-1.5">
        {(movements ?? []).map(m => (
          <li key={m.id} className={`${row} flex items-center gap-3`}>
            <span className="tabular-nums text-xs text-[var(--text-muted)] w-24 shrink-0">{new Date(m.created_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-[var(--text-main)]">{m.ingredient_name}</span>
              <span className="block truncate text-xs text-[var(--text-muted)]">{kindLabel(m.kind)}{m.reason ? ` · ${reasonText(m.reason)}` : ''}{m.created_by ? ` · ${m.created_by}` : ''}</span>
            </span>
            <span className={`tabular-nums text-sm w-24 text-right ${m.quantity_change < 0 ? 'text-red-500' : 'text-emerald-500'}`}>{m.quantity_change > 0 ? '+' : '−'}{formatQuantity(Math.abs(m.quantity_change), m.base_unit)}</span>
          </li>))}
      </ul>
      {(dialog === 'waste' || dialog === 'adjustment') && <MovementModal type={dialog} ingredients={ingredients} onClose={() => setDialog(null)} onSaved={changed} />}
      {dialog === 'usage' && <UsageModal ingredients={ingredients} onClose={() => setDialog(null)} onSaved={changed} />}
    </section>
  );
};

export default MovementsPanel;
