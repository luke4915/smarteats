import { useState } from 'react';
import { Plus, Trash2, Eye, EyeOff, CheckSquare, Square, ListChecks } from 'lucide-react';
import Segmented from '../../smarteats/floor/Segmented';
import SearchField from '../shared/SearchField';
import { btn, btnPrimary, iconBtn } from '../../smarteats/floor/ui';
import { formatEuro } from '../../utils/format';

const DESTINATION = { bar: 'Bar', kitchen: 'Cucina' };

// L'elenco dei prodotti, uguale nella sagra e nel ristorante: le categorie in alto, un prodotto per riga (nome, portata e destinazione
// in piccolo, prezzo, visibilità), il resto si apre con un tocco sulla riga. I prodotti nascosti restano fuori finché non si chiede di
// vederli. «Seleziona» (se `onSetManyVisible`) permette di mostrare o nascondere più prodotti insieme, per esempio a inizio serata.
// `noun`: come si chiamano in questo locale («piatto» al ristorante, «prodotto» in sagra).
const CompactCatalog = ({ products, courses, noun = 'prodotto', onAdd, onEdit, onDelete, onToggleVisible, onSetManyVisible }) => {
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState([]);

  const courseName = new Map((courses ?? []).map(c => [c.id, c.name]));
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
  const hiddenCount = products.filter(p => p.visible === false).length;
  const term = search.trim().toLowerCase();
  const groups = categories
    .filter(c => category === 'all' || c === category)
    .map(c => ({
      category: c,
      items: products.filter(p => p.category === c && (showHidden || selecting || p.visible !== false) && (!term || p.name.toLowerCase().includes(term))),
    }))
    .filter(g => g.items.length > 0);

  const toggleSelecting = () => { setSelecting(on => !on); setSelected([]); };
  const toggleSelected = (id) => setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  const applySelection = async (visible) => { if (await onSetManyVisible(selected, visible)) { setSelected([]); setSelecting(false); } };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchField className="w-full sm:w-auto sm:flex-1 sm:min-w-[200px]" value={search} onChange={setSearch} placeholder={`Cerca un ${noun}`} />
        {onSetManyVisible && <button onClick={toggleSelecting} aria-pressed={selecting} className={`${btn} flex-1 sm:flex-none ${selecting ? '!border-[var(--accent)] !text-[var(--accent)]' : ''}`}><ListChecks size={16} /> {selecting ? 'Fine' : 'Seleziona'}</button>}
        <button onClick={onAdd} className={`${btnPrimary} flex-1 sm:flex-none`}><Plus size={16} /> Nuovo {noun}</button>
      </div>

      {categories.length > 1 && (
        <Segmented scroll label="Categorie" value={category} onChange={setCategory} options={[{ id: 'all', label: 'Tutte' }, ...categories.map(c => ({ id: c, label: c }))]} />
      )}

      {selecting && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/10">
          <span className="text-sm font-medium text-[var(--text-main)]">{selected.length === 0 ? `Tocca i ${noun === 'piatto' ? 'piatti' : 'prodotti'} da cambiare` : `${selected.length} selezionati`}</span>
          <div className="flex gap-2">
            <button onClick={() => applySelection(true)} disabled={selected.length === 0} className={btn}><Eye size={16} /> Mostra</button>
            <button onClick={() => applySelection(false)} disabled={selected.length === 0} className={btn}><EyeOff size={16} /> Nascondi</button>
          </div>
        </div>
      )}

      {groups.length === 0 && <p className="text-sm text-[var(--text-muted)] py-8 text-center">Nessun {noun}{term ? ` che contenga «${search.trim()}»` : ''}.</p>}
      {groups.map(g => (
        <section key={g.category} aria-label={g.category}>
          {category === 'all' && <h3 className="text-sm font-medium text-[var(--text-muted)] mb-1.5 px-1">{g.category}</h3>}
          <ul className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)] overflow-hidden bg-[var(--bg-card)]">
            {g.items.map(p => {
              const hidden = p.visible === false;
              const course = courseName.get(p.course_id);
              const detail = [course && course !== p.category ? course : null, DESTINATION[p.print_destination], p.stock_enabled && p.stock !== null ? `${p.stock} disponibili` : null].filter(Boolean).join(' · ');
              return (
                <li key={p.id} className={`flex items-center gap-1 pr-2 ${hidden ? 'opacity-55' : ''}`}>
                  <button onClick={() => (selecting ? toggleSelected(p.id) : onEdit(p))} className="flex-1 min-w-0 flex items-center gap-3 pl-4 py-3 text-left cursor-pointer hover:bg-[var(--bg-card-2)] transition-colors" aria-label={selecting ? `Seleziona ${p.name}` : `Modifica ${p.name}`}>
                    {selecting
                      ? (selected.includes(p.id) ? <CheckSquare size={20} className="shrink-0 text-[var(--accent)]" /> : <Square size={20} className="shrink-0 text-[var(--text-muted)]" />)
                      : <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color || 'var(--accent)' }} aria-hidden="true" />}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-[var(--text-main)] truncate">{p.name}{hidden && <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">nascosto</span>}</span>
                      {detail && <span className="block text-xs text-[var(--text-muted)] truncate">{detail}</span>}
                    </span>
                    <span className="text-sm font-medium tabular-nums text-[var(--text-main)] pr-2">{formatEuro(p.price || 0)}</span>
                  </button>
                  {!selecting && (
                    <>
                      <button onClick={() => onToggleVisible(p)} title={hidden ? 'Mostra nelle comande' : 'Nascondi dalle comande'} aria-label={hidden ? `Mostra ${p.name}` : `Nascondi ${p.name}`} className={iconBtn}>{hidden ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                      <button onClick={() => onDelete(p)} title="Elimina" aria-label={`Elimina ${p.name}`} className={`${iconBtn} hover:!text-red-500 hover:!bg-red-500/10`}><Trash2 size={16} /></button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {hiddenCount > 0 && !selecting && (
        <button onClick={() => setShowHidden(v => !v)} className="text-sm text-[var(--text-muted)] hover:text-[var(--text-main)] underline-offset-2 hover:underline cursor-pointer">
          {showHidden ? `Nascondi i ${noun === 'piatto' ? 'piatti' : 'prodotti'} non in uso` : `Mostra anche i ${hiddenCount} ${noun === 'piatto' ? 'piatti' : 'prodotti'} nascosti`}
        </button>
      )}
    </div>
  );
};

export default CompactCatalog;
