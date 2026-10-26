import { useState } from 'react';
import { Plus } from 'lucide-react';
import IngredientModal from './IngredientModal';
import Segmented from '../smarteats/floor/Segmented';
import { btnPrimary, row } from '../smarteats/floor/ui';
import { formatQuantity, formatCostPerUnit, formatDays } from './units';

// L'elenco degli ingredienti con ciò che c'è in dispensa e, se si consuma, quanto dura. Un tocco su una riga la modifica.
// `restock` sono le scorte calcolate dal server (giorni rimasti, «da riordinare»); il filtro mostra solo quelle da riordinare.
const IngredientsPanel = ({ ingredients, restock = [], showCosts, onChanged }) => {
  const [editing, setEditing] = useState(undefined);       // undefined = chiusa, null = nuovo, oggetto = in modifica
  const [filter, setFilter] = useState('all');
  const stockOf = new Map(restock.map(r => [r.id, r]));
  const lowCount = restock.filter(r => r.low).length;
  const shown = filter === 'low' ? ingredients.filter(i => stockOf.get(i.id)?.low) : ingredients;
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented scroll label="Filtro degli ingredienti" className="w-fit max-w-full" value={filter} onChange={setFilter}
          options={[{ id: 'all', label: 'Tutti' }, { id: 'low', label: lowCount ? `Da riordinare (${lowCount})` : 'Da riordinare' }]} />
        <button className={btnPrimary} onClick={() => setEditing(null)}><Plus size={16} /> Nuovo ingrediente</button>
      </div>
      {ingredients.length === 0 && <p className="py-10 text-center text-sm text-[var(--text-muted)]">Nessun ingrediente. Aggiungine uno, per esempio «Farina».</p>}
      {ingredients.length > 0 && shown.length === 0 && <p className="py-10 text-center text-sm text-[var(--text-muted)]">Niente da riordinare. Per averne l'avviso scrivi una scorta minima nella scheda dell'ingrediente.</p>}
      <ul className="space-y-1.5">
        {shown.map(i => {
          const stock = stockOf.get(i.id);
          return (
            <li key={i.id}>
              <button className={`${row} w-full flex items-center gap-3 text-left cursor-pointer hover:border-[var(--border-hover)] ${i.active ? '' : 'opacity-60'}`} onClick={() => setEditing(i)}>
                <span className="min-w-0 flex-1 truncate font-medium text-[var(--text-main)]">{i.name}</span>
                {i.marked_out && <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-500">Esaurito</span>}
                {!i.active && <span className="text-xs px-2 py-0.5 rounded-full border border-[var(--border)] text-[var(--text-muted)]">Disattivo</span>}
                {stock?.low && !i.marked_out && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500">Da riordinare</span>}
                {stock?.days_of_stock != null && <span className="hidden sm:block text-xs text-[var(--text-muted)] tabular-nums">per {formatDays(stock.days_of_stock)}</span>}
                {showCosts && <span className="hidden sm:block text-sm text-[var(--text-muted)] tabular-nums">{formatCostPerUnit(i.weighted_average_cost, i.base_unit)}</span>}
                <span className={`w-24 text-right tabular-nums ${i.quantity_on_hand < 0 ? 'text-red-500' : 'text-[var(--text-main)]'}`}>{formatQuantity(i.quantity_on_hand, i.base_unit)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {editing !== undefined && <IngredientModal ingredient={editing} onClose={() => setEditing(undefined)} onSaved={onChanged} />}
    </section>
  );
};

export default IngredientsPanel;
