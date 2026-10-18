import React, { useState } from 'react';
import { Download, Check, FileText } from 'lucide-react';

import { fetchWithAuth } from '../../utils/apiClient';
import { useToast } from '../../context/useToast';
import StatCard from './statistics/StatCard';
import ChartCard from './statistics/ChartCard';
import { HBars, Columns } from './charts';
import { useStatistics, formatEuro, formatMin, activeHours, reorderHours } from './statistics/useStatistics';
import { exportStatsPdf } from './statistics/pdfExport';
import { useAuth } from '../../context/useAuth';
import { termsFor } from '../../utils/terms';
import { PageHeader, PageBody } from './PageHeader';
import Modal from './Modal';
import Segmented from '../../smarteats/floor/Segmented';
import { btn, iconBtn } from '../../smarteats/floor/ui';

// Le fasce orarie attive (da prima a ultima con valori), riordinate dalle 12:00 come nel resto dell'app.
const hourItems = (data, key) => activeHours(reorderHours(data), key).map(d => ({ key: d.ora, label: `${d.ora}`, short: String(d.ora).slice(0, 2), value: d[key] ?? 0 }));
const peakOf = (data, key) => activeHours(reorderHours(data), key).reduce((b, d) => (d[key] > (b?.[key] ?? 0) ? d : b), null)?.ora;

