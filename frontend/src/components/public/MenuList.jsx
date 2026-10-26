import { Plus, Minus } from 'lucide-react';
import ScrollRow from '../shared/ScrollRow';
import { btn, btnPrimary } from '../../smarteats/floor/ui';
import { formatEuro } from '../../utils/format';

// Le due parti del menu che vedono i clienti, uguali nell'ordine da asporto e nel menu QR della sagra: le categorie (pillole che
// scorrono, ferme in alto) e l'elenco dei prodotti con «Aggiungi» e, una volta scelto, meno e più.

export const CategoryChips = ({ categories, value, onChange }) => (
  <ScrollRow className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-[var(--bg-main)] flex gap-1.5" role="tablist" aria-label="Categoria">
    {categories.map(c => (
      <button key={c} role="tab" aria-selected={value === c} onClick={() => onChange(c)}
        className={`h-10 px-4 rounded-full text-sm font-medium whitespace-nowrap border cursor-pointer ${value === c ? 'bg-[var(--accent)] border-[var(--accent)] text-white' : 'border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-muted)]'}`}>{c}</button>
    ))}
  </ScrollRow>
);

// `quantities`: { [id prodotto]: quantità }; `onChange(id, ±1)`.
export const ProductRows = ({ products, quantities, onChange }) => (
  <ul className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)] overflow-hidden bg-[var(--bg-card)]">
    {products.map(p => {
      const q = quantities[p.id] ?? 0;
      return (
        <li key={p.id} className="flex items-center gap-3 px-4 py-3">
          <span className="min-w-0 flex-1">
            <span className="block text-base font-medium leading-tight">{p.name}</span>
            <span className="block text-sm text-[var(--text-muted)] tabular-nums mt-0.5">{formatEuro(p.price)}</span>
          </span>
          {q > 0 ? (
            <span className="flex items-center gap-1.5">
              <button className={`${btn} !w-11 !px-0`} aria-label={`Una in meno: ${p.name}`} onClick={() => onChange(p.id, -1)}><Minus size={18} /></button>
              <span className="w-7 text-center text-lg font-semibold tabular-nums">{q}</span>
              <button className={`${btnPrimary} !w-11 !px-0`} aria-label={`Una in più: ${p.name}`} onClick={() => onChange(p.id, 1)}><Plus size={18} /></button>
            </span>
          ) : <button className={`${btn} !h-11`} aria-label={`Aggiungi ${p.name}`} onClick={() => onChange(p.id, 1)}><Plus size={18} /> Aggiungi</button>}
        </li>
      );
    })}
  </ul>
);
