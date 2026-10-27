import { useState, useEffect, useMemo, useRef } from 'react';
import { ChefHat, Clock, Check, Volume2, VolumeX } from 'lucide-react';
import { useKitchenOrders } from './useKitchenOrders';
import Segmented from '../floor/Segmented';
import { playChime } from '../../utils/chime';
import SoldOutButton from '../../inventory/SoldOutButton';
import { boardOrders, upcomingByTable, orderUrgency, ticketAction, toggleLineStatus, isDone, hasBarWork, newVisibleOrderIds, STATIONS } from './board';
import Loading from '../../components/shared/Loading';

// Il monitor della cucina: fatto per essere letto da lontano e premuto con le mani sporche. Testi grandi, l'attesa
// colora tutta l'intestazione (verde, ambra, rosso), un solo pulsante enorme per comanda, le più vecchie per prime.
// Le comande nuove si evidenziano e suonano (si può spegnere). Le portate non ancora mandate stanno in basso.
const HEAD = { ok: 'bg-emerald-600 text-white', warn: 'bg-amber-500 text-black', late: 'bg-red-600 text-white' };

const beep = () => { playChime(); };

const Ticket = ({ order, fresh, onLines }) => {
  const level = orderUrgency(order);
  const takeaway = order.pickup_at != null;
  const pickupTime = takeaway ? new Date(order.pickup_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : null;
  const action = ticketAction(order);
  // Senza tavolo né ritiro (banco della sagra) il titolo è il numero dell'ordine, quello che si chiama a voce
  const named = order.table_name || takeaway || order.is_takeaway;
  const where = order.table_name ? `Tavolo ${order.table_name}` : takeaway ? `Ritiro ${pickupTime}` : order.is_takeaway ? 'Asporto' : `#${order.display_code}`;
  return (
    <article className={`flex flex-col rounded-xl overflow-hidden bg-[var(--bg-card)] border-2 ${fresh ? 'border-[var(--accent)] ring-4 ring-[var(--accent)]/30' : 'border-[var(--border)]'}`}>
      <header className={`flex items-center justify-between gap-3 px-4 py-3 ${HEAD[level]}`}>
        <div className="min-w-0">
          <h3 className="text-3xl font-bold leading-none truncate">{where}</h3>
          <p className="mt-1 text-base font-medium opacity-90 truncate">{[order.pickup_name, order.course_name, order.covers > 0 && `${order.covers} cop.`, named && `#${order.display_code}`].filter(Boolean).join(' · ')}</p>
        </div>
        <span className="flex items-center gap-1.5 text-2xl font-bold tabular-nums shrink-0"><Clock size={22} />{takeaway ? Math.abs(order.pickupIn) : order.minutes}<span className="text-base font-medium">{takeaway ? (order.pickupIn < 0 ? 'min fa' : 'min al ritiro') : 'min'}</span></span>
      </header>
      <ul className="p-2 flex-1">
        {order.items.map(item => {
          const done = isDone(item);
          return (
            <li key={item.line_id}>
              <button onClick={() => onLines(order, [item.line_id], toggleLineStatus(item))} aria-label={`${item.name}: ${done ? 'pronta, torna da fare' : 'segna pronta'}`}
                className="w-full flex gap-3 items-start px-2 py-2.5 rounded-lg text-left hover:bg-[var(--bg-card-2)] active:bg-[var(--bg-card-2)]">
                <span className={`mt-1 w-7 h-7 shrink-0 rounded-full border-2 flex items-center justify-center ${done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-[var(--border-hover)]'}`}>{done && <Check size={18} />}</span>
                <span className={`min-w-0 text-2xl leading-snug ${done ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-main)]'}`}>
                  <span className="font-bold tabular-nums mr-2.5">{item.quantity}</span>{item.name}
                  {item.modifiers?.length > 0 && <span className="block text-lg text-[var(--text-muted)] no-underline">{item.modifiers.map(m => m.name).join(', ')}</span>}
                  {item.note && <span className="mt-1 block text-xl font-semibold rounded-md bg-amber-400 text-black px-2 py-0.5 w-fit no-underline">{item.note}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <button onClick={() => onLines(order, action.lineIds, action.status)}
        className="h-16 text-xl font-bold bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] active:brightness-90">
        {action.label}
      </button>
    </article>
  );
};

// `actions`: pulsanti in più nella testata (la cassa delle sagre ci mette la scansione dello scontrino).
const KitchenPage = ({ event, actions }) => {
  const { orders, setLines } = useKitchenOrders(event);
  const [station, setStation] = useState('all');
  const [now, setNow] = useState(() => Date.now());
  const [sound, setSound] = useState(() => { try { return localStorage.getItem('kitchen_sound') !== 'off'; } catch { return true; } });
  const [fresh, setFresh] = useState([]);
  const seen = useRef(null);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);

  const showStations = hasBarWork(orders ?? []);
  const everything = useMemo(() => boardOrders(orders ?? [], 'all', now), [orders, now]);   // tutte le postazioni: serve a capire cosa è davvero nuovo
  const active = useMemo(() => boardOrders(orders ?? [], showStations ? station : 'all', now), [orders, station, showStations, now]);
  const upcoming = useMemo(() => upcomingByTable(orders ?? []), [orders]);

  // Comanda nuova: si evidenzia per qualche secondo e suona
  useEffect(() => {
    if (!orders) return;
    const news = newVisibleOrderIds(seen.current, everything, active);
    seen.current = new Set(everything.map(o => o.id));
    if (!news.length) return;
    setFresh(f => [...f, ...news]);
    if (sound) beep();
    const t = setTimeout(() => setFresh(f => f.filter(id => !news.includes(id))), 8000);
    return () => clearTimeout(t);
  }, [everything, active, orders, sound]);

  const toggleSound = () => setSound(s => { try { localStorage.setItem('kitchen_sound', s ? 'off' : 'on'); } catch { /* senza archivio locale */ } if (!s) beep(); return !s; });

  if (!orders) return <Loading />;
  return (
    <div className="h-full flex flex-col gap-4">
      <header className="shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="hidden md:block text-3xl font-semibold tracking-tight text-[var(--text-main)]">Cucina</h2>
          <p className="text-lg text-[var(--text-muted)]">{active.length === 0 ? 'Nessuna comanda' : `${active.length} ${active.length === 1 ? 'comanda' : 'comande'} da preparare`}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {showStations && (
            <Segmented label="Postazione" size="lg" value={station} onChange={setStation} options={STATIONS} />
          )}
          {actions}
          <SoldOutButton />
          <button onClick={toggleSound} aria-pressed={sound} aria-label={sound ? 'Spegni il suono' : 'Accendi il suono'}
            className="h-12 w-12 rounded-lg border border-[var(--border)] flex items-center justify-center text-[var(--text-main)]">{sound ? <Volume2 size={22} /> : <VolumeX size={22} />}</button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {active.length === 0
          ? <div className="h-full min-h-40 flex flex-col items-center justify-center gap-3 text-[var(--text-muted)]"><ChefHat size={48} className="opacity-40" /><p className="text-xl">Tutto in pari. Le nuove comande compaiono qui.</p></div>
          : <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(320px,1fr))] items-start">{active.map(o => <Ticket key={o.id} order={o} fresh={fresh.includes(o.id)} onLines={setLines} />)}</div>}
      </div>

      {upcoming.length > 0 && (
        <footer className="shrink-0 pt-3 border-t border-[var(--border)]">
          <p className="text-base font-medium text-[var(--text-muted)] mb-2">In arrivo</p>
          <div className="flex flex-wrap gap-2">
            {upcoming.map(u => (
              <span key={u.table} className="px-4 py-2 rounded-full border border-[var(--border)] text-lg text-[var(--text-muted)]">
                <span className="font-bold text-[var(--text-main)]">{u.table}</span> · {u.courses.join(', ')}
              </span>
            ))}
          </div>
        </footer>
      )}
    </div>
  );
};

export default KitchenPage;