const Statistics = () => {
  const { showToast } = useToast();
  const { user } = useAuth();
  const terms = termsFor(user?.businessType);
  const {
    sessions, loading, error,
    selectedSessionIds, toggleSession, setSelectedSessionIds,
    stats, sortedTopProdotti, topProductsMetric, setTopProductsMetric,
    h2hProduct, setH2hProduct, h2hSessionA, setH2hSessionA, h2hSessionB, setH2hSessionB,
    availableProducts, h2hData, sessionAName, sessionBName,
  } = useStatistics(terms);

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const handleExportCSV = async (session) => {
    try {
      const res = await fetchWithAuth(`/exports/session/${session.id}/csv`, { raw: true });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${(session.name || `sessione_${session.id}`).replace(/[^a-z0-9]/gi, '_').toLowerCase()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setIsExportModalOpen(false);
    } catch (err) {
      showToast(`Impossibile scaricare il CSV: ${err.message}`, 'error');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-[var(--text-muted)]">
      <p className="text-sm">Caricamento…</p>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center h-64 text-red-500">
      <p className="text-sm">{error}</p>
    </div>
  );

  const closedSessions = sessions.filter(s => !!s.end_time);

  return (
    <PageBody>
      <PageHeader title="Statistiche" subtitle={selectedSessionIds.length > 0 ? `${selectedSessionIds.length} ${selectedSessionIds.length === 1 ? 'sessione selezionata' : 'sessioni selezionate'}` : 'Tutte le sessioni'}>
          <button onClick={() => setIsExportModalOpen(true)}
            className={btn}>
            <Download size={15} /> Esporta CSV
          </button>
          <button onClick={() => exportStatsPdf(stats, sessions, selectedSessionIds, terms)}
            className={btn}>
            <FileText size={15} /> Esporta PDF
          </button>
      </PageHeader>

      {sessions.length > 0 && (
        <ChartCard title={terms.filter}>
          <div className="flex flex-wrap gap-2">
            {sessions.map(s => {
              const selected = selectedSessionIds.includes(String(s.id));
              return (
                <button key={s.id} onClick={() => toggleSession(s.id)}
                  aria-pressed={selected}
                  className={`flex items-center gap-1.5 h-9 px-3 rounded-lg border text-sm font-medium transition-colors cursor-pointer ${selected
                    ? 'bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--accent)]'
                    : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}>
                  {selected && <Check size={14} />}
                  {s.name || new Date(s.start_time).toLocaleDateString('it-IT')}
                  {!s.end_time && <span className="text-xs opacity-70">in corso</span>}
                </button>
              );
            })}
            {selectedSessionIds.length > 0 && (
              <button onClick={() => setSelectedSessionIds([])}
                className="h-9 px-3 rounded-lg text-sm text-[var(--text-muted)] hover:text-red-500 transition-colors cursor-pointer">
                Rimuovi filtri
              </button>
            )}
          </div>
        </ChartCard>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        <StatCard label={terms.total} value={formatEuro(stats.totaleSerata)} />
        <StatCard label="Importo medio" value={formatEuro(stats.importoMedio)} />
        <StatCard label="Totale ordini" value={stats.numeroTotaleOrdini} />
        <StatCard label="Top prodotto" value={stats.prodottoPiuVenduto || '—'} />
        <StatCard label="Omaggi" value={formatEuro(stats.unrealizedGiftRevenue)} sub="Valore a listino dei prodotti regalati" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[var(--bg-card)] rounded-xl p-4 border border-[var(--border)] flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-[var(--text-muted)]">Ripartizione ordini</p>
            <p className="text-xl font-semibold text-[var(--text-main)] mt-1">
              {stats.pctTakeaway}% Asporto <span className="text-xs font-normal text-[var(--text-muted)]">({stats.takeawayCount} ordini)</span>
            </p>
          </div>
          <div className="text-right text-sm text-[var(--text-muted)]">
            In loco: <span className="text-[var(--text-main)]">{stats.eatInCount}</span>
          </div>
        </div>

        <div className="bg-[var(--bg-card)] rounded-xl p-4 border border-[var(--border)] flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-[var(--text-muted)]">Ordini annullati e storni</p>
            <p className="text-xl font-semibold tabular-nums text-red-500 mt-1">{formatEuro(stats.totaleStornato)}</p>
          </div>
          <div className="text-right text-sm text-[var(--text-muted)]">
            Conteggio: <span className="text-[var(--text-main)]">{stats.canceledCount} ordini</span>
          </div>
        </div>
      </div>

      {stats.numeroTotaleOrdini === 0 ? (
        <div className="flex items-center justify-center h-48 text-[var(--text-muted)]">
          <p className="text-sm">Nessun dato disponibile.</p>
        </div>
      ) : (
        <>
          {stats.incassoPerCategoria.length > 0 && (
            <ChartCard title="Incasso per categoria">
              <HBars rows={stats.incassoPerCategoria.map(c => ({ key: c.categoria, label: c.categoria, ...c }))} valueOf={r => r.totale} format={formatEuro} />
            </ChartCard>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            <ChartCard title="Ordini per fascia oraria">
              <Columns ariaLabel="Ordini per fascia oraria" items={hourItems(stats.ordiniPerFasciaOraria, 'count')} format={v => `${v} ${v === 1 ? 'ordine' : 'ordini'}`} peak={peakOf(stats.ordiniPerFasciaOraria, 'count')} />
            </ChartCard>
            <ChartCard title="Prezzo medio ordine per fascia oraria">
              <Columns ariaLabel="Prezzo medio per fascia oraria" items={hourItems(stats.prezzoMedioPerFasciaOraria, 'prezzoMedio')} format={formatEuro} />
            </ChartCard>
          </div>

          <ChartCard
            title="Prodotti più venduti"
            action={<Segmented label="Metrica" value={topProductsMetric} onChange={setTopProductsMetric} options={[{ id: 'count', label: 'Quantità' }, { id: 'revenue', label: 'Incasso' }]} />}
          >
            <HBars rows={sortedTopProdotti.map(p => ({ key: p.prodotto, label: p.prodotto, ...p }))} valueOf={r => r[topProductsMetric]}
              format={v => (topProductsMetric === 'revenue' ? formatEuro(v) : `${v} pz`)} />
          </ChartCard>

          <ChartCard title="Andamento dell'incasso nella serata">
            <Columns ariaLabel="Incasso cumulato per ora" items={hourItems(stats.andamentoFatturato, 'totale')} format={formatEuro} />
          </ChartCard>

          {sessions.length > 1 && (
            <ChartCard title={terms.h2h}>
              <div className="flex flex-wrap gap-2 mb-4">
                {[[h2hSessionA, setH2hSessionA, terms.pickA], [h2hSessionB, setH2hSessionB, terms.pickB]].map(([value, set, placeholder], n) => (
                  <select key={n} value={value} onChange={e => set(e.target.value)} className="h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card-2)] text-sm text-[var(--text-main)]">
                    <option value="">{placeholder}</option>
                    {sessions.map(s => <option key={s.id} value={s.id}>{s.name || new Date(s.start_time).toLocaleDateString('it-IT')}</option>)}
                  </select>
                ))}
                <select value={h2hProduct} onChange={e => setH2hProduct(e.target.value)} className="h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card-2)] text-sm text-[var(--text-main)]">
                  <option value="">Seleziona prodotto…</option>
                  {availableProducts.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                </select>
              </div>
              {h2hData ? (
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-[var(--text-muted)]"><th className="py-1.5 font-medium" /><th className="font-medium text-right">{sessionAName}</th><th className="font-medium text-right">{sessionBName}</th></tr></thead>
                  <tbody className="tabular-nums text-[var(--text-main)]">
                    {h2hData.map(r => <tr key={r.metric} className="border-t border-[var(--border)]"><td className="py-2">{r.metric}</td><td className="text-right">{r.A}</td><td className="text-right">{r.B}</td></tr>)}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-[var(--text-muted)] py-4">{terms.selectTwo}</p>
              )}
            </ChartCard>
          )}

          {stats.topGiftProducts.length > 0 && (
            <ChartCard title="Mancato incasso per omaggi">
              <HBars rows={stats.topGiftProducts.map(g => ({ key: g.product, label: g.product, ...g }))} valueOf={r => r.missedRevenue} format={formatEuro} />
            </ChartCard>
          )}

          <ChartCard title={`Tempo medio di completamento — ${formatMin(stats.tempoMedioCompletamento)}`}>
            {stats.tempoMedioCompletamento === 0 ? (
              <p className="text-sm text-[var(--text-muted)] py-4">Nessun ordine con tempo registrato. I tempi si registrano solo in modalità ordini avanzata.</p>
            ) : (
              <Columns ariaLabel="Tempo medio per fascia oraria" items={hourItems(stats.tempiCompletamento, 'media')} format={formatMin} />
            )}
          </ChartCard>
        </>
      )}

      {isExportModalOpen && (
        <Modal title="Esporta report CSV" size="max-w-md" onClose={() => setIsExportModalOpen(false)}>
          <p className="text-xs text-[var(--text-muted)] mb-3">Solo sessioni concluse</p>
          <div className="space-y-2">
            {closedSessions.length === 0 ? (
              <p className="text-sm text-center text-[var(--text-muted)] py-6">{terms.none}</p>
            ) : closedSessions.map(s => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-card-2)] border border-[var(--border)]">
                <div className="min-w-0 flex-1 pr-2">
                  <p className="text-sm font-medium text-[var(--text-main)] truncate">{s.name || `${terms.column} ${s.id}`}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Chiusa il {new Date(s.end_time).toLocaleDateString('it-IT')} alle {new Date(s.end_time).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <button onClick={() => handleExportCSV(s)} aria-label={`Scarica ${s.name || s.id}`} className={`${iconBtn} shrink-0`}><Download size={16} /></button>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </PageBody>
  );
};

export default Statistics;