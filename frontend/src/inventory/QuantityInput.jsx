import { input } from '../smarteats/floor/ui';
import { unitsFor } from './units';

// Una quantità con la sua unità: si scrive «1,5» e si sceglie «kg». Il genitore tiene `text` e `unit`; al server arriva sempre
// nell'unità di base (vedi recipeLines.js). `baseUnit` decide quali unità si possono scegliere.
const QuantityInput = ({ baseUnit, text, unit, onChange, label, className = '' }) => {
  const units = unitsFor(baseUnit);
  return (
    <div className={`flex gap-2 ${className}`}>
      <input className={`${input} tabular-nums`} inputMode="decimal" aria-label={label} placeholder="0" value={text} onChange={e => onChange({ text: e.target.value, unit })} />
      <select className={`${input} !w-24 shrink-0`} aria-label={`Unità di ${label}`} value={unit} onChange={e => onChange({ text, unit: e.target.value })} disabled={units.length < 2}>
        {units.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
      </select>
    </div>
  );
};

export default QuantityInput;
