import React, { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import Modal from './Modal';
import { btnDanger } from '../../smarteats/floor/ui';
import { useToast } from '../../context/useToast';

import { fetchWithAuth } from '../../utils/apiClient';
import { formatEuro } from '../../utils/format';
const CANCEL_WINDOW_MS = 5 * 60 * 1000; // deve combaciare con il backend

// Un ordine è stornabile se: è ancora pending/preparing (avanzata, sempre stornabile
// finché non è completato) oppure è 'completed' ma senza completed_at (modalità
// semplice, mai passato dalla cucina) ed è entro 5 minuti dalla creazione.
const cancelDeadline = (order) => {
  if (order.status === 'pending' || order.status === 'preparing') return Infinity;
  if (order.status === 'completed' && !order.completed_at) {
    return new Date(order.created_at).getTime() + CANCEL_WINDOW_MS;
  }
  return -Infinity; // non stornabile
};

const ReverseOrder = ({ onClose }) => {
  const { showToast } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    try {
      const data = await fetchWithAuth('/orders?session=active');
      setOrders(data.filter(o => cancelDeadline(o) > Date.now()));
    } catch {
      showToast("Errore caricamento ordini", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  // Tick ogni secondo: aggiorna i countdown e fa sparire gli ordini appena scadono
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const visibleOrders = orders.filter(o => cancelDeadline(o) > now);

  const cancelOrder = async (orderId) => {
    try {
      await fetchWithAuth(`/orders/${orderId}`, { method: 'PUT', body: { status: 'canceled' } });
      setOrders(prev => prev.filter(o => o.id !== orderId));
      showToast("Ordine stornato", "success");
    } catch (err) {
      showToast(`Errore durante lo storno: ${err.message}`, "error");
    }
  };

  return (
    <Modal title="Storno ordini" size="max-w-lg" onClose={onClose}>
      <p className="text-xs text-[var(--text-muted)] mb-4">Ordini in attesa (modalità avanzata) o completati da meno di 5 minuti (modalità semplice).</p>
      {loading ? (
        <p className="py-10 text-center text-sm text-[var(--text-muted)]">Caricamento...</p>
      ) : visibleOrders.length === 0 ? (
        <p className="py-10 text-center text-sm text-[var(--text-muted)]">Nessun ordine da stornare</p>
      ) : (
        <ul className="space-y-2">
          {visibleOrders.map(order => {
            const deadline = cancelDeadline(order);
            const isTimed = Number.isFinite(deadline);
            const secsLeft = isTimed ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;
            return (
              <li key={order.id} className="flex justify-between items-center gap-3 p-3 bg-[var(--bg-card-2)] rounded-lg border border-[var(--border)]">
                <div className="min-w-0">
                  <span className="font-medium text-sm text-[var(--text-main)]">Ordine {order.display_code || `#${order.id}`}</span>
                  <div className="text-xs text-[var(--text-muted)] mt-0.5">{order.items?.map(i => `${i.quantity}× ${i.name}`).join(', ')}</div>
                  <div className="text-xs font-medium tabular-nums text-[var(--accent)] mt-0.5">{formatEuro(Number(order.total || 0))}</div>
                  {isTimed && (
                    <div className="flex items-center gap-1 text-xs font-medium tabular-nums text-orange-500 mt-1">
                      <Clock size={12} /> Scade tra {Math.floor(secsLeft / 60)}:{String(secsLeft % 60).padStart(2, '0')}
                    </div>
                  )}
                </div>
                <button onClick={() => cancelOrder(order.id)} className={`${btnDanger} !h-9 shrink-0`}><AlertTriangle size={14} /> Storna</button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
};

export default ReverseOrder;
