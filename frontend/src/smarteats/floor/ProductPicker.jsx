import { useState, useMemo } from 'react';
import Segmented from './Segmented';
import SearchField from '../../components/shared/SearchField';
import { useAuth } from '../../context/useAuth';
import { useAvailability } from '../../hooks/useAvailability';
import { canForceSale, ingredientPortionsLeft, tighterLimit } from '../../inventory/availability';
import { formatEuro, normalizeText } from './checkMath';

// La carta per fare un ordine: ricerca, categorie e tessere dei prodotti. È la stessa in Sala (comanda al tavolo) e in Asporto
// (ordine al banco o al telefono): una sola carta, un solo modo di scegliere. Ogni tessera ha il pallino del colore della categoria, la
// quantità già nell'ordine e «Esaurito» / «N rimasti» quando la scorta contata o gli ingredienti stanno finendo. Un prodotto finito per
// gli ingredienti lo aggiunge solo chi può venderlo comunque (amministratore e responsabile).
// Va dentro un contenitore a colonna con altezza: la griglia scorre da sola.
const ProductPicker = ({ products, cart, onAdd }) => {
  const { user } = useAuth();
  const portions = useAvailability();
  const canForce = canForceSale(user?.role);
  const [category, setCategory] = useState('Tutti');
  const [search, setSearch] = useState('');

  const categories = useMemo(() => ['Tutti', ...new Set((products ?? []).map(p => p.category || 'Generico'))], [products]);
  const shown = useMemo(() => {
    const words = normalizeText(search).trim().split(/\s+/).filter(Boolean);
    return (products ?? []).filter(p =>
      (category === 'Tutti' || (p.category || 'Generico') === category)
      && words.every(w => normalizeText(`${p.name} ${p.category || ''} ${p.price.toFixed(2)}`).includes(w)));
  }, [products, category, search]);

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      <div className="pb-3 shrink-0">
        <SearchField value={search} onChange={setSearch} placeholder="Cerca prodotto..." label="Cerca prodotto" />
      </div>
      {categories.length > 2 && (
        <Segmented scroll label="Categoria" className="mb-3 shrink-0" value={category} onChange={setCategory} options={categories.map(c => ({ id: c, label: c }))} />)}

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {!products && <p className="text-[var(--text-muted)] text-sm">Caricamento carta…</p>}
        {products && !shown.length && <div className="flex items-center justify-center h-40 text-[var(--text-muted)]"><p className="font-semibold text-xs">Nessun prodotto disponibile</p></div>}
        <div className="grid grid-cols-2 sm:grid-cols-3 2xl:grid-cols-4 gap-3">
          {shown.map(p => {
            const inCart = cart.filter(l => l.id === p.id).reduce((s, l) => s + l.quantity, 0);
            const countedLeft = p.stock_enabled && p.stock !== null ? p.stock - inCart : null;
            const remaining = tighterLimit(countedLeft, ingredientPortionsLeft(portions, p.id, inCart));
            const out = remaining !== null && remaining <= 0;
            const blocked = out && ((countedLeft !== null && countedLeft <= 0) || !canForce);   // scorta contata finita, o ingrediente finito e non si può forzare
            const color = p.color || 'var(--accent)';
            return (
              <button key={p.id} disabled={blocked} onClick={() => onAdd(p)}
                className={`relative flex flex-col justify-between rounded-lg p-3 min-h-[84px] border border-[var(--border)] bg-[var(--bg-card-2)] text-left select-none transition ${out ? `opacity-50 grayscale ${blocked ? 'cursor-not-allowed' : 'cursor-pointer'}` : 'hover:border-[var(--border-hover)] active:scale-[0.98] cursor-pointer'}`}>
                <span className="flex items-start gap-2 font-medium text-sm leading-tight text-[var(--text-main)] pr-6"><span className="mt-1 w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} aria-hidden="true" />{p.name}</span>
                <span className="flex items-baseline justify-between w-full mt-2">
                  <span className="text-xs font-semibold tabular-nums text-[var(--text-muted)]">{formatEuro(p.price)}</span>
                  {remaining !== null && remaining <= 10 && <span className="text-xs font-semibold text-orange-500">{out ? 'Esaurito' : `${remaining} rimasti`}</span>}
                </span>
                {inCart > 0 && <span className="absolute top-2 right-2 min-w-5 h-5 px-1 rounded-full bg-[var(--accent)] text-white text-xs font-semibold flex items-center justify-center tabular-nums">{inCart}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ProductPicker;
