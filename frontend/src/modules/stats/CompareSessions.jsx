import { useState, useEffect } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { fetchWithAuth } from '../../utils/apiClient';
import { useToast } from '../../context/useToast';
import { useAuth } from '../../context/useAuth';
import { termsFor } from '../../utils/terms';
import { formatEuro, formatMin } from '../../utils/format';
import { iconBtnField, select } from '../../components/shared/styles';
import Segmented from '../../components/shared/Segmented';
import StatCard from '../../components/shared/statistics/StatCard';
import ChartCard from '../../components/shared/statistics/ChartCard';
import Loading from '../../components/shared/Loading';
import { PageBody, PageHeader } from '../../components/shared/PageHeader';
import CompareHours, { CompareHoursTable } from './CompareHours';
import CompareProducts from './CompareProducts';
import { change, percentText, defaultPair } from './compareData';

// Il confronto tra due serate (o servizi): si scelgono A (di riferimento) e B, e si vede di quanto cambiano incasso, ordini, importo medio
// e tempi, ora per ora e prodotto per prodotto. Le due serate di partenza sono le ultime concluse. Per sagre e ristoranti è la stessa pagina.
const dateLabel = (iso) => new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
const label = (s) => `${s.name || 'Senza nome'} · ${dateLabel(s.start_time)}`;
const shortName = (side) => side.name || dateLabel(side.startTime);

// Una cifra di B con sotto il confronto con A. `invert`: per il tempo, meno è meglio.
const Figure = ({ title, format, a, b, invert = false }) => {
  if (a === null || b === null) return <StatCard label={title} value={b === null ? '—' : format(b)} sub="Tempo non registrato in una delle due" />;
  const c = change(a, b);
  const good = invert ? c.direction === 'down' : c.direction === 'up';
  return (
    <div className="bg-[var(--bg-card)] rounded-xl p-4 border border-[var(--border)]">
      <p className="text-xs text-[var(--text-muted)]">{title}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--text-main)] truncate">{format(b)}</p>
      <p className="mt-0.5 text-xs tabular-nums text-[var(--text-muted)]">
        <span className={c.direction === 'flat' ? '' : good ? 'text-[var(--accent)] font-medium' : 'text-red-500 font-medium'}>{c.direction === 'up' ? '↑' : c.direction === 'down' ? '↓' : ''} {percentText(c)}</span> · prima {format(a)}
      </p>
    </div>
  );
};

const CompareSessions = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const terms = termsFor(user?.businessType);
  const [sessions, setSessions] = useState(null);
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [data, setData] = useState(null);
  const [metric, setMetric] = useState('revenue');
  const [asTable, setAsTable] = useState(false);

  useEffect(() => {
    fetchWithAuth('/sessions').then(list => {
      setSessions(list);
      const pair = defaultPair(list);
      if (pair) { setA(String(pair.a)); setB(String(pair.b)); }
    }).catch(err => { setSessions([]); showToast(err.message, 'error'); });
  }, [showToast]);

  useEffect(() => {
    if (!a || !b || a === b) { setData(null); return undefined; }
    let cancelled = false;
    setData(null);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    fetchWithAuth(`/stats/compare?${new URLSearchParams({ a, b, tz })}`)
      .then(r => { if (!cancelled) setData(r); }).catch(err => { if (!cancelled) showToast(err.message, 'error'); });
    return () => { cancelled = true; };
  }, [a, b, showToast]);

  const header = <PageHeader title={`Confronto tra ${terms.unit === 'serata' ? 'serate' : 'servizi'}`} subtitle="Cosa è cambiato da una all'altra." />;
  if (!sessions) return <PageBody>{header}<Loading /></PageBody>;
  if (sessions.length < 2) return <PageBody>{header}<p className="text-sm text-[var(--text-muted)] py-4">Servono almeno due {terms.unit === 'serata' ? 'serate' : 'servizi'} per confrontarli.</p></PageBody>;

  return (
    <PageBody>
      {header}
      <ChartCard title={`Quali ${terms.unit === 'serata' ? 'serate' : 'servizi'}`}>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <label className="block"><span className="block text-xs text-[var(--text-muted)] mb-1">Di riferimento (A)</span>
            <select className={select} value={a} onChange={e => setA(e.target.value)}>{sessions.map(s => <option key={s.id} value={s.id}>{label(s)}</option>)}</select></label>
          <button type="button" className={`${iconBtnField} justify-self-center`} aria-label="Scambia A e B" title="Scambia" onClick={() => { setA(b); setB(a); }}><ArrowLeftRight size={18} /></button>
          <label className="block"><span className="block text-xs text-[var(--text-muted)] mb-1">Confrontata (B)</span>
            <select className={select} value={b} onChange={e => setB(e.target.value)}>{sessions.map(s => <option key={s.id} value={s.id}>{label(s)}</option>)}</select></label>
        </div>
        {a === b && <p className="mt-3 text-sm text-[var(--text-muted)]">Scegli due {terms.unit === 'serata' ? 'serate' : 'servizi'} diversi.</p>}
      </ChartCard>

      {a !== b && !data && <Loading />}
      {data && (() => {
        const nameA = shortName(data.a), nameB = shortName(data.b);
        return (
          <>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              <Figure title="Incasso" format={formatEuro} a={data.a.revenue} b={data.b.revenue} />
              <Figure title="Ordini" format={String} a={data.a.orders} b={data.b.orders} />
              <Figure title="Importo medio" format={formatEuro} a={data.a.avgOrder} b={data.b.avgOrder} />
              <Figure title="Tempo medio" format={formatMin} a={data.a.avgMinutes} b={data.b.avgMinutes} invert />
            </div>
            <ChartCard title="Ora per ora" action={(
              <div className="flex gap-2">
                <Segmented label="Cosa mostrare" value={metric} onChange={setMetric} options={[{ id: 'revenue', label: 'Incasso' }, { id: 'orders', label: 'Ordini' }]} />
                <Segmented label="Vista" value={asTable ? 'table' : 'chart'} onChange={id => setAsTable(id === 'table')} options={[{ id: 'chart', label: 'Grafico' }, { id: 'table', label: 'Tabella' }]} />
              </div>)}>
              {data.hours.length === 0 ? <p className="text-sm text-[var(--text-muted)] py-4">Nessun ordine nelle due serate.</p>
                : asTable ? <CompareHoursTable hours={data.hours} nameA={nameA} nameB={nameB} /> : <CompareHours hours={data.hours} metric={metric} nameA={nameA} nameB={nameB} />}
            </ChartCard>
            <ChartCard title="Prodotto per prodotto"><CompareProducts products={data.products} nameA={nameA} nameB={nameB} /></ChartCard>
          </>
        );
      })()}
    </PageBody>
  );
};

export default CompareSessions;
