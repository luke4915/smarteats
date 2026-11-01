import { useState, useEffect } from 'react';
import { fetchWithAuth } from '../../utils/apiClient';
import { useToast } from '../../context/useToast';
import { formatCents } from '../../utils/format';
import { input } from '../../components/shared/styles';
import Segmented from '../../components/shared/Segmented';
import ChartCard from '../../components/shared/statistics/ChartCard';
import Loading from '../../components/shared/Loading';
import { PageBody, PageHeader } from '../../components/shared/PageHeader';
import MatrixChart from './MatrixChart';
import { GROUPS, valueLabel, valueNote, itemsOf, groupShare } from './matrixData';

// La matrice del menu (menu engineering): quali prodotti sono i punti di forza e quali vanno rivisti. Uguale per sagre e ristoranti: dove ci
// sono le ricette nel Magazzino conta il margine, altrimenti il prezzo (e lo dice). Si guarda su tutte le serate o su una.
const dateLabel = (iso) => new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });

const MenuMatrix = () => {
  const { showToast } = useToast();
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState('');
  const [matrix, setMatrix] = useState(null);
  const [view, setView] = useState('groups');

  useEffect(() => { fetchWithAuth('/sessions').then(setSessions).catch(err => showToast(err.message, 'error')); }, [showToast]);
  useEffect(() => {
    let cancelled = false;
    setMatrix(null);
    fetchWithAuth(`/stats/menu-matrix${sessionId ? `?sessions=${sessionId}` : ''}`)
      .then(m => { if (!cancelled) setMatrix(m); }).catch(err => { if (!cancelled) showToast(err.message, 'error'); });
    return () => { cancelled = true; };
  }, [sessionId, showToast]);

  return (
    <PageBody>
      <PageHeader title="Matrice del menu" subtitle="Cosa vale la pena tenere in evidenza e cosa rivedere.">
        <select className={`${input} !w-64`} aria-label="Periodo" value={sessionId} onChange={e => setSessionId(e.target.value)}>
          <option value="">Tutte le serate</option>
          {sessions.map(s => <option key={s.id} value={s.id}>{s.name || 'Senza nome'} · {dateLabel(s.start_time)}</option>)}
        </select>
      </PageHeader>

      {!matrix && <Loading />}
      {matrix && !matrix.enough && <p className="text-sm text-[var(--text-muted)] py-4">Servono almeno quattro prodotti venduti per dividerli in gruppi.</p>}
      {matrix?.enough && (
        <>
          <p className="text-sm text-[var(--text-muted)]">Ogni prodotto è giudicato su quanto si vende e su quanto rende a ogni pezzo ({valueLabel(matrix.mode).toLowerCase()}). {valueNote(matrix.mode)}</p>
          <Segmented label="Vista" className="w-fit" value={view} onChange={setView} options={[{ id: 'groups', label: 'Per gruppo' }, { id: 'chart', label: 'Grafico' }, { id: 'table', label: 'Tabella' }]} />

          {view === 'groups' && (
            <div className="grid gap-4 md:grid-cols-2">
              {GROUPS.map(g => {
                const list = itemsOf(matrix.items, g.id);
                return (
                  <ChartCard key={g.id} title={g.title} action={<span className="text-xs tabular-nums text-[var(--text-muted)]">{list.length} · {groupShare(matrix.items, g.id).toLocaleString('it-IT')} % delle vendite</span>}>
                    <p className="text-sm text-[var(--text-muted)] mb-3">{g.note}. {g.advice}</p>
                    {list.length === 0 ? <p className="text-sm text-[var(--text-muted)]">Nessun prodotto.</p> : (
                      <ul className="divide-y divide-[var(--border)]">
                        {list.map(i => (
                          <li key={i.id} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
                            <span className="min-w-0 truncate text-[var(--text-main)]">{i.name}</span>
                            <span className="shrink-0 tabular-nums text-[var(--text-muted)]">{i.quantity} pz · {formatCents(i.valueCents)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </ChartCard>
                );
              })}
            </div>
          )}
          {view === 'chart' && <ChartCard title="Vendite e rendimento"><MatrixChart matrix={matrix} /></ChartCard>}
          {view === 'table' && (
            <ChartCard title="Tutti i prodotti">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-[var(--text-muted)]"><th className="py-1.5 font-medium">Prodotto</th><th className="font-medium text-right">Pezzi</th><th className="font-medium text-right">Quota</th><th className="font-medium text-right">{valueLabel(matrix.mode)}</th><th className="font-medium pl-4 hidden sm:table-cell">Gruppo</th></tr></thead>
                <tbody className="tabular-nums text-[var(--text-main)]">
                  {matrix.items.map(i => (
                    <tr key={i.id} className="border-t border-[var(--border)]"><td className="py-1.5 pr-2 max-w-48 truncate">{i.name}</td><td className="text-right">{i.quantity}</td><td className="text-right">{i.share.toLocaleString('it-IT')} %</td><td className="text-right">{formatCents(i.valueCents)}</td><td className="pl-4 hidden sm:table-cell text-[var(--text-muted)]">{GROUPS.find(g => g.id === i.klass).title}</td></tr>
                  ))}
                </tbody>
              </table>
            </ChartCard>
          )}
          {matrix.unclassified.length > 0 && <p className="text-xs text-[var(--text-muted)]">Senza ricetta e quindi senza margine, non classificati: {matrix.unclassified.map(u => u.name).join(', ')}.</p>}
        </>
      )}
    </PageBody>
  );
};

export default MenuMatrix;
