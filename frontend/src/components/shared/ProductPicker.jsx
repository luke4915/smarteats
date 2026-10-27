import { useState, useMemo } from 'react';
import { Minus } from 'lucide-react';
import Segmented from '../../smarteats/floor/Segmented';
import SearchField from './SearchField';
import { useAuth } from '../../context/useAuth';
import { useAvailability } from '../../hooks/useAvailability';
import { useLongPress } from '../../hooks/useLongPress';
import { canForceSale, ingredientPortionsLeft, tighterLimit } from '../../inventory/availability';
import { normalizeText } from '../../smarteats/floor/checkMath';
import { formatEuro } from '../../utils/format';
import Loading from './Loading';

// La carta per fare un ordine: ricerca, categorie e tessere dei prodotti. È una sola in tutta l'app: la cassa delle sagre, la Sala
// (comanda al tavolo) e l'Asporto. Ogni tessera ha il pallino del colore della categoria (e una tinta appena accennata), la quantità
// già nell'ordine e «Esaurito» / «N rimasti» quando la scorta contata o gli ingredienti stanno finendo. Un prodotto finito per gli
// ingredienti lo aggiunge solo chi può venderlo comunque (amministratore e responsabile).
//   onAdd           tocco sulla tessera
//   onRemove        se c'è, la tessera con articoli nell'ordine ha un «−» per toglierne uno senza aprire il carrello
//   onLongPress     se c'è, tenere premuto 1,5 s apre la modifica rapida del prodotto (cassa)
//   lowStockAt      sotto quante porzioni rimaste compare «N rimasti»; scrollPadding: spazio in fondo alla griglia
// Va dentro un contenitore a colonna con altezza: la griglia scorre da sola. I prodotti nascosti non compaiono.
const ProductPicker = ({ products, cart, onAdd, onRemove, onLongPress, lowStockAt = 10, scrollPadding = 'pb-2' }) => {
  const { user } = useAuth();
  const portions = useAvailability();       // quante porzioni permettono gli ingredienti (vuoto senza magazzino con ricette)
  const canForce = canForceSale(user?.role);
  const press = useLongPress(onLongPress ?? (() => {}));
  const [category, setCategory] = useState('Tutti');
  const [search, setSearch] = useState('');

  const visible = useMemo(() => (products ?? []).filter(p => p.visible !== false), [products]);
  const categories = useMemo(() => ['Tutti', ...new Set(visible.map(p => p.category || 'Generico'))], [visible]);
  const shown = useMemo(() => {
    const words = normalizeText(search).trim().split(/\s+/).filter(Boolean);
    return visible.filter(p =>
      (category === 'Tutti' || (p.category || 'Generico') === category)
      && words.every(w => normalizeText(`${p.name} ${p.category || ''} ${p.price.toFixed(2)}`).includes(w)));
  }, [visible, category, search]);

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      <div className="pb-3 shrink-0">
        <SearchField value={search} onChange={setSearch} placeholder="Cerca prodotto..." label="Cerca prodotto" />
      </div>
      {categories.length > 2 && (
        <Segmented scroll label="Categoria" className="mb-3 shrink-0" value={category} onChange={setCategory} options={categories.map(c => ({ id: c, label: c }))} />)}

      <div className={`flex-1 overflow-y-auto no-scrollbar ${scrollPadding}`}>
        {!products && <Loading />}
        {products && !shown.length && <div className="flex items-center justify-center h-40 text-[var(--text-muted)]"><p className="text-sm">Nessun prodotto disponibile</p></div>}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2.5">
          {shown.map(p => {
            const inCart = (cart ?? []).filter(l => l.id === p.id).reduce((s, l) => s + l.quantity, 0);
            const countedLeft = p.stock_enabled && p.stock !== null ? p.stock - inCart : null;
            const remaining = tighterLimit(countedLeft, ingredientPortionsLeft(portions, p.id, inCart));
            const out = remaining !== null && remaining <= 0;
            const blocked = out && ((countedLeft !== null && countedLeft <= 0) || !canForce);   // scorta contata finita, o ingrediente finito e non si può forzare
            const color = p.color || 'var(--accent)';
            const pressed = press.progress(p.id);
            return (
              <div key={p.id} className="relative">
                <button disabled={blocked} {...(onLongPress ? press.bind(p.id, p) : {})}
                  onClick={() => { if (onLongPress && press.blocksClick(p.id)) return; onAdd(p); }}
                  style={{ backgroundColor: `color-mix(in srgb, ${color} 7%, var(--bg-card-2))` }}
                  className={`relative overflow-hidden w-full h-full min-h-[5.5rem] flex flex-col justify-between rounded-xl p-3 border border-[var(--border)] text-left select-none transition ${out ? `opacity-50 grayscale ${blocked ? 'cursor-not-allowed' : 'cursor-pointer'}` : 'hover:border-[var(--border-hover)] active:scale-[0.97] cursor-pointer'}`}>
                  {pressed > press.visibleAt && <span aria-hidden="true" className="absolute inset-y-0 left-0 pointer-events-none" style={{ width: `${pressed}%`, backgroundColor: color, opacity: 0.22 }} />}
                  <span className="flex items-start gap-2 text-[15px] font-semibold leading-tight text-[var(--text-main)] pr-7">
                    <span className="mt-[5px] w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} aria-hidden="true" />
                    <span className="line-clamp-3">{p.name}</span>
                  </span>
                  <span className="flex items-baseline justify-between gap-2 mt-2">
                    <span className="text-sm font-medium tabular-nums text-[var(--text-muted)]">{formatEuro(p.price)}</span>
                    {remaining !== null && remaining <= lowStockAt && <span className="text-xs font-semibold text-orange-500">{out ? 'Esaurito' : remaining === 1 ? 'Ultimo' : `${remaining} rimasti`}</span>}
                  </span>
                  {inCart > 0 && <span className="absolute top-2 right-2 min-w-6 h-6 px-1.5 rounded-full bg-[var(--accent)] text-white text-xs font-semibold flex items-center justify-center tabular-nums">{inCart}</span>}
                </button>
                {onRemove && inCart > 0 && (
                  <button aria-label={`Una in meno: ${p.name}`} onClick={() => onRemove(p)}
                    className="absolute bottom-1.5 right-1.5 w-9 h-9 coarse:w-10 coarse:h-10 rounded-full border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-main)] flex items-center justify-center active:scale-90 transition cursor-pointer"><Minus size={16} /></button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ProductPicker;
