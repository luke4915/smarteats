import { useState } from 'react';
import { Undo2, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { fetchWithAuth } from '../../utils/apiClient';
import { useToast } from '../../context/useToast';
import { formatEuro } from '../../utils/format';
import { iconBtn } from './ui';
import { canCancelOrders } from './permissions';

// Stato di una comanda (una portata) visto da sala e cassa: da mandare, in cucina, pronta. Niente passaggi in più.
const STATUS = { scheduled: ['Da mandare', 'text-amber-500'], pending: ['In cucina', 'text-sky-500'], preparing: ['In cucina', 'text-sky-500'], completed: ['Pronta', 'text-emerald-500'], canceled: ['Stornata', 'text-red-500'] };
const time = (iso) => new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

// Le righe del conto, raggruppate per comanda (come le righe del carrello alla cassa). Le comande già pronte si chiudono
// in una riga sola (un tocco per riaprirle): resta in vista ciò che c'è ancora da fare. A conto chiuso si vede tutto.
// Una comanda in attesa o in preparazione si può stornare finché il conto è aperto.
const CheckOrders = ({ detail, user, onChanged }) => {
  const { showToast } = useToast();
  const [confirming, setConfirming] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());
  const toggle = (id) => setExpanded(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const open = detail.status === 'open';

  const cancel = async (order) => {
    try {
      await fetchWithAuth(`/orders/${order.id}`, { method: 'PUT', body: { status: 'canceled' } });
      showToast('Comanda stornata', 'info');
    } catch (err) { showToast(err.message, 'error'); }
    setConfirming(null);
    onChanged();
  };

  if (!detail.orders.length) {
    return <p className="h-full flex items-center justify-center text-center text-[var(--text-muted)] opacity-50 font-semibold text-xs py-10">Nessuna comanda</p>;
  }

  return detail.orders.map(order => {
    const isCover = order.order_type === 'cover';
    if (isCover && order.status === 'canceled') return null;   // coperto tolto: nessuna traccia da mostrare
    const [text, tone] = STATUS[order.status] ?? [order.status, ''];
    const canceled = order.status === 'canceled';
    const collapsed = open && !isCover && order.status === 'completed' && order.items.length > 0 && !expanded.has(order.id);
    if (collapsed) {
      return (
        <button key={order.id} onClick={() => toggle(order.id)} aria-expanded="false"
          className="w-full flex items-center gap-2 px-1 py-2 text-left cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-main)]">
          <ChevronRight size={15} className="shrink-0" />
          <span className="text-sm font-medium truncate">{order.course_name ?? 'Comanda'} · {order.items.reduce((n, i) => n + i.quantity, 0)} pezzi</span>
          <span className="text-xs font-semibold text-emerald-500 ml-auto shrink-0">Pronta</span>
        </button>
      );
    }
    return (
      <section key={order.id} className={`space-y-1.5 ${canceled ? 'opacity-50' : ''}`}>
        {!isCover && <div className="flex items-center gap-2 px-1 pt-2">
          {open && order.status === 'completed' && <button onClick={() => toggle(order.id)} aria-label="Richiudi la comanda" className="text-[var(--text-muted)] cursor-pointer"><ChevronDown size={15} /></button>}
          <span className="text-xs font-semibold text-[var(--text-muted)]">{order.course_name ? `${order.course_name} · ` : ''}#{order.display_code} · {time(order.created_at)}</span>
          <span className={`text-xs font-semibold ${tone}`}>{text}</span>
          {open && canCancelOrders(user.role) && ['scheduled', 'pending', 'preparing'].includes(order.status) && (
            <span className="ml-auto flex items-center gap-1.5">
              {confirming === order.id ? (
                <>
                  <button className="text-xs font-semibold text-[var(--text-muted)]" onClick={() => setConfirming(null)}>No</button>
                  <button className="text-xs font-semibold text-red-500" onClick={() => cancel(order)}>Storna</button>
                </>
              ) : <button className={`${iconBtn} !p-1`} title="Storna la comanda" aria-label={`Storna la comanda ${order.display_code}`} onClick={() => setConfirming(order.id)}><Undo2 size={14} /></button>}
            </span>
          )}
        </div>}
        {order.items.map(item => {
          const paid = item.paid_quantity > 0;
          return (
            <div key={item.line_id ?? item.name} className="px-1 py-2 border-b border-[var(--border)]/60 last:border-b-0">
              <div className="flex justify-between items-center gap-2">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="w-6 text-sm font-medium tabular-nums text-[var(--text-muted)] shrink-0">{item.quantity}</span>
                  <span className={`text-sm font-medium text-[var(--text-main)] leading-tight truncate ${canceled ? 'line-through' : ''}`}>{item.name}</span>
                  {!canceled && item.type !== 'sale' && <span className={`shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded-full ${item.type === 'gift' ? 'bg-purple-500/10 text-purple-500' : 'bg-orange-500/10 text-orange-500'}`}>{item.type === 'gift' ? 'Omaggio' : 'Sconto'}</span>}
                  {!canceled && !isCover && order.status !== 'completed' && (item.prep_status === 'ready' || item.prep_status === 'served') && <Check size={14} className="shrink-0 text-emerald-500" aria-label="Pronto" />}
                  {!canceled && paid && <span className="shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">{item.remaining_quantity === 0 ? 'Pagata' : `${item.paid_quantity}/${item.quantity} pagate`}</span>}
                </div>
                <span className="text-sm tabular-nums text-[var(--text-main)] shrink-0">{formatEuro(item.line_total)}</span>
              </div>
              {item.modifiers?.length > 0 && <p className="mt-0.5 ml-8 text-xs text-[var(--text-muted)]">{item.modifiers.map(m => m.name).join(', ')}</p>}
              {item.note && <p className="mt-1 ml-8 text-xs text-[var(--text-muted)]">» {item.note}</p>}
            </div>
          );
        })}
      </section>
    );
  });
};

export default CheckOrders;
