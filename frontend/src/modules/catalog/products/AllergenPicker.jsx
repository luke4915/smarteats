import { ALLERGEN_IDS } from '../../../utils/allergens';
import { textIn } from '../../../i18n/useLanguage';

// La scelta degli allergeni di un prodotto: i 14 dell'allegato II del Regolamento UE 1169/2011, ognuno un pulsante acceso o spento. L'interfaccia
// del personale è in italiano, quindi i nomi sono sempre in italiano (i clienti li leggono nella loro lingua). `value`: i codici scelti.
const AllergenPicker = ({ value = [], onChange }) => {
  const toggle = (id) => onChange(ALLERGEN_IDS.filter(x => (x === id ? !value.includes(id) : value.includes(x))));
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Allergeni">
      {ALLERGEN_IDS.map(id => {
        const on = value.includes(id);
        return (
          <button key={id} type="button" aria-pressed={on} onClick={() => toggle(id)}
            className={`h-9 coarse:h-11 px-3 rounded-lg border text-sm transition-colors cursor-pointer ${on ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] font-medium' : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}>
            {textIn('it', `allergen.${id}`)}
          </button>
        );
      })}
    </div>
  );
};

export default AllergenPicker;
