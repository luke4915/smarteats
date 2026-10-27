import { useState, useEffect, useCallback, useMemo } from 'react';
import { ReservedDataContext } from './useReservedData';
import { useAuth } from './useAuth';
import { fetchWithAuth } from '../utils/apiClient';

// Chi può vedere costi e statistiche (e quindi sbloccarli): amministratore e responsabile. Per gli altri non c'è nulla da bloccare.
const MANAGERS = ['admin', 'manager'];

// Tiene lo stato del blocco dei dati riservati per chi è collegato. Il blocco vero lo fa il server: qui si sa solo se mostrare
// la scheda di sblocco o i dati. Non si sa ancora com'è = chiuso (nel dubbio non si mostra nulla). Allo scadere dello sblocco,
// o tornando sulla scheda dopo un po', si rilegge lo stato e i dati si richiudono da soli.
export const ReservedDataProvider = ({ children }) => {
  const { user } = useAuth();
  const [status, setStatus] = useState(null);
  const involved = !!user && !user.needsPassword && MANAGERS.includes(user.role);
  const userId = user?.id;

  const refresh = useCallback(async () => {
    try { setStatus(await fetchWithAuth('/reserved-data/status')); }
    catch { /* senza rete lo stato resta com'era: i dati comunque non arrivano */ }
  }, []);

  useEffect(() => {
    if (involved) refresh(); else setStatus(null);
  }, [involved, userId, refresh]);

  useEffect(() => {
    if (!status?.unlockedUntil) return undefined;
    const wait = Math.max(new Date(status.unlockedUntil) - Date.now(), 0) + 500;
    const timer = setTimeout(refresh, wait);
    return () => clearTimeout(timer);
  }, [status?.unlockedUntil, refresh]);

  useEffect(() => {
    if (!involved) return undefined;
    const onShow = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onShow);
    return () => document.removeEventListener('visibilitychange', onShow);
  }, [involved, refresh]);

  const value = useMemo(() => ({
    ready: !involved || status !== null,
    enabled: involved && !!status?.enabled,
    locked: involved ? (status === null ? true : status.locked) : false,
    unlockedUntil: status?.unlockedUntil ?? null,
    unlock: async (password) => setStatus(await fetchWithAuth('/reserved-data/unlock', { method: 'POST', body: { password } })),
    lock: async () => setStatus(await fetchWithAuth('/reserved-data/lock', { method: 'POST' })),
    refresh,
  }), [involved, status, refresh]);

  return <ReservedDataContext.Provider value={value}>{children}</ReservedDataContext.Provider>;
};
