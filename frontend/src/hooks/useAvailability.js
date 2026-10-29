// Quante porzioni di ogni piatto permettono gli ingredienti (GET /inventory/availability), per scrivere «Esaurito» sulle tessere
// della cassa e della sala. Solo nei locali col magazzino «dalle ricette»; negli altri la mappa resta vuota e non si chiede nulla.
// Si rilegge ogni 20 secondi e tornando sulla scheda: la cucina può segnare un ingrediente finito in ogni momento.
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/useAuth';
import { fetchWithAuth } from '../utils/apiClient';
import { toPortionsMap } from '../inventory/availability';

const REFRESH_MS = 20_000;

export function useAvailability() {
  const { user } = useAuth();
  const enabled = user?.inventory?.mode === 'warehouse' && user.inventory.depletion === 'recipes';
  const [portions, setPortions] = useState(() => new Map());

  const reload = useCallback(async () => {
    try { setPortions(toPortionsMap((await fetchWithAuth('/inventory/availability')).products)); }
    catch { /* senza rete o con un errore si tiene l'ultimo elenco: il server controlla comunque */ }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    reload();
    const timer = setInterval(reload, REFRESH_MS);
    const onShow = () => { if (document.visibilityState === 'visible') reload(); };
    document.addEventListener('visibilitychange', onShow);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onShow); };
  }, [enabled, reload]);

  return portions;
}
