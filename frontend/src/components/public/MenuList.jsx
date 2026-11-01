import { useEffect, useRef } from 'react';
import { Plus, Minus } from 'lucide-react';
import Segmented from '../shared/Segmented';
import { btn, btnPrimary } from '../shared/styles';
import { formatEuro } from '../../utils/format';
import { useT, useEffectiveLanguage } from '../../i18n/useLanguage';
import { localName } from '../../utils/localName';
import { useAvoidedAllergens } from '../../i18n/useAvoidedAllergens';
import { allergensOf, conflicts, listText } from '../../utils/allergens';
import AllergenBar from './AllergenBar';

// Le due parti del menu che vedono i clienti, uguali nell'ordine da asporto e nel menu QR della sagra: le categorie (lo stesso
// selettore a segmenti del resto dell'app, che scorre ed è fermo in alto) e l'elenco dei prodotti con «Aggiungi» e, una volta scelto, meno e più.

export const CategoryChips = ({ categories, value, onChange }) => {
  const t = useT();
  const box = useRef(null);
  // La categoria scelta (o aperta da un link) si porta al centro della riga, se era fuori vista
  useEffect(() => { box.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' }); }, [value]);
  return (
    <div ref={box} className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-[var(--bg-main)]">
      <Segmented scroll label={t('menu.category')} value={value} onChange={onChange} options={categories.map(c => ({ id: c, label: c }))} />
    </div>
  );
};

// `quantities`: { [id prodotto]: quantità }; `onChange(id, ±1)`. Sotto il nome gli allergeni dichiarati; se il cliente ne evita alcuni, i prodotti che li
// contengono sono segnalati in evidenza. Con almeno un prodotto con allergeni compare in alto il pulsante «Allergie».
export const ProductRows = ({ products, quantities, onChange }) => {
  const t = useT();
  const lang = useEffectiveLanguage();
  const [avoid] = useAvoidedAllergens();
  const name = (id) => t(`allergen.${id}`);
  return (
    <div className="space-y-3">
      {products.some(p => allergensOf(p).length) && <AllergenBar />}
      <ul className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)] overflow-hidden bg-[var(--bg-card)]">
        {products.map(p => {
          const q = quantities[p.id] ?? 0;
          const shown = localName(p, lang);
          const present = allergensOf(p);
          const hit = conflicts(p, avoid);
          return (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block text-base font-medium leading-tight">{shown}</span>
                <span className="block text-sm text-[var(--text-muted)] tabular-nums mt-0.5">{formatEuro(p.price)}</span>
                {present.length > 0 && (
                  <span className={`block text-xs mt-1 leading-snug ${hit.length ? 'font-medium text-amber-600 dark:text-amber-400' : 'text-[var(--text-muted)]'}`}>
                    {hit.length ? `⚠ ${t('allergens.warn', { list: listText(hit, name) })}` : t('allergens.contains', { list: listText(present, name) })}
                  </span>
                )}
              </span>
              {q > 0 ? (
                <span className="flex items-center gap-1.5">
                  <button className={`${btn} !w-11 !px-0`} aria-label={t('menu.less', { name: shown })} onClick={() => onChange(p.id, -1)}><Minus size={18} /></button>
                  <span className="w-7 text-center text-lg font-semibold tabular-nums">{q}</span>
                  <button className={`${btnPrimary} !w-11 !px-0`} aria-label={t('menu.more', { name: shown })} onClick={() => onChange(p.id, 1)}><Plus size={18} /></button>
                </span>
              ) : <button className={`${btn} !h-11`} aria-label={t('menu.addNamed', { name: shown })} onClick={() => onChange(p.id, 1)}><Plus size={18} /> {t('menu.add')}</button>}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
