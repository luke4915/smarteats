import { useState } from 'react';
import RecipeModal from './RecipeModal';
import { row } from '../smarteats/floor/ui';
import { formatCents } from './units';

// I piatti con la loro ricetta: quanti ingredienti, quanto costa una porzione e quante se ne fanno con la dispensa di adesso.
const RecipesPanel = ({ products, recipes, ingredients, preparations, dish, showCosts, onChanged }) => {
  const [editing, setEditing] = useState(null);
  const summaryOf = new Map(recipes.map(r => [r.product_id, r]));
  const sorted = [...products].sort((a, b) => (a.category ?? '').localeCompare(b.category ?? '') || a.name.localeCompare(b.name));
  return (
    <section className="space-y-3">
      <p className="text-sm text-[var(--text-muted)]">Una ricetta dice cosa si scala dalla dispensa a ogni vendita. Un {dish} senza ricetta non tocca il magazzino.</p>
      {sorted.length === 0 && <p className="py-10 text-center text-sm text-[var(--text-muted)]">Nessun {dish} in carta.</p>}
      <ul className="space-y-1.5">
        {sorted.map(p => {
          const s = summaryOf.get(p.id);
          return (
            <li key={p.id}>
              <button className={`${row} w-full flex items-center gap-3 text-left cursor-pointer hover:border-[var(--border-hover)]`} onClick={() => setEditing(p)}>
                <span className="min-w-0 flex-1"><span className="block truncate font-medium text-[var(--text-main)]">{p.name}</span><span className="block text-xs text-[var(--text-muted)]">{p.category}</span></span>
                {s ? (
                  <span className="text-sm text-[var(--text-muted)] tabular-nums text-right">
                    {s.lines} {s.lines === 1 ? 'ingrediente' : 'ingredienti'}{showCosts ? ` · ${formatCents(s.cost_cents_per_portion)}` : ''} · {s.portions_from_ingredients} {s.portions_from_ingredients === 1 ? 'porzione' : 'porzioni'}
                  </span>
                ) : <span className="text-sm text-[var(--text-muted)]">Senza ricetta</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {editing && <RecipeModal product={editing} dish={dish} showCosts={showCosts} ingredients={ingredients} preparations={preparations} onClose={() => setEditing(null)} onSaved={onChanged} />}
    </section>
  );
};

export default RecipesPanel;
