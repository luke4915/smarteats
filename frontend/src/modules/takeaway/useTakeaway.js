import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWithAuth } from '../../utils/apiClient';
import { useToast } from '../../context/useToast';

// I dati di una giornata di asporto: impostazioni, ordini e fasce con il carico. Si rileggono quando un altro
// dispositivo (o il sito dei clienti) cambia un ordine, o la cucina segna pronto.
export function useTakeaway(date, event) {
  const { showToast } = useToast();
  const [settings, setSettings] = useState(null);
  const [day, setDay] = useState({ date: null, orders: [], slots: [], capacity: 0 });
  const latest = useRef(0);

  useEffect(() => {
    fetchWithAuth('/takeaway/settings').then(setSettings).catch(err => showToast(err.message || 'Errore caricamento asporto', 'error'));
  }, [showToast]);

  const reload = useCallback(async () => {
    const mine = ++latest.current;
    try {
      const [orders, slots] = await Promise.all([fetchWithAuth(`/takeaway/orders?date=${date}`), fetchWithAuth(`/takeaway/slots?date=${date}`)]);
      if (mine === latest.current) setDay({ date, orders, slots: slots.slots, capacity: slots.capacity });
    } catch (err) { showToast(err.message || 'Errore caricamento asporto', 'error'); }
  }, [date, showToast]);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    if (event && ['takeaway_updated', 'order_updated', 'order_created'].includes(event.type)) reload();
  }, [event, reload]);

  return { settings, orders: day.orders, slots: day.slots, capacity: day.capacity, loading: day.date !== date, reload };
}
