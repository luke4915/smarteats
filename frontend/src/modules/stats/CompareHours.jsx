import { barPercent } from './chartData';
import { formatEuro } from '../../utils/format';

// L'andamento per ora delle due serate affiancato: per ogni ora due barre sottili, A in tinta spenta e B nel colore d'accento. Si legge
// anche come tabella (vedi `CompareSessions`). `hours` = [{ hour, a: { orders, revenue }, b: {…} }]; `metric` = 'revenue' | 'orders'.
const CompareHours = ({ hours, metric, nameA, nameB }) => {
  const max = Math.max(0, ...hours.flatMap(h => [h.a[metric], h.b[metric]]));
  const text = (v) => (metric === 'revenue' ? formatEuro(v) : `${v} ${v === 1 ? 'ordine' : 'ordini'}`);
  return (
    <div>
      <div className="flex items-center gap-4 mb-3 text-xs text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-[var(--text-muted)]/45" aria-hidden="true" />{nameA}</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-[var(--accent)]" aria-hidden="true" />{nameB}</span>
      </div>
      <div className="relative h-40 flex items-end gap-2 border-b border-[var(--border)]" role="img" aria-label={`${metric === 'revenue' ? 'Incasso' : 'Ordini'} per ora, ${nameA} contro ${nameB}`}>
        {[25, 50, 75].map(g => <span key={g} className="absolute inset-x-0 border-t border-[var(--border)]/50 pointer-events-none" style={{ bottom: `${g}%` }} aria-hidden="true" />)}
        {hours.map(h => (
          <div key={h.hour} className="group relative flex-1 min-w-0 h-full flex items-end justify-center gap-0.5">
            <span className="w-full max-w-3 rounded-t-sm bg-[var(--text-muted)]/45" style={{ height: `${barPercent(h.a[metric], max)}%` }} />
            <span className="w-full max-w-3 rounded-t-sm bg-[var(--accent)]" style={{ height: `${barPercent(h.b[metric], max)}%` }} />
            <span className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 whitespace-nowrap rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-2.5 py-1.5 text-xs shadow-lg">
              <span className="block font-semibold text-[var(--text-main)]">{String(h.hour).padStart(2, '0')}:00</span>
              <span className="block text-[var(--text-muted)] tabular-nums">{nameA}: {text(h.a[metric])}</span>
              <span className="block text-[var(--text-main)] tabular-nums">{nameB}: {text(h.b[metric])}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-1.5">
        {hours.map((h, n) => <span key={h.hour} className="flex-1 min-w-0 text-center text-xs text-[var(--text-muted)] tabular-nums">{hours.length > 10 && n % 2 ? '' : String(h.hour).padStart(2, '0')}</span>)}
      </div>
    </div>
  );
};

export const CompareHoursTable = ({ hours, nameA, nameB }) => (
  <table className="w-full text-sm">
    <thead><tr className="text-left text-xs text-[var(--text-muted)]"><th className="py-1.5 font-medium">Ora</th><th className="font-medium text-right">{nameA}</th><th className="font-medium text-right">{nameB}</th></tr></thead>
    <tbody className="tabular-nums text-[var(--text-main)]">
      {hours.map(h => (
        <tr key={h.hour} className="border-t border-[var(--border)]">
          <td className="py-1.5">{String(h.hour).padStart(2, '0')}:00</td>
          <td className="text-right">{formatEuro(h.a.revenue)} · {h.a.orders}</td>
          <td className="text-right">{formatEuro(h.b.revenue)} · {h.b.orders}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

export default CompareHours;
