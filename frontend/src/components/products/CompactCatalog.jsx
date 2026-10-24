import { useState } from 'react';
import { Search, Plus, X, Trash2, Eye, EyeOff } from 'lucide-react';
import ScrollRow from '../shared/ScrollRow';

const DESTINATION = { bar: 'Bar', kitchen: 'Cucina' };

// La carta di un ristorante, in compatto: le categorie come chip, un piatto per riga (nome, portata e destinazione in
// piccolo, prezzo, visibilità), il resto si apre con un tocco sulla riga. I piatti nascosti restano fuori finché non
// si chiede di vederli. Gli stessi dati e le stesse azioni dell'editor della cassa (ProductConfig): cambia solo come si vedono.
const CompactCatalog = ({ products, courses, onAdd, onEdit, onDelete, onToggleVisible }) => {
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [showHidden, setShowHidden] = useState(false);

  const courseName = new Map((courses ?? []).map(c => [c.id, c.name]));
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
  const hiddenCount = products.filter(p => p.visible === false).length;
  const term = search.trim().toLowerCase();
  const groups = categories
    .filter(c => category === 'all' || c === category)
    .map(c => ({
      category: c,
      items: products.filter(p => p.category === c && (showHidden || p.visible !== false) && (!term || p.name.toLowerCase().includes(term))),
    }))
    .filter(g => g.items.length > 0);

  const chip = (active) => `shrink-0 h-9 px-3.5 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${active ? 'bg-[var(--bg-card-2)] text-[var(--text-main)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca un piatto" aria-label="Cerca un piatto"
            className="w-full h-10 pl-9 pr-9 rounded-lg bg-[var(--bg-card-2)] border border-[var(--border)] text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]" />
          {search && <button onClick={() => setSearch('')} aria-label="Svuota la ricerca" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"><X size={14} /></button>}
        </div>
        <button onClick={onAdd} className="flex items-center gap-1.5 h-10 px-4 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium cursor-pointer"><Plus size={16} /> Nuovo piatto</button>
      </div>

      <ScrollRow className="flex gap-1 -mx-1 px-1" role="tablist" aria-label="Categorie">
        <button role="tab" aria-selected={category === 'all'} onClick={() => setCategory('all')} className={chip(category === 'all')}>Tutte</button>
        {categories.map(c => <button key={c} role="tab" aria-selected={category === c} onClick={() => setCategory(c)} className={chip(category === c)}>{c}</button>)}
      </ScrollRow>

      {groups.length === 0 && <p className="text-sm text-[var(--text-muted)] py-8 text-center">Nessun piatto{term ? ` che contenga «${search.trim()}»` : ''}.</p>}
      {groups.map(g => (
        <section key={g.category} aria-label={g.category}>
          {category === 'all' && <h3 className="text-sm font-medium text-[var(--text-muted)] mb-1.5 px-1">{g.category}</h3>}
          <ul className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)] overflow-hidden bg-[var(--bg-card)]">
            {g.items.map(p => {
              const hidden = p.visible === false;
              const course = courseName.get(p.course_id);
              const detail = [course && course !== p.category ? course : null, DESTINATION[p.print_destination], p.stock_enabled && p.stock !== null ? `${p.stock} disponibili` : null].filter(Boolean).join(' · ');
              return (
                <li key={p.id} className={`flex items-center gap-3 pr-2 ${hidden ? 'opacity-55' : ''}`}>
                  <button onClick={() => onEdit(p)} className="flex-1 min-w-0 flex items-center gap-3 pl-4 py-3 text-left cursor-pointer hover:bg-[var(--bg-card-2)] transition-colors" aria-label={`Modifica ${p.name}`}>
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color || 'var(--accent)' }} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-[var(--text-main)] truncate">{p.name}{hidden && <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">nascosto</span>}</span>
                      {detail && <span className="block text-xs text-[var(--text-muted)] truncate">{detail}</span>}
                    </span>
                    <span className="text-sm font-medium tabular-nums text-[var(--text-main)] pr-2">{(p.price || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
                  </button>
                  <button onClick={() => onToggleVisible(p)} title={hidden ? 'Mostra nelle comande' : 'Nascondi dalle comande'} aria-label={hidden ? `Mostra ${p.name}` : `Nascondi ${p.name}`}
                    className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-2)] cursor-pointer">{hidden ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                  <button onClick={() => onDelete(p)} title="Elimina" aria-label={`Elimina ${p.name}`}
                    className="p-2 rounded-lg text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 cursor-pointer"><Trash2 size={16} /></button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {hiddenCount > 0 && (
        <button onClick={() => setShowHidden(v => !v)} className="text-sm text-[var(--text-muted)] hover:text-[var(--text-main)] underline-offset-2 hover:underline cursor-pointer">
          {showHidden ? 'Nascondi i piatti non in uso' : `Mostra anche i ${hiddenCount} piatti nascosti`}
        </button>
      )}
    </div>
  );
};

export default CompactCatalog;
