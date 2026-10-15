import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWithAuth } from '../../utils/apiClient';
import { playChime } from '../../utils/chime';
import { isNotifySoundOn } from '../../utils/notifySettings';

// Le cose da fare per il personale (richieste di prenotazione da confermare, annulli chiesti dai clienti). Si rileggono
// quando un altro dispositivo cambia una prenotazione. Una notifica *nuova* (mai vista in questa sessione) suona, se il
// suono è acceso: la prima lettura non suona, per non avvisare di tutto ciò che c'era già.
export function useInbox({ enabled, event }) {
  const [items, setItems] = useState([]);
  const seen = useRef(null);

  const reload = useCallback(async () => {
    try {
      const list = await fetchWithAuth('/bookings/inbox');
      const keys = new Set(list.map(i => `${i.kind}:${i.id}:${i.at}`));
      if (seen.current && [...keys].some(k => !seen.current.has(k)) && isNotifySoundOn()) playChime();
      seen.current = keys;
      setItems(list);
    } catch { /* senza rete la campanella resta com'era */ }
  }, []);

  useEffect(() => { if (enabled) reload(); }, [enabled, reload]);
  useEffect(() => { if (enabled && event && ['reservation_updated', 'check_updated'].includes(event.type)) reload(); }, [enabled, event, reload]);
  // Una richiesta decade da sola dopo 24 ore e un annullo si può chiudere da un altro dispositivo: ogni tanto si rilegge
  useEffect(() => {
    if (!enabled) return undefined;
    const t = setInterval(reload, 60_000);
    return () => clearInterval(t);
  }, [enabled, reload]);

  return { items, reload };
}
