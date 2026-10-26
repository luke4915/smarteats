import { useState } from 'react';
import { Plus, Phone } from 'lucide-react';
import SupplierModal from './SupplierModal';
import { btnPrimary, row } from '../smarteats/floor/ui';

// I fornitori del locale e quanti ingredienti vendono. Un tocco apre i dati e il listino.
const SuppliersPanel = ({ suppliers, ingredients, onChanged }) => {
  const [editing, setEditing] = useState(undefined);
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--text-muted)]">Chi ti vende la merce, e a che prezzo.</p>
        <button className={btnPrimary} onClick={() => setEditing(null)}><Plus size={16} /> Nuovo fornitore</button>
      </div>
      {suppliers.length === 0 && <p className="py-10 text-center text-sm text-[var(--text-muted)]">Nessun fornitore. Aggiungine uno per poter registrare i scarichi.</p>}
      <ul className="space-y-1.5">
        {suppliers.map(s => (
          <li key={s.id}>
            <button className={`${row} w-full flex items-center gap-3 text-left cursor-pointer hover:border-[var(--border-hover)] ${s.active ? '' : 'opacity-60'}`} onClick={() => setEditing(s)}>
              <span className="min-w-0 flex-1 truncate font-medium text-[var(--text-main)]">{s.name}{!s.active && <span className="ml-2 text-xs text-[var(--text-muted)]">Disattivo</span>}</span>
              {s.phone && <span className="hidden sm:flex items-center gap-1 text-sm text-[var(--text-muted)]"><Phone size={13} />{s.phone}</span>}
              <span className="text-sm text-[var(--text-muted)] tabular-nums">{s.items.length} {s.items.length === 1 ? 'ingrediente' : 'ingredienti'}</span>
            </button>
          </li>))}
      </ul>
      {editing !== undefined && <SupplierModal supplier={editing} ingredients={ingredients} onClose={() => setEditing(undefined)} onSaved={onChanged} />}
    </section>
  );
};

export default SuppliersPanel;
