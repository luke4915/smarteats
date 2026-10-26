import { Plus, Trash2 } from 'lucide-react';
import { btn, iconBtnField, input } from '../smarteats/floor/ui';
import Segmented from '../smarteats/floor/Segmented';
import QuantityInput from './QuantityInput';
import { blankRow, resolveRef, unitAfterChoosing } from './recipeLines';

// L'elenco delle righe di una ricetta: per ogni riga cosa si usa (un ingrediente o una preparazione) e quanto. Il genitore
// tiene `rows` (vedi recipeLines.js). Con `signed` ogni riga può aggiungere o togliere (le opzioni «extra» e «senza»).
const RecipeLinesEditor = ({ rows, onChange, ingredients, preparations = [], signed = false }) => {
  const update = (key, changes) => onChange(rows.map(r => (r.key === key ? { ...r, ...changes } : r)));
  const choose = (row, ref) => update(row.key, { ref, unit: unitAfterChoosing(ref, row.unit, ingredients, preparations) });
  const usable = (list) => list.filter(x => x.active !== false);

  return (
    <div className="space-y-2">
      {rows.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nessuna riga: aggiungi un ingrediente.</p>}
      {rows.map(row => {
        const target = row.ref ? resolveRef(row.ref, ingredients, preparations) : null;
        return (
          <div key={row.key} className="flex flex-wrap sm:flex-nowrap gap-2 items-start">
            {signed && (
              <Segmented label="Aggiunge o toglie" className="shrink-0" value={row.sign ?? 1} onChange={sign => update(row.key, { sign })} options={[{ id: 1, label: 'Aggiunge' }, { id: -1, label: 'Toglie' }]} />
            )}
            <select className={`${input} sm:flex-1`} aria-label="Ingrediente" value={row.ref} onChange={e => choose(row, e.target.value)}>
              <option value="">Scegli…</option>
              <optgroup label="Ingredienti">{usable(ingredients).map(i => <option key={`i${i.id}`} value={`i${i.id}`}>{i.name}</option>)}</optgroup>
              {preparations.length > 0 && <optgroup label="Preparazioni">{usable(preparations).map(p => <option key={`p${p.id}`} value={`p${p.id}`}>{p.name}</option>)}</optgroup>}
            </select>
            <QuantityInput className="sm:w-52" baseUnit={target?.base_unit ?? 'g'} label="Quantità" text={row.text} unit={row.unit} onChange={changes => update(row.key, changes)} />
            <button type="button" className={`${iconBtnField} hover:!text-red-500`} aria-label="Togli la riga" onClick={() => onChange(rows.filter(r => r.key !== row.key))}><Trash2 size={16} /></button>
          </div>
        );
      })}
      <button type="button" className={btn} onClick={() => onChange([...rows, { ...blankRow(), ...(signed && { sign: 1 }) }])}><Plus size={16} /> Aggiungi</button>
    </div>
  );
};

export default RecipeLinesEditor;
