import { row } from '../smarteats/floor/ui';
import { formatCents, formatCostPerUnit, formatPercent } from './units';

// Gli acquisti nel report: quanto si è speso con ogni fornitore e quali prezzi sono cambiati rispetto al carico precedente.
// Importi senza IVA (l'IVA dei carichi si legge a parte). Le parti del report sul venduto stanno in ReportSections.jsx.

const Section = ({ title, hint, children }) => (
  <section className="space-y-2">
    <div><h3 className="text-sm font-semibold text-[var(--text-main)]">{title}</h3>{hint && <p className="text-xs text-[var(--text-muted)]">{hint}</p>}</div>
    {children}
  </section>
);

export const Spending = ({ spending }) => (
  <Section title="Acquisti per fornitore" hint="Merce arrivata nel periodo, senza IVA.">
    {spending.by_supplier.length === 0 ? <p className="py-3 text-sm text-[var(--text-muted)]">Nessun carico di merce in questo periodo.</p> : (
      <>
        <p className="text-sm text-[var(--text-main)]">Totale <b className="tabular-nums">{formatCents(spending.total_cents)}</b></p>
        <ul className="space-y-1.5">
          {spending.by_supplier.map(s => (
            <li key={s.supplier_id} className={`${row} flex items-center gap-3`}>
              <span className="flex-1 min-w-0 truncate text-[var(--text-main)]">{s.name} <span className="text-xs text-[var(--text-muted)]">· {s.receipts} {s.receipts === 1 ? 'carico' : 'carichi'}</span></span>
              <span className="text-xs text-[var(--text-muted)] tabular-nums hidden sm:block">IVA {formatCents(s.vat_cents)}</span>
              <span className="text-sm tabular-nums text-[var(--text-main)] w-24 text-right">{formatCents(s.net_cents)}</span>
            </li>))}
        </ul>
      </>)}
  </Section>
);

export const PriceChanges = ({ changes }) => (
  <Section title="Prezzi cambiati" hint="L'ultimo carico del periodo contro quello precedente dello stesso fornitore.">
    {changes.length === 0 ? <p className="py-3 text-sm text-[var(--text-muted)]">Nessun prezzo è cambiato.</p> : (
      <ul className="space-y-1.5">
        {changes.map(c => (
          <li key={`${c.ingredient_id}-${c.supplier_name}`} className={`${row} flex flex-wrap items-center gap-x-4 gap-y-1`}>
            <span className="flex-1 min-w-40 truncate text-[var(--text-main)]">{c.name} <span className="text-xs text-[var(--text-muted)]">· {c.supplier_name}</span></span>
            <span className="text-xs text-[var(--text-muted)] tabular-nums">{formatCostPerUnit(c.previous_per_unit, c.base_unit)} → {formatCostPerUnit(c.latest_per_unit, c.base_unit)}</span>
            <span className={`text-sm tabular-nums w-20 text-right ${c.change_percent > 0 ? 'text-red-500' : 'text-emerald-500'}`}>{c.change_percent > 0 ? '+' : ''}{formatPercent(c.change_percent)}</span>
          </li>))}
      </ul>)}
  </Section>
);
