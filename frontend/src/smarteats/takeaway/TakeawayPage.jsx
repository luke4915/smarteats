import { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, ShoppingBag } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useIsMobile } from '../../hooks/useBreakpoint';
import { fetchWithAuth } from '../../utils/apiClient';
import { useToast } from '../../context/useToast';
import { useTakeaway } from './useTakeaway';
import { todayLocal, addDays, formatDay } from '../reservations/rules';
import { STATUS, SOURCE, groupOrders, itemsSummary, shownStatus, addToCart } from './rules';
import OrderPanel from './OrderPanel';
import NewOrder, { ProductPicker } from './NewOrder';
import { formatEuro } from '../floor/checkMath';
import { useProducts } from '../floor/useProducts';
import { btnPrimary, iconBtn, btn } from '../floor/ui';

const card = 'bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 sm:p-5 min-w-0';
const TONES = {
  amber: 'bg-amber-500/15 text-amber-500', green: 'bg-emerald-500/15 text-emerald-500',
  accent: 'bg-[var(--accent)]/15 text-[var(--accent)]', muted: 'bg-[var(--bg-card-2)] text-[var(--text-muted)]',
};

// La giornata dell'asporto: ordini per orario di ritiro, quelli da approvare in cima, il carico delle fasce in un colpo
// d'occhio. A destra un solo pannello (dettaglio o nuovo ordine), come la Sala; su schermo stretto è a tutto schermo.
const TakeawayPage = ({ event }) => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const narrow = useIsMobile(900);
  const [date, setDate] = useState(() => location.state?.date ?? todayLocal());
  const { settings, orders, slots, capacity, loading, reload } = useTakeaway(date, event);
  const [panel, setPanel] = useState(null);        // { kind: 'detail', id } | { kind: 'new' }
  const [cart, setCart] = useState([]);
  const products = useProducts(panel?.kind === 'new');

  // Si arriva dalla campanella: si apre l'ordine da approvare
  useEffect(() => {
    const target = location.state;
    if (!target?.orderId) return;
    if (target.date) setDate(target.date);
    setPanel({ kind: 'detail', id: target.orderId });
    navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate]);

  const groups = useMemo(() => groupOrders(orders), [orders]);
  const current = panel?.kind === 'detail' ? orders.find(o => o.id === panel.id) : null;
  const pending = orders.filter(o => o.status === 'requested').length;
  const go = (n) => { setDate(d => addDays(d, n)); setPanel(null); };
  const busySlots = slots.filter(s => s.load > 0);

  const quickAccept = async (e, order) => {
    e.stopPropagation();
    try { await fetchWithAuth(`/takeaway/orders/${order.id}/accept`, { method: 'POST', body: {} }); showToast('Ordine accettato: va in cucina', 'success'); await reload(); }
    catch (err) { showToast(err.message, 'error'); }
  };

  const list = (
    <div className="flex flex-col h-full min-h-0">
      <header className="flex flex-wrap items-center gap-3 pb-3 shrink-0">
        <div className="flex items-center gap-1">
          <button className={iconBtn} aria-label="Giorno precedente" onClick={() => go(-1)}><ChevronLeft size={20} /></button>
          <div className="min-w-[10.5rem] text-center">
            <p className="text-lg font-semibold tracking-tight text-[var(--text-main)] first-letter:uppercase leading-tight">{formatDay(date)}</p>
            <p className="text-xs text-[var(--text-muted)]">{(n => `${n} ${n === 1 ? 'ordine' : 'ordini'}`)(orders.filter(o => ['requested', 'accepted', 'picked_up'].includes(o.status)).length)}{pending > 0 && <span className="text-amber-500"> · {pending} da approvare</span>}</p>
          </div>
          <button className={iconBtn} aria-label="Giorno successivo" onClick={() => go(1)}><ChevronRight size={20} /></button>
        </div>
        {date !== todayLocal() && <button className={`${btn} !h-10`} onClick={() => { setDate(todayLocal()); setPanel(null); }}>Oggi</button>}
        <button className={`${btnPrimary} !h-10 ml-auto`} onClick={() => { setPanel({ kind: 'new' }); }}><Plus size={16} /> Nuovo ordine</button>
      </header>

      {busySlots.length > 0 && (
        <div className="flex gap-2 pb-3 overflow-x-auto no-scrollbar shrink-0" aria-label="Carico delle fasce">
          {busySlots.map(s => {
            const ratio = capacity ? s.load / capacity : 0;
            const tone = ratio >= 1 ? 'border-red-500/50 text-red-500' : ratio >= 0.75 ? 'border-amber-500/50 text-amber-500' : 'border-[var(--border)] text-[var(--text-muted)]';
            return <span key={s.time} className={`shrink-0 px-2.5 py-1 rounded-lg border text-xs tabular-nums ${tone}`}><b className="text-[var(--text-main)]">{s.time}</b> · {s.load}/{capacity}</span>;
          })}
        </div>
      )}

      <div className="flex-1 overflow-y-auto no-scrollbar space-y-5 pr-1">
        {loading && <p className="text-sm text-[var(--text-muted)]">Caricamento…</p>}
        {!loading && groups.length === 0 && (
          <div className="py-14 flex flex-col items-center gap-2 text-[var(--text-muted)]"><ShoppingBag size={32} className="opacity-50" /><p className="text-sm">Nessun ordine per questo giorno.</p></div>
        )}
        {!loading && settings && settings.hours.length === 0 && (
          <p className="text-sm text-[var(--text-muted)]">Gli orari dell'asporto non sono impostati: <button className="text-[var(--accent)] font-medium cursor-pointer" onClick={() => navigate('/settings')}>Impostazioni</button>.</p>
        )}
        {groups.map(g => (
          <section key={g.key} aria-label={g.title}>
            <p className={`text-xs font-medium mb-1.5 ${g.key === 'requested' ? 'text-amber-500' : 'text-[var(--text-muted)]'}`}>{g.title} · {g.items.length}</p>
            <ul className="space-y-1.5">
              {g.items.map(o => {
                const st = STATUS[shownStatus(o)];
                return (
                  <li key={o.id}>
                    <div onClick={() => setPanel({ kind: 'detail', id: o.id })} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setPanel({ kind: 'detail', id: o.id })}
                      aria-label={`${o.customer_name}, ritiro ${o.time}`}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition cursor-pointer ${panel?.id === o.id ? 'border-[var(--accent)] bg-[var(--accent)]/5' : 'border-[var(--border)] bg-[var(--bg-card-2)] hover:border-[var(--border-hover)]'} ${g.key === 'closed' || g.key === 'done' ? 'opacity-70' : ''}`}>
                      <span className="w-14 text-center text-lg font-semibold tabular-nums text-[var(--text-main)]">{o.time}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2"><span className="text-sm font-medium text-[var(--text-main)] truncate">{o.customer_name}</span>
                          {o.display_code && <span className="text-xs font-semibold text-[var(--text-muted)]">#{o.display_code}</span>}
                          <span className="text-xs text-[var(--text-muted)]">{SOURCE[o.source]}</span></span>
                        <span className="block text-xs text-[var(--text-muted)] truncate">{itemsSummary(o.items)}</span>
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-[var(--text-main)] hidden sm:block">{formatEuro(o.total)}</span>
                      {o.status === 'requested'
                        ? <button className={`${btnPrimary} !h-9 !px-3`} onClick={(e) => quickAccept(e, o)}>Accetta</button>
                        : <span className={`inline-flex items-center h-6 px-2.5 rounded-full text-xs font-medium ${TONES[st.tone]}`}>{st.label}</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );

  const side = panel?.kind === 'new'
    ? <NewOrder date={date} cart={cart} setCart={setCart} onBack={() => setPanel(null)} onCreated={async (order) => { setCart([]); await reload(); setPanel({ kind: 'detail', id: order.id }); }} />
    : current
      ? <OrderPanel key={current.id + current.status} order={current} slots={slots.filter(s => s.available || s.time === current.time)} onBack={() => setPanel(null)} onChanged={async () => { await reload(); }} />
      : (
        <div className="h-full flex flex-col items-center justify-center gap-2 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] text-[var(--text-muted)] opacity-60">
          <ShoppingBag size={32} /><p className="text-sm text-center">Scegli un ordine</p>
        </div>
      );

  // Nuovo ordine: la carta occupa la colonna grande, il riepilogo sta a destra
  if (panel?.kind === 'new') {
    const picker = <div className={`${card} flex-1 min-h-0 overflow-hidden`}><ProductPicker products={products} cart={cart} onAdd={(p, d) => setCart(c => addToCart(c, p, d))} /></div>;
    if (narrow) return <div className="flex-1 min-h-0 flex flex-col gap-3 w-full"><div className="h-[45%] min-h-0 flex">{picker}</div><div className="flex-1 min-h-0">{side}</div></div>;
    return <>{picker}<div className="w-[400px] xl:w-[440px] shrink-0 h-full">{side}</div></>;
  }
  if (!narrow) return <><div className={`${card} flex-1 min-h-0 overflow-hidden`}>{list}</div><div className="w-[380px] xl:w-[420px] shrink-0 h-full">{side}</div></>;
  return <div className="flex-1 min-h-0 w-full">{panel ? side : <div className={`${card} h-full overflow-hidden`}>{list}</div>}</div>;
};

export default TakeawayPage;
