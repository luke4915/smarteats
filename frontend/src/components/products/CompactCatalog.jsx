import { useState } from 'react';
import { Plus, ListChecks, UtensilsCrossed } from 'lucide-react';
import Segmented from '../../smarteats/floor/Segmented';
import SearchField from '../shared/SearchField';
import { btn, btnPrimary } from '../../smarteats/floor/ui';
import CatalogRow from './CatalogRow';
import SelectionBar from './SelectionBar';
import { COLUMNS, COLUMNS_WITH_RECIPE } from './columns';
import { buildGroups, categoriesOf, viewOptions, effectiveView, toggleMany, allSelected, plural } from './catalogView';

// L'elenco dei prodotti, uguale nella sagra e nel ristorante: cerca, categorie, filtro per stato e un prodotto per riga (le regole di cosa
// mostrare sono in `catalogView.js`, la riga in `CatalogRow.jsx`). Nessun prodotto sparisce: i nascosti restano in elenco, in grigio e con
// «Nascosto»; il filtro «Tutti · Visibili · Esauriti · Nascosti» compare solo quando serve. Per cambiare la visibilità di tanti prodotti
// insieme (a inizio serata) c'è «Seleziona»: si spuntano le righe (o «Tutti» quelle in elenco: scelta prima una categoria, è la categoria intera) e la barra in fondo mostra o nasconde.
// `noun`: come si chiamano in questo locale («piatto» al ristorante, «prodotto» in sagra). `recipes` ({ summaryOf, onOpen }, solo nei locali
// con le ricette): ogni riga ha il pulsante «Ricetta» e dice se la ricetta c'è.
const CompactCatalog = ({ products, courses, recipes, noun = 'prodotto', onAdd, onEdit, onDelete, onToggleVisible, onAvailability, onSetManyVisible }) => {
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [chosenView, setChosenView] = useState('all');
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);

  const courseName = new Map((courses ?? []).map(c => [c.id, c.name]));
  const categories = categoriesOf(products);
  const options = viewOptions(products);
  const view = effectiveView(products, chosenView);        // se «Nascosti» non esiste più (l'ultimo è tornato visibile) si torna a «Tutti»
  const groups = buildGroups(products, { category, search, view });
  const items = groups.flatMap(g => g.items);                // una sola lista: la categoria è già il filtro in alto, niente titoli di gruppo
  const shownIds = items.map(p => p.id);

  const startOrStop = () => { setSelecting(on => !on); setSelected([]); };
  const toggleOne = (id) => setSelected(prev => toggleMany(prev, [id]));
  const apply = async (visible) => {
    setBusy(true);
    const done = await onSetManyVisible(selected, visible);
    setBusy(false);
    if (done) { setSelected([]); setSelecting(false); }
  };

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[var(--border-hover)] px-6 py-14 text-center">
        <UtensilsCrossed size={28} className="text-[var(--text-muted)]" aria-hidden="true" />
        <p className="text-base font-medium text-[var(--text-main)]">Non c'è ancora nessun {noun}</p>
        <p className="max-w-sm text-sm text-[var(--text-muted)]">Aggiungi il primo: bastano nome, prezzo e categoria. Poi compare nella cassa.</p>
        <button onClick={onAdd} className={btnPrimary}><Plus size={16} /> Aggiungi il primo {noun}</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchField className="w-full sm:w-auto sm:flex-1 sm:min-w-[200px]" value={search} onChange={setSearch} placeholder={`Cerca un ${noun}`} />
        <button onClick={startOrStop} aria-pressed={selecting} className={`${btn} flex-1 sm:flex-none ${selecting ? '!border-[var(--accent)] !text-[var(--accent)]' : ''}`}><ListChecks size={16} /> {selecting ? 'Fine' : 'Seleziona'}</button>
        <button onClick={onAdd} className={`${btnPrimary} flex-1 sm:flex-none`}><Plus size={16} /> Nuovo {noun}</button>
      </div>

      {categories.length > 1 && (
        <Segmented scroll label="Categorie" value={category} onChange={setCategory} options={[{ id: 'all', label: 'Tutte' }, ...categories.map(c => ({ id: c, label: c }))]} />
      )}
      {options.length > 0 && (
        <Segmented scroll label={`Quali ${plural(noun)} mostrare`} className="w-fit max-w-full" value={view} onChange={setChosenView} options={options} />
      )}

      {items.length === 0 && <p className="text-sm text-[var(--text-muted)] py-8 text-center">Nessun {noun}{search.trim() ? ` che contenga «${search.trim()}»` : view === 'hidden' ? ' nascosto' : view === 'soldout' ? ' esaurito' : ''}.</p>}

      {items.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
          {!selecting && (
            <div aria-hidden="true" className={`hidden md:grid ${recipes ? COLUMNS_WITH_RECIPE : COLUMNS} gap-x-3 px-4 py-2 border-b border-[var(--border)] text-xs font-medium text-[var(--text-muted)]`}>
              <span className="pl-[1.375rem]">{`${noun[0].toUpperCase()}${noun.slice(1)}`}</span><span className="text-right">Prezzo</span><span className="text-center">Disponibilità</span>
              {recipes && <span>Ricetta</span>}<span className="text-center">Visibile</span><span />
            </div>
          )}
          <ul className="divide-y divide-[var(--border)]">
            {items.map(p => (
              <CatalogRow key={p.id} product={p} courseName={courseName.get(p.course_id)} showCategory={category === 'all'} recipes={recipes} selecting={selecting} selected={selected.includes(p.id)}
                onToggleSelected={toggleOne} onEdit={onEdit} onDelete={onDelete} onToggleVisible={onToggleVisible} onAvailability={onAvailability} />
            ))}
          </ul>
        </div>
      )}

      {selecting && (
        <SelectionBar count={selected.length} noun={noun} busy={busy} everySelected={allSelected(selected, shownIds)}
          onToggleAll={() => setSelected(prev => toggleMany(prev, shownIds))} onShow={() => apply(true)} onHide={() => apply(false)} onDone={startOrStop} />
      )}
    </div>
  );
};

export default CompactCatalog;
