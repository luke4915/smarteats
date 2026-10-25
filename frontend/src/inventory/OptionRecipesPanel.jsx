import { useState } from 'react';
import OptionRecipeModal from './OptionRecipeModal';
import { row } from '../smarteats/floor/ui';
import { useModifiers } from '../smarteats/floor/useModifiers';

// Le opzioni dei piatti (cottura, aggiunte, senza…): per ognuna si dice se e cosa cambia nel magazzino.
const OptionRecipesPanel = ({ ingredients }) => {
  const { groups } = useModifiers();
  const [editing, setEditing] = useState(null);
  return (
    <section className="space-y-3">
      <p className="text-sm text-[var(--text-muted)]">Un&apos;opzione può aggiungere o togliere ingredienti: «extra mozzarella» ne usa di più, «senza cipolla» ne usa di meno.</p>
      {groups.length === 0 && <p className="py-10 text-center text-sm text-[var(--text-muted)]">Nessuna opzione. Si creano dalla Carta.</p>}
      {groups.map(g => (
        <div key={g.id} className="space-y-1.5">
          <h3 className="text-sm font-semibold text-[var(--text-main)]">{g.name}</h3>
          <ul className="space-y-1.5">
            {g.options.map(o => (
              <li key={o.id}>
                <button className={`${row} w-full text-left cursor-pointer hover:border-[var(--border-hover)] font-medium text-[var(--text-main)]`} onClick={() => setEditing({ id: o.id, name: o.name, group: g.name })}>{o.name}</button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {editing && <OptionRecipeModal option={editing} ingredients={ingredients} onClose={() => setEditing(null)} />}
    </section>
  );
};

export default OptionRecipesPanel;
