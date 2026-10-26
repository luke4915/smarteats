import QuantityInput from './QuantityInput';
import { blankEntry } from './controls';
import { row } from '../smarteats/floor/ui';

// L'elenco degli ingredienti con un campo quantità per ciascuno: lo usano il controllo di magazzino (quanto ne conto) e lo scarico
// di fine servizio (quanto ne ho usato o ne è rimasto). `entries` è { idIngrediente: { text, unit } }; `note` scrive la riga
// sotto il nome (cosa c'era in dispensa, la differenza…).
const IngredientEntryList = ({ ingredients, entries, onChange, note }) => (
  <ul className="space-y-1.5">
    {ingredients.map(i => {
      const entry = entries[i.id] ?? blankEntry(i);
      return (
        <li key={i.id} className={`${row} flex flex-wrap items-center gap-x-3 gap-y-2`}>
          <span className="flex-1 min-w-40">
            <span className="block truncate font-medium text-[var(--text-main)]">{i.name}</span>
            <span className="block text-xs text-[var(--text-muted)] tabular-nums">{note(i, entry)}</span>
          </span>
          <QuantityInput className="w-48" label={i.name} baseUnit={i.base_unit} text={entry.text} unit={entry.unit} onChange={value => onChange(i.id, value)} />
        </li>
      );
    })}
  </ul>
);

export default IngredientEntryList;
