import { row } from '../smarteats/floor/ui';
import { formatCents, formatPercent, formatQuantity } from './units';
import { reasonText, differenceText } from './controls';

// Le parti del report del magazzino. Ogni sezione riceve già i numeri dal server (centesimi interi): qui si impaginano soltanto.

const Card = ({ title, value, hint }) => (
  <div className={`${row} !py-3`}>
    <span className="block text-xs text-[var(--text-muted)]">{title}</span>
    <span className="block text-xl font-semibold tabular-nums text-[var(--text-main)]">{value}</span>
    {hint && <span className="block text-xs text-[var(--text-muted)]">{hint}</span>}
  </div>
);

const Section = ({ title, hint, children }) => (
  <section className="space-y-2">
    <div><h3 className="text-sm font-semibold text-[var(--text-main)]">{title}</h3>{hint && <p className="text-xs text-[var(--text-muted)]">{hint}</p>}</div>
    {children}
  </section>
);

// I quattro numeri in alto. Il food cost è il costo degli ingredienti sul ricavo senza IVA, solo per i piatti con ricetta.
export const Overview = ({ totals, inventoryValueCents }) => (
  <div className="space-y-2">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Card title="Ricavo senza IVA" value={formatCents(totals.net_cents)} />
      <Card title="Costo degli ingredienti" value={formatCents(totals.cost_cents)} />
      <Card title="Margine" value={formatCents(totals.margin_cents)} />
      <Card title="Food cost" value={formatPercent(totals.food_cost_percent)} hint={totals.recipe_coverage_percent === null ? undefined : `Sul ${formatPercent(totals.recipe_coverage_percent)} del ricavo (quello con ricetta)`} />
    </div>
    <p className="text-sm text-[var(--text-muted)]">In dispensa adesso: <b className="tabular-nums text-[var(--text-main)]">{formatCents(inventoryValueCents)}</b> di merce.</p>
  </div>
);

export const Dishes = ({ dishes, dish }) => (
  <Section title={`Per ${dish}`} hint="Ricavo senza IVA, costo teorico dalla ricetta e margine.">
    {dishes.length === 0 && <p className="py-6 text-center text-sm text-[var(--text-muted)]">Nessuna vendita in questo periodo.</p>}
    <ul className="space-y-1.5">
      {dishes.map(d => (
        <li key={d.product_id} className={`${row} flex flex-wrap items-center gap-x-4 gap-y-1`}>
          <span className="flex-1 min-w-40"><span className="block truncate font-medium text-[var(--text-main)]">{d.name}</span>
            <span className="block text-xs text-[var(--text-muted)]">{d.quantity} venduti · IVA {d.vat_rate}%</span></span>
          <span className="text-sm tabular-nums text-[var(--text-main)] w-24 text-right">{formatCents(d.net_cents)}</span>
          {d.has_recipe
            ? <><span className="text-sm tabular-nums text-[var(--text-muted)] w-24 text-right">costo {formatCents(d.cost_cents)}</span>
              <span className="text-sm tabular-nums text-[var(--text-main)] w-24 text-right">{formatCents(d.margin_cents)}</span>
              <span className="text-sm tabular-nums text-[var(--text-muted)] w-16 text-right">{formatPercent(d.food_cost_percent)}</span></>
            : <span className="text-xs text-amber-500 sm:w-64 sm:text-right">Senza ricetta: costo non calcolabile</span>}
        </li>))}
    </ul>
  </Section>
);

export const Waste = ({ waste }) => (
  <Section title="Scarti" hint="Ciò che è stato buttato o regalato, al costo del momento.">
    {waste.items.length === 0 ? <p className="py-3 text-sm text-[var(--text-muted)]">Nessuno scarto registrato.</p> : (
      <>
        <p className="text-sm text-[var(--text-main)]">Totale <b className="tabular-nums">{formatCents(waste.total_cents)}</b>{waste.by_reason.length > 1 && ` · ${waste.by_reason.map(r => `${reasonText(r.reason)} ${formatCents(r.value_cents)}`).join(' · ')}`}</p>
        <ul className="space-y-1.5">
          {waste.items.map(i => (
            <li key={`${i.reason}-${i.ingredient_id}`} className={`${row} flex items-center gap-3`}>
              <span className="flex-1 min-w-0 truncate text-[var(--text-main)]">{i.name} <span className="text-xs text-[var(--text-muted)]">· {reasonText(i.reason)}</span></span>
              <span className="text-sm tabular-nums text-[var(--text-muted)]">{formatQuantity(i.quantity, i.base_unit)}</span>
              <span className="text-sm tabular-nums text-[var(--text-main)] w-20 text-right">{formatCents(i.value_cents)}</span>
            </li>))}
        </ul>
      </>)}
  </Section>
);

export const Variance = ({ variance, totalCents }) => (
  <Section title="Previsto e contato" hint="Per gli ingredienti contati nei controlli: la differenza tra il registro e la dispensa reale.">
    {variance.length === 0 ? <p className="py-3 text-sm text-[var(--text-muted)]">Nessun controllo in questo periodo.</p> : (
      <>
        <p className="text-sm text-[var(--text-main)]">Valore delle differenze <b className="tabular-nums">{formatCents(totalCents)}</b></p>
        <ul className="space-y-1.5">
          {variance.map(v => (
            <li key={v.ingredient_id} className={`${row} flex flex-wrap items-center gap-x-4 gap-y-1`}>
              <span className="flex-1 min-w-40 truncate text-[var(--text-main)]">{v.name}</span>
              <span className="text-xs text-[var(--text-muted)] tabular-nums">usati in teoria {formatQuantity(v.theoretical_used, v.base_unit)}</span>
              <span className={`text-sm tabular-nums w-36 text-right ${v.difference < 0 ? 'text-red-500' : 'text-amber-500'}`}>{differenceText(v.difference, v.base_unit)}</span>
              <span className="text-sm tabular-nums text-[var(--text-main)] w-20 text-right">{formatCents(v.difference_value_cents)}</span>
            </li>))}
        </ul>
      </>)}
  </Section>
);
