import { Trash2 } from 'lucide-react';
import QuantityInput from './QuantityInput';
import { iconBtnField, input, label } from '../smarteats/floor/ui';
import { VAT_RATES, rowAmounts, rowForIngredient, centsToEuroText } from './receipt';

const Field = ({ title, children, className = '' }) => (
  <label className={`block min-w-0 ${className}`}><span className={`${label} block mb-1`}>{title}</span>{children}</label>
);

// Una riga di carico o di listino: ingrediente, confezione, contenuto di una confezione, prezzo (senza IVA) e IVA. Nel carico c'è
// anche la quantità di confezioni arrivate, e in fondo il totale della riga. `supplierItems` precompila dal listino del fornitore.
const ReceiptLineRow = ({ row, ingredients, supplierItems = [], showQuantity = true, onChange, onRemove }) => {
  const ingredient = ingredients.find(i => i.id === Number(row.ingredient_id));
  const amounts = rowAmounts(row);
  return (
    <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card-2)] space-y-3">
      <div className="flex gap-2 items-end">
        <Field title="Ingrediente" className="flex-1">
          <select className={input} aria-label="Ingrediente" value={row.ingredient_id} onChange={e => onChange(rowForIngredient(row, e.target.value, ingredients, supplierItems))}>
            <option value="">Scegli…</option>
            {ingredients.filter(i => i.active).map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </Field>
        <Field title="Confezione" className="flex-1">
          <input className={input} aria-label="Confezione" placeholder="Es. Sacco da 25 kg" maxLength={40} value={row.purchase_unit_name} onChange={e => onChange({ ...row, purchase_unit_name: e.target.value })} />
        </Field>
        <button type="button" className={`${iconBtnField} hover:!text-red-500`} aria-label="Togli la riga" onClick={onRemove}><Trash2 size={16} /></button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-[1fr_1.4fr_1fr_0.8fr_auto] gap-2 items-end">
        {showQuantity && (
          <Field title="Confezioni arrivate"><input className={`${input} tabular-nums`} inputMode="decimal" aria-label="Confezioni arrivate" placeholder="0" value={row.quantity_text} onChange={e => onChange({ ...row, quantity_text: e.target.value })} /></Field>)}
        <Field title="Contenuto di una confezione">
          <QuantityInput baseUnit={ingredient?.base_unit ?? 'g'} label="Contenuto" text={row.content_text} unit={row.content_unit} onChange={({ text, unit }) => onChange({ ...row, content_text: text, content_unit: unit })} />
        </Field>
        <Field title="Prezzo a confezione (€, senza IVA)"><input className={`${input} tabular-nums`} inputMode="decimal" aria-label="Prezzo a confezione" placeholder="0,00" value={row.price_text} onChange={e => onChange({ ...row, price_text: e.target.value })} /></Field>
        <Field title="IVA">
          <select className={input} aria-label="IVA" value={row.vat} onChange={e => onChange({ ...row, vat: e.target.value })}>
            <option value="">—</option>
            {VAT_RATES.map(v => <option key={v} value={v}>{v}%</option>)}
          </select>
        </Field>
        {showQuantity && <p className="text-right tabular-nums text-sm text-[var(--text-muted)] col-span-2 lg:col-span-1 lg:w-24 pb-3">{amounts ? `${centsToEuroText(amounts.lineCents)} €` : ''}</p>}
      </div>
    </div>
  );
};

export default ReceiptLineRow;
