import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWithAuth } from '../../utils/apiClient';
import { playChime } from '../../utils/chime';
import { isNotifySoundOn } from '../../utils/notifySettings';

// Le cose da fare per il personale: richieste di prenotazione da confermare, annulli chiesti dai clienti, ordini da
// asporto da approvare e ingredienti da riordinare (secondo i moduli attivi). Si rileggono quando un altro dispositivo o il sito dei clienti cambia
// qualcosa. Una notifica *nuova* (mai vista in questa sessione) suona, se il suono è acceso: la prima lettura non suona,
// per non avvisare di tutto ciò che c'era già.
// Gli ingredienti da riordinare nella forma delle altre notifiche. L'ora è quella dell'ultimo movimento (serve solo a ordinare).
const lowStockItems = (list) => list.map(i => ({ kind: 'low_stock', id: i.id, name: i.name, base_unit: i.base_unit, quantity_on_hand: i.quantity_on_hand, reorder_level: i.reorder_level, at: i.last_movement ?? new Date(0).toISOString() }));

// Come si riconosce una notifica già vista: un ingrediente da riordinare resta lo stesso anche se la quantità cambia, così non suona a ogni vendita.
const inboxKey = (i) => (i.kind === 'low_stock' ? `${i.kind}:${i.id}` : `${i.kind}:${i.id}:${i.at}`);

export function useInbox({ bookings, takeaway, inventory = false, event }) {
  const [items, setItems] = useState([]);
  const seen = useRef(null);
  const enabled = bookings || takeaway || inventory;

  const reload = useCallback(async () => {
    try {
      const lists = await Promise.all([
        bookings ? fetchWithAuth('/bookings/inbox') : [],
        takeaway ? fetchWithAuth('/takeaway/inbox') : [],
        inventory ? fetchWithAuth('/inventory/restock?only=low').then(lowStockItems) : [],
      ]);
      const list = lists.flat().sort((a, b) => new Date(a.at) - new Date(b.at));
      const keys = new Set(list.map(inboxKey));
      if (seen.current && [...keys].some(k => !seen.current.has(k)) && isNotifySoundOn()) playChime();
      seen.current = keys;
      setItems(list);
    } catch { /* senza rete la campanella resta com'era */ }
  }, [bookings, takeaway, inventory]);

  useEffect(() => { if (enabled) reload(); }, [enabled, reload]);
  useEffect(() => {
    if (enabled && event && ['reservation_updated', 'check_updated', 'takeaway_updated', ...(inventory ? ['order_created', 'order_updated'] : [])].includes(event.type)) reload();
  }, [enabled, event, inventory, reload]);
  // Una richiesta decade da sola dopo 24 ore e un annullo si può chiudere da un altro dispositivo: ogni tanto si rilegge
  useEffect(() => {
    if (!enabled) return undefined;
    const t = setInterval(reload, 60_000);
    return () => clearInterval(t);
  }, [enabled, reload]);

  return { items, reload };
}
