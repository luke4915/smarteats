import { useState } from 'react';
import Segmented from '../../components/shared/Segmented';
import SearchField from '../../components/shared/SearchField';
import { btn } from '../../components/shared/styles';
import { formatEuro } from '../../utils/format';
import { change, percentText, rankProducts } from './compareData';

// Ogni prodotto delle due serate affiancato: quanto in A, quanto in B e di quanto è cambiato (barra che parte dal centro: a destra è salito,
// a sinistra è sceso). Di partenza i prodotti che sono cambiati di più; a richiesta i più venduti. In quantità o in incasso.
const SHOWN = 10;
const value = (metric, v) => (metric === 'qty' ? `${v}` : formatEuro(v));

const CompareProducts = ({ products, nameA, nameB }) => {
  const [metric, setMetric] = useState('qty');
  const [order, setOrder] = useState('change');
  const [query, setQuery] = useState('');
  const [all, setAll] = useState(false);

  const ranked = rankProducts(products, { metric, order, query });
  const rows = all || query ? ranked : ranked.slice(0, SHOWN);
  const maxDelta = Math.max(1, ...ranked.map(p => Math.abs(p.delta)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchField className="w-full sm:w-56" value={query} onChange={setQuery} placeholder="Cerca un prodotto" />
        <Segmented label="Cosa confrontare" value={metric} onChange={setMetric} options={[{ id: 'qty', label: 'Quantità' }, { id: 'revenue', label: 'Incasso' }]} />
        <Segmented label="Ordine" value={order} onChange={setOrder} options={[{ id: 'change', label: 'Più cambiati' }, { id: 'best', label: 'Più venduti' }]} />
      </div>
      {rows.length === 0 ? <p className="text-sm text-[var(--text-muted)] py-4">{query ? `Nessun prodotto con «${query.trim()}».` : 'Nessun prodotto venduto nelle due serate.'}</p> : (
        <ul className="divide-y divide-[var(--border)]">
          <li className="hidden sm:grid grid-cols-[minmax(0,1fr)_5rem_5rem_minmax(8rem,12rem)_4.5rem] gap-3 pb-2 text-xs text-[var(--text-muted)]" aria-hidden="true">
            <span>Prodotto</span><span className="text-right truncate">{nameA}</span><span className="text-right truncate">{nameB}</span><span /><span className="text-right">Variazione</span>
          </li>
          {rows.map(p => {
            const c = change(p.valueA, p.valueB);
            return (
              <li key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_5rem_5rem_minmax(8rem,12rem)_4.5rem] items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="block truncate text-[var(--text-main)]">{p.name}</span>
                  {p.status !== 'both' && <span className="text-xs text-[var(--text-muted)]">{p.status === 'new' ? `Solo in ${nameB}` : `Non c'era in ${nameB}`}</span>}
                </span>
                <span className="sm:hidden text-right tabular-nums text-[var(--text-main)]">{percentText(c)}</span>
                <span className="col-span-2 sm:col-span-1 sm:text-right tabular-nums text-[var(--text-muted)]"><span className="sm:hidden">{nameA}: </span>{value(metric, p.valueA)}</span>
                <span className="col-span-2 sm:col-span-1 sm:text-right tabular-nums text-[var(--text-main)]"><span className="sm:hidden text-[var(--text-muted)]">{nameB}: </span>{value(metric, p.valueB)}</span>
                <span className="hidden sm:block relative h-2 rounded-full bg-[var(--bg-card-2)]" aria-hidden="true">
                  <span className="absolute inset-y-0 left-1/2 w-px bg-[var(--border-hover)]" />
                  <span className={`absolute inset-y-0 rounded-sm ${c.direction === 'down' ? 'bg-[var(--text-muted)]/50 right-1/2' : 'bg-[var(--accent)] left-1/2'}`} style={{ width: `${(Math.abs(p.delta) / maxDelta) * 50}%` }} />
                </span>
                <span className="hidden sm:block text-right tabular-nums text-[var(--text-main)]">{percentText(c)}</span>
              </li>
            );
          })}
        </ul>
      )}
      {!query && ranked.length > SHOWN && <button type="button" className={btn} onClick={() => setAll(v => !v)}>{all ? 'Mostra meno' : `Mostra tutti (${ranked.length})`}</button>}
    </div>
  );
};

export default CompareProducts;
