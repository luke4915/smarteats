import { barPercent } from '../../smarteats/statistiche/chartData';

// I grafici comuni a sagre e ristoranti: una sola serie nel colore d'accento, barre sottili, valore al passaggio del
// mouse (o del dito). Sono gli stessi in tutte le statistiche, così i due prodotti si riconoscono.

// Barre orizzontali: etichetta a sinistra, valore a destra.
export const HBars = ({ rows, valueOf, format = (v) => v, hint }) => {
  const max = Math.max(0, ...rows.map(valueOf));
  return (
    <ul className="space-y-2.5">
      {rows.map(row => (
        <li key={row.key} title={hint?.(row)} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate text-[var(--text-main)]">{row.label}</span>
          <span className="h-2 rounded-full bg-[var(--bg-card-2)]" aria-hidden="true">
            <span className="block h-2 rounded-r-full rounded-l-sm bg-[var(--accent)]" style={{ width: `${barPercent(valueOf(row), max)}%` }} />
          </span>
          <span className="tabular-nums text-[var(--text-muted)] w-20 text-right">{format(valueOf(row))}</span>
        </li>
      ))}
    </ul>
  );
};

// Barre verticali (per ora): `items` = [{ key, label, value }]; `format` scrive il valore nel suggerimento.
export const Columns = ({ items, format = (v) => v, peak, ariaLabel }) => {
  const max = Math.max(0, ...items.map(i => i.value));
  return (
    <div>
      <div className="relative h-40 flex items-end gap-1.5 border-b border-[var(--border)]" role="img" aria-label={ariaLabel}>
        {[25, 50, 75].map(g => <span key={g} className="absolute inset-x-0 border-t border-[var(--border)]/50 pointer-events-none" style={{ bottom: `${g}%` }} aria-hidden="true" />)}
        {items.map(i => (
          <div key={i.key} className="group relative flex-1 min-w-0 h-full flex items-end justify-center">
            <span className={`w-full max-w-6 rounded-t-md transition-colors ${i.key === peak ? 'bg-[var(--accent)]' : 'bg-[var(--accent)]/45 group-hover:bg-[var(--accent)]'}`}
              style={{ height: `${barPercent(i.value, max)}%` }} />
            <span className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 whitespace-nowrap rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-xs shadow-lg">
              <span className="block font-semibold text-[var(--text-main)]">{i.label}</span>
              <span className="block text-[var(--text-muted)] tabular-nums">{format(i.value)}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 pt-1.5">
        {items.map((i, n) => <span key={i.key} className="flex-1 min-w-0 text-center text-xs text-[var(--text-muted)] tabular-nums">{items.length > 12 && n % 2 ? '' : i.short ?? i.label}</span>)}
      </div>
    </div>
  );
};
