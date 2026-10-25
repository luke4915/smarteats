import { useState } from 'react';
import { Plus } from 'lucide-react';
import PreparationModal from './PreparationModal';
import { btnPrimary, row } from '../smarteats/floor/ui';
import { formatQuantity } from './units';

// Le preparazioni del locale (il sugo base): ricette riusate in più piatti.
const PreparationsPanel = ({ preparations, ingredients, onChanged }) => {
  const [editing, setEditing] = useState(undefined);
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--text-muted)]">Ricette usate in più piatti, come il sugo base o l&apos;impasto.</p>
        <button className={btnPrimary} onClick={() => setEditing(null)}><Plus size={16} /> Nuova preparazione</button>
      </div>
      {preparations.length === 0 && <p className="py-10 text-center text-sm text-[var(--text-muted)]">Nessuna preparazione. Servono solo se la stessa ricetta si usa in più piatti.</p>}
      <ul className="space-y-1.5">
        {preparations.map(p => (
          <li key={p.id}>
            <button className={`${row} w-full flex items-center gap-3 text-left cursor-pointer hover:border-[var(--border-hover)]`} onClick={() => setEditing(p)}>
              <span className="min-w-0 flex-1 truncate font-medium text-[var(--text-main)]">{p.name}</span>
              <span className="text-sm text-[var(--text-muted)] tabular-nums">{p.lines.length} {p.lines.length === 1 ? 'ingrediente' : 'ingredienti'} · dà {formatQuantity(p.output_quantity, p.base_unit)}</span>
            </button>
          </li>
        ))}
      </ul>
      {editing !== undefined && <PreparationModal preparation={editing} ingredients={ingredients} preparations={preparations} onClose={() => setEditing(undefined)} onSaved={onChanged} />}
    </section>
  );
};

export default PreparationsPanel;
