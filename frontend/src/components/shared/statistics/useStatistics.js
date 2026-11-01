import { useEffect, useState, useMemo } from 'react';
import { fetchWithAuth } from '../../../utils/apiClient';


export const activeHours = (data, key) => {
  const firstIndex = data.findIndex(d => d[key] > 0);
  if (firstIndex === -1) return [];
  const lastIndex = data.length - 1 - [...data].reverse().findIndex(d => d[key] > 0);
  return data.slice(firstIndex, lastIndex + 1);
};

// Riordina partendo dalle 12:00 per coprire il flusso 12:00 -> 03:00 senza spezzare la notte
export const reorderHours = (data) => [...data.slice(12), ...data.slice(0, 12)];

const empty = {
  totaleSerata: 0, importoMedio: 0, prodottoPiuVenduto: '',
  numeroTotaleOrdini: 0, incassoPerCategoria: [],
  ordiniPerFasciaOraria: [], prezzoMedioPerFasciaOraria: [],
  topProdotti: [], andamentoFatturato: [],
  tempiCompletamento: [], tempoMedioCompletamento: 0,
  unrealizedGiftRevenue: 0, topGiftProducts: [],
  canceledCount: 0, totaleStornato: 0,
};

// Le statistiche le calcola il server (GET /stats): al browser arrivano solo i totali, mai gli ordini.
export function useStatistics() {
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState(empty);
  const [selectedSessionIds, setSelectedSessionIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [topProductsMetric, setTopProductsMetric] = useState('count');

  useEffect(() => {
    fetchWithAuth('/sessions')
      .then(data => setSessions(Array.isArray(data) ? data : []))
      .catch(err => setError(err.message));
  }, []);

  // Si ricalcola a ogni cambio delle serate scelte; ogni richiesta sostituisce la precedente
  const sessionsParam = selectedSessionIds.join(',');
  useEffect(() => {
    let cancelled = false;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const query = new URLSearchParams({ tz, ...(sessionsParam && { sessions: sessionsParam }) });
    fetchWithAuth(`/stats?${query}`)
      .then(data => { if (!cancelled) { setStats(data); setError(null); } })
      .catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sessionsParam]);

  const toggleSession = (id) => {
    const sid = String(id);
    setSelectedSessionIds(prev => prev.includes(sid) ? prev.filter(s => s !== sid) : [...prev, sid]);
  };

  const sortedTopProdotti = useMemo(() => (
    [...stats.topProdotti].sort((a, b) => b[topProductsMetric] - a[topProductsMetric]).slice(0, 10)
  ), [stats.topProdotti, topProductsMetric]);

  return {
    sessions, loading, error,
    selectedSessionIds, toggleSession, setSelectedSessionIds,
    stats, sortedTopProdotti, topProductsMetric, setTopProductsMetric,
  };
}
