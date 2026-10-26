import { useState } from 'react';
import { Edit, Trash2, Plus, CheckSquare, Square, Eye, EyeOff } from 'lucide-react';
import SearchField from '../shared/SearchField';

const field = 'h-10 rounded-xl bg-[var(--bg-card-2)] border border-[var(--border)] text-[var(--text-main)] text-xs focus:outline-none focus:border-[var(--accent)] transition-colors';
const toolButton = (on, onClasses) => `flex items-center gap-1.5 h-10 px-3.5 rounded-xl font-semibold text-xs transition-all border cursor-pointer ${on ? onClasses : 'bg-[var(--bg-card-2)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-main)]'}`;
const DESTINATION_BADGE = {
  bar: ['Bar', 'bg-blue-500/10 text-blue-400 border-blue-500/20'],
  kitchen: ['Cucina', 'bg-green-500/10 text-green-400 border-green-500/20'],
};

// L'elenco dei prodotti della cassa delle sagre: per categoria, con ricerca, filtro «solo visibili» e selezione multipla
// per mostrare o nascondere più prodotti insieme. I ristoranti usano `CompactCatalog`.
const ProductGroups = ({ products, onAdd, onEdit, onDelete, onToggleVisible, onSetManyVisible }) => {
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [onlyVisible, setOnlyVisible] = useState(true);
  const [bulk, setBulk] = useState(false);
  const [selected, setSelected] = useState([]);

  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
  const term = search.toLowerCase();
  const groups = categories
    .filter(c => category === 'all' || c === category)
    .map(c => ({ category: c, items: products.filter(p => p.category === c && (!term || p.name.toLowerCase().includes(term)) && (!onlyVisible || p.visible !== false)) }))
    .filter(g => g.items.length > 0);

  const toggleBulk = () => { setBulk(b => !b); setSelected([]); };
  const toggleSelected = (id) => setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  const applyBulk = async (visible) => { if (await onSetManyVisible(selected, visible)) { setSelected([]); setBulk(false); } };

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-2.5 w-full">
        <div className="flex items-center gap-2 flex-1 min-w-[280px]">
          <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Categoria" className={`${field} w-44 sm:w-52 shrink-0 pl-3.5 pr-3 font-semibold cursor-pointer`}>
            <option value="all">Tutte le categorie</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <SearchField className="flex-1" value={search} onChange={setSearch} placeholder="Cerca…" />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setOnlyVisible(v => !v)} title={onlyVisible ? 'Mostra anche i prodotti nascosti' : 'Mostra solo i prodotti visibili'}
            className={toolButton(onlyVisible, 'bg-green-600/10 border-green-500/30 text-green-400 hover:bg-green-600/20')}>
            {onlyVisible ? <Eye size={14} /> : <EyeOff size={14} />}<span className="hidden sm:inline">{onlyVisible ? 'Solo Visibili' : 'Tutti'}</span>
          </button>
          <button onClick={toggleBulk} className={toolButton(bulk, 'bg-blue-600 border-blue-500 text-white hover:bg-blue-700 shadow-sm')}>
            <span className="hidden sm:inline">{bulk ? 'Annulla Multi' : 'Multi-Select'}</span><span className="sm:hidden">{bulk ? 'Annulla' : 'Multi'}</span>
          </button>
          <button onClick={onAdd} className="flex items-center gap-1.5 h-10 px-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl font-semibold text-xs transition-all cursor-pointer"><Plus size={15} /><span>Aggiungi</span></button>
        </div>
      </div>

      {bulk && (
        <div className="flex items-center justify-between p-4 bg-blue-950/40 border border-blue-500/30 rounded-xl">
          <span className="text-xs font-bold text-blue-300">{selected.length} Prodotti Selezionati</span>
          <div className="flex gap-2">
            <button onClick={() => applyBulk(true)} disabled={selected.length === 0} className="flex items-center gap-1.5 px-4 py-2 bg-green-600 disabled:opacity-40 hover:bg-green-700 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed"><Eye size={14} /> Mostra nel Listino</button>
            <button onClick={() => applyBulk(false)} disabled={selected.length === 0} className="flex items-center gap-1.5 px-4 py-2 bg-red-600 disabled:opacity-40 hover:bg-red-700 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed"><EyeOff size={14} /> Nascondi nel Listino</button>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {groups.map(group => (
          <div key={group.category}>
            <p className="text-xs font-semibold text-gray-400 mb-3">{group.category}</p>
            <div className="space-y-2">
              {group.items.map(product => {
                const hidden = product.visible === false;
                const badge = DESTINATION_BADGE[product.print_destination];
                return (
                  <div key={product.id} onClick={() => bulk && toggleSelected(product.id)}
                    className={`flex justify-between items-center p-4 bg-[var(--bg-card)] rounded-xl border-l-4 border border-[var(--border)] transition-all ${bulk ? 'cursor-pointer select-none hover:bg-[var(--bg-card-2)]' : ''} ${hidden ? 'opacity-50' : ''}`}
                    style={{ borderLeftColor: product.color || '#3b82f6' }}>
                    <div className="flex items-center gap-4">
                      {bulk && <div className="text-blue-500">{selected.includes(product.id) ? <CheckSquare size={20} /> : <Square size={20} className="text-gray-500" />}</div>}
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm tracking-tight text-[var(--text-main)]">{product.name}</p>
                          {hidden && <span className="bg-red-500/20 text-red-400 font-bold px-1.5 py-0.5 rounded text-[11px] border border-red-500/20">Nascosto</span>}
                          {badge && <span className={`${badge[1]} font-bold px-1.5 py-0.5 rounded text-[11px] border`}>{badge[0]}</span>}
                        </div>
                        <p className="text-xs font-bold" style={{ color: product.color || '#3b82f6' }}>{(product.price || 0).toFixed(2)} €</p>
                      </div>
                    </div>
                    {!bulk && (
                      <div className="flex items-center gap-4">
                        <button onClick={() => onToggleVisible(product)} title={hidden ? 'Mostra nel menu rapido' : 'Nascondi dal menu rapido'}
                          className={`p-2 rounded-xl transition-colors cursor-pointer ${hidden ? 'text-gray-500 hover:bg-gray-500/10' : 'text-green-500 hover:bg-green-500/10'}`}>{hidden ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                        <div className="flex gap-1 border-l border-[var(--border)] pl-2">
                          <button onClick={() => onEdit(product)} aria-label={`Modifica ${product.name}`} className="p-2 rounded-xl hover:bg-[var(--bg-card-2)] transition-colors cursor-pointer"><Edit size={16} className="text-gray-500" /></button>
                          <button onClick={() => onDelete(product)} aria-label={`Elimina ${product.name}`} className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"><Trash2 size={16} className="text-red-500" /></button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default ProductGroups;
