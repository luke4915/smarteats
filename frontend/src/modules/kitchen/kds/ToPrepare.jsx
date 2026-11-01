import { ChefHat } from 'lucide-react';
import { summarize } from './board';

// «Da preparare»: tutti i pezzi delle comande in coda sommati per piatto, dal più richiesto: serve a chi cuoce per lotti (venti panini
// insieme) senza leggere comanda per comanda.
const ToPrepare = ({ orders }) => {
  const rows = summarize(orders);
  return (
    <section aria-label="Da preparare" className="flex flex-col min-h-0">
      <h2 className="px-5 pt-4 pb-3 text-sm font-medium text-neutral-400">Da preparare</h2>
      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-neutral-600"><ChefHat size={36} /><p className="text-sm">Niente in coda</p></div>
      ) : (
        <ul className="flex-1 overflow-y-auto no-scrollbar px-3 pb-4 space-y-1.5">
          {rows.map(r => (
            <li key={r.key} className="flex items-center gap-3 rounded-xl bg-neutral-900 ring-1 ring-white/10 px-3 py-2.5">
              <span className="w-12 shrink-0 text-center text-3xl font-semibold tabular-nums text-white">{r.quantity}</span>
              <span className="min-w-0 text-lg leading-tight text-white">
                {r.name}
                {r.modifiers.length > 0 && <span className="block text-sm text-neutral-400">{r.modifiers.join(', ')}</span>}
                {r.note && <span className="block text-sm font-semibold text-amber-400">{r.note}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default ToPrepare;
