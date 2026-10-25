import { useState } from 'react';
import { Plus } from 'lucide-react';
import IngredientModal from './IngredientModal';
import { btnPrimary, row } from '../smarteats/floor/ui';
import { formatQuantity, formatCostPerUnit } from './units';

// L'elenco degli ingredienti con ciò che c'è in dispensa. Un tocco su una riga la modifica.
const IngredientsPanel = ({ ingredients, showCosts, onChanged }) => {
  const [editing, setEditing] = useState(undefined);       // undefined = chiusa, null = nuovo, oggetto = in modifica
  const low = (i) => i.reorder_level !== null && i.quantity_on_hand <= i.reorder_level;
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--text-muted)]">La dispensa: quantità e costo medio di ogni ingrediente.</p>
        <button className={btnPrimary} onClick={() => setEditing(null)}><Plus size={16} /> Nuovo ingrediente</button>
      </div>
      {ingredients.length === 0 && <p className="py-10 text-center text-sm text-[var(--text-muted)]">Nessun ingrediente. Aggiungine uno, per esempio «Farina».</p>}
      <ul className="space-y-1.5">
        {ingredients.map(i => (
          <li key={i.id}>
            <button className={`${row} w-full flex items-center gap-3 text-left cursor-pointer hover:border-[var(--border-hover)] ${i.active ? '' : 'opacity-60'}`} onClick={() => setEditing(i)}>
              <span className="min-w-0 flex-1 truncate font-medium text-[var(--text-main)]">{i.name}</span>
              {i.marked_out && <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-500">Esaurito</span>}
              {!i.active && <span className="text-xs px-2 py-0.5 rounded-full border border-[var(--border)] text-[var(--text-muted)]">Disattivo</span>}
              {low(i) && !i.marked_out && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500">Da riordinare</span>}
              {showCosts && <span className="hidden sm:block text-sm text-[var(--text-muted)] tabular-nums">{formatCostPerUnit(i.weighted_average_cost, i.base_unit)}</span>}
              <span className={`w-24 text-right tabular-nums ${i.quantity_on_hand < 0 ? 'text-red-500' : 'text-[var(--text-main)]'}`}>{formatQuantity(i.quantity_on_hand, i.base_unit)}</span>
            </button>
          </li>
        ))}
      </ul>
      {editing !== undefined && <IngredientModal ingredient={editing} onClose={() => setEditing(undefined)} onSaved={onChanged} />}
    </section>
  );
};

export default IngredientsPanel;
