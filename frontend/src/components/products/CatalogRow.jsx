import { CheckSquare, Square, Trash2, ChefHat } from 'lucide-react';
import Switch from '../shared/Switch';
import { btn, iconBtn } from '../../smarteats/floor/ui';
import { formatEuro } from '../../utils/format';
import { modeOf, stateLabel } from './availability';
import { isHidden } from './catalogView';
import { COLUMNS, COLUMNS_WITH_RECIPE } from './columns';

const DESTINATION = { bar: 'Bar', kitchen: 'Cucina' };
const CHIP = {
  unlimited: 'border-[var(--border)] text-[var(--text-muted)]',
  portions: 'border-[var(--border-hover)] text-[var(--text-main)]',
  soldout: 'border-amber-500/40 bg-amber-500/10 text-amber-500',
};

// Una riga dell'elenco dei prodotti. Tutta la riga è un solo bersaglio: tocca per modificare (o, in «Seleziona», per spuntare), senza
// zone che si evidenziano a metà. Sopra, i comandi, sempre nello stesso posto: la **disponibilità** (si tocca per cambiarla, come tenendo
// premuta la tessera in cassa), l'interruttore **Visibile** (se compare nella cassa e nelle comande) e il cestino (l'eliminazione chiede
// sempre conferma). I comandi sono `relative` perché stiano sopra il bersaglio che copre la riga. `showCategory`: guardando più categorie
// insieme, la categoria compare in piccolo sotto il nome (non ci sono titoli di gruppo: il filtro in alto è già la categoria). `recipes`
// (solo nei locali con le ricette): il pulsante «Ricetta». Dal tablet in su le colonne sono quelle di `columns.js`; sul telefono i comandi
// vanno su una seconda riga.
const CatalogRow = ({ product: p, courseName, showCategory, recipes, selecting, selected, onToggleSelected, onEdit, onDelete, onToggleVisible, onAvailability }) => {
  const hidden = isHidden(p);
  const mode = modeOf(p);
  const detail = [showCategory ? p.category || 'Generico' : null, courseName && courseName !== p.category ? courseName : null, DESTINATION[p.print_destination]].filter(Boolean).join(' · ');
  const recipe = recipes?.summaryOf.get(p.id);
  const dim = hidden ? 'opacity-55' : '';
  return (
    <li className={`relative grid grid-cols-[minmax(0,1fr)_auto] ${recipes ? COLUMNS_WITH_RECIPE : COLUMNS} items-center gap-x-3 gap-y-2 px-4 py-3 hover:bg-[var(--bg-card-2)] transition-colors`}>
      <button type="button" onClick={() => (selecting ? onToggleSelected(p.id) : onEdit(p))} aria-pressed={selecting ? selected : undefined}
        aria-label={selecting ? `Seleziona ${p.name}` : `Modifica ${p.name}`} className="absolute inset-0 cursor-pointer" />

      <span className={`pointer-events-none relative flex min-w-0 items-center gap-3 ${dim}`}>
        {selecting
          ? (selected ? <CheckSquare size={20} className="shrink-0 text-[var(--accent)]" /> : <Square size={20} className="shrink-0 text-[var(--text-muted)]" />)
          : <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color || 'var(--accent)' }} aria-hidden="true" />}
        <span className="min-w-0">
          <span className="block text-sm font-medium text-[var(--text-main)] truncate">{p.name}{hidden && <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">Nascosto</span>}</span>
          {(detail || recipes) && (
            <span className="block text-xs text-[var(--text-muted)] truncate">
              {detail}{detail && recipes ? ' · ' : ''}
              {recipes && (recipe ? `${recipe.lines} ${recipe.lines === 1 ? 'ingrediente' : 'ingredienti'}` : <span className="text-amber-500">Senza ricetta</span>)}
            </span>)}
        </span>
      </span>
      <span className={`pointer-events-none relative text-right text-sm font-medium tabular-nums text-[var(--text-main)] ${dim}`}>{formatEuro(p.price || 0)}</span>

      {!selecting && (
        <div className="relative col-span-2 flex items-center justify-between gap-2 md:contents">
          <button type="button" onClick={() => onAvailability(p)} aria-label={`Disponibilità di ${p.name}: ${stateLabel(p)}`} title="Cambia la disponibilità"
            className={`relative h-8 coarse:h-10 px-3 md:w-28 md:justify-self-center md:text-center rounded-lg border text-xs font-medium whitespace-nowrap cursor-pointer hover:bg-[var(--bg-card)] transition-colors ${CHIP[mode]} ${dim}`}>{stateLabel(p)}</button>
          {recipes && (
            <button type="button" onClick={() => recipes.onOpen(p)} aria-label={`Ricetta di ${p.name}`} title={recipe ? 'Modifica la ricetta' : 'Scrivi la ricetta'}
              className={`${btn} relative !h-9 !px-3 text-xs md:justify-self-start ${recipe ? '' : '!border-[var(--accent)]/50 !text-[var(--accent)]'}`}>
              <ChefHat size={15} /> <span className="hidden sm:inline">{recipe ? 'Ricetta' : 'Aggiungi ricetta'}</span>
            </button>)}
          <div className="flex items-center gap-1 md:contents">
            <span title={hidden ? 'Nascosto: non compare nella cassa' : 'Visibile nella cassa'} className="relative flex items-center md:justify-center"><Switch checked={!hidden} onChange={() => onToggleVisible(p)} label={`Visibile: ${p.name}`} /></span>
            <button type="button" onClick={() => onDelete(p)} aria-label={`Elimina ${p.name}`} title="Elimina" className={`${iconBtn} relative hover:!text-red-500 hover:!bg-red-500/10`}><Trash2 size={16} /></button>
          </div>
        </div>
      )}
    </li>
  );
};

export default CatalogRow;
