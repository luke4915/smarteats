import { useEffect, useState } from 'react';
import { Trash2, SlidersHorizontal } from 'lucide-react';
import { btn } from '../smarteats/floor/ui';
import { fetchWithAuth } from '../utils/apiClient';
import { kindLabel, reasonText } from './controls';
import { formatQuantity } from './units';

const SHOWN = 6;

// In fondo alla scheda di un ingrediente: le azioni a mano (uno scarto, una correzione della quantità) e gli ultimi movimenti
// di quell'ingrediente. Lo storico completo non c'è: serve di rado, e quando serve interessa un ingrediente alla volta.
const IngredientHistory = ({ ingredient, onMovement }) => {
  const [movements, setMovements] = useState(null);
  useEffect(() => {
    let current = true;
    fetchWithAuth(`/inventory/movements?ingredient_id=${ingredient.id}&limit=${SHOWN}`).then(list => { if (current) setMovements(list); }).catch(() => { if (current) setMovements([]); });
    return () => { current = false; };
  }, [ingredient.id]);

  return (
    <section className="space-y-3 pt-4 border-t border-[var(--border)]">
      <div className="grid sm:grid-cols-2 gap-2">
        <button type="button" className={`${btn} w-full`} onClick={() => onMovement('waste')}><Trash2 size={16} /> Registra uno scarto</button>
        <button type="button" className={`${btn} w-full`} onClick={() => onMovement('adjustment')}><SlidersHorizontal size={16} /> Correggi la quantità</button>
      </div>
      {movements?.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-[var(--text-muted)] mb-1">Ultimi movimenti</h3>
          <ul className="divide-y divide-[var(--border)]">
            {movements.map(m => (
              <li key={m.id} className="flex items-center gap-3 py-1.5 text-sm">
                <span className="tabular-nums text-xs text-[var(--text-muted)] w-20 shrink-0">{new Date(m.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}</span>
                <span className="min-w-0 flex-1 truncate text-[var(--text-main)]">{kindLabel(m.kind)}{m.reason ? <span className="text-[var(--text-muted)]"> · {reasonText(m.reason)}</span> : null}</span>
                <span className={`tabular-nums ${m.quantity_change < 0 ? 'text-red-500' : 'text-emerald-500'}`}>{m.quantity_change > 0 ? '+' : '−'}{formatQuantity(Math.abs(m.quantity_change), m.base_unit)}</span>
              </li>))}
          </ul>
        </div>)}
    </section>
  );
};

export default IngredientHistory;
