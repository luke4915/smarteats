import { useState, useEffect, useMemo, useRef } from 'react';
import { ChefHat, Clock, Check, Volume2, VolumeX } from 'lucide-react';
import { useKitchenOrders } from './useKitchenOrders';
import { formatElapsed } from '../../utils/format';
import Segmented from '../floor/Segmented';
import { playChime } from '../../utils/chime';
import SoldOutButton from '../../inventory/SoldOutButton';
import { boardOrders, upcomingByTable, orderUrgency, ticketAction, toggleLineStatus, isDone, hasBarWork, newVisibleOrderIds, STATIONS } from './board';
import Loading from '../../components/shared/Loading';

// Il monitor della cucina: si legge a un braccio di distanza e si preme con le mani sporche. Testi chiari ma non enormi,
// l'attesa colora tutta l'intestazione (verde, ambra, rosso), un solo pulsante largo per comanda, le più vecchie per prime.
// Per l'asporto l'intestazione mette in evidenza l'orario di ritiro e quanto manca.
// Le comande nuove si evidenziano e suonano (si può spegnere). Le portate non ancora mandate stanno in basso.
const HEAD = { ok: 'bg-emerald-600 text-white', warn: 'bg-amber-500 text-black', late: 'bg-red-600 text-white' };

const beep = () => { playChime(); };

// Minuti in modo leggibile: «12 min» finché è breve, «3 h 4'» oltre l'ora.
const span = (minutes) => (minutes < 60 ? `${minutes} min` : formatElapsed(minutes));

const Ticket = ({ order, fresh, onLines }) => {
  const level = orderUrgency(order);
  const takeaway = order.pickup_at != null;
  const pickupTime = takeaway ? new Date(order.pickup_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : null;
  const action = ticketAction(order);
  // Senza tavolo né ritiro (banco della sagra) il titolo è il numero dell'ordine, quello che si chiama a voce
  const named = order.table_name || takeaway || order.is_takeaway;
  const where = order.table_name ? `Tavolo ${order.table_name}` : takeaway ? pickupTime : order.is_takeaway ? 'Asporto' : `#${order.display_code}`;
  const wait = takeaway ? (order.pickupIn < 0 ? `${span(Math.abs(order.pickupIn))} fa` : order.pickupIn === 0 ? 'ora' : `tra ${span(order.pickupIn)}`) : span(order.minutes);
  return (
    <article className={`flex flex-col rounded-xl overflow-hidden bg-[var(--bg-card)] border-2 ${fresh ? 'border-[var(--accent)] ring-4 ring-[var(--accent)]/30' : 'border-[var(--border)]'}`}>
      <header className={`flex items-center justify-between gap-3 px-4 py-2.5 ${HEAD[level]}`}>
        <div className="min-w-0">
          {takeaway && <p className="text-xs font-medium opacity-90">Ritiro alle</p>}
          <h3 className="text-xl font-semibold leading-tight tabular-nums truncate">{where}</h3>
          <p className="mt-0.5 text-sm opacity-90 break-words">{[order.pickup_name, order.pickup_code && `cod. ${order.pickup_code}`, order.course_name, order.covers > 0 && `${order.covers} cop.`, named && `#${order.display_code}`].filter(Boolean).join(' · ')}</p>
        </div>
        <span className="flex items-center gap-1.5 text-base font-semibold tabular-nums shrink-0 rounded-full bg-black/15 px-3 py-1" aria-label={takeaway ? `Ritiro ${wait}` : `In attesa da ${wait}`}><Clock size={16} />{wait}</span>
      </header>
      <ul className="p-2 flex-1">
        {order.items.map(item => {
          const done = isDone(item);
          return (
            <li key={item.line_id}>
              <button onClick={() => onLines(order, [item.line_id], toggleLineStatus(item))} aria-label={`${item.name}: ${done ? 'pronta, torna da fare' : 'segna pronta'}`}
                className="w-full flex gap-3 items-start px-2 py-2 rounded-lg text-left hover:bg-[var(--bg-card-2)] active:bg-[var(--bg-card-2)]">
                <span className={`mt-0.5 w-6 h-6 shrink-0 rounded-full border-2 flex items-center justify-center ${done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-[var(--border-hover)]'}`}>{done && <Check size={15} />}</span>
                <span className={`min-w-0 text-lg leading-snug ${done ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-main)]'}`}>
                  <span className="font-semibold tabular-nums mr-2">{item.quantity}</span>{item.name}
                  {item.modifiers?.length > 0 && <span className="block text-base text-[var(--text-muted)] no-underline">{item.modifiers.map(m => m.name).join(', ')}</span>}
                  {item.note && <span className="mt-1 block text-base font-semibold rounded-md bg-amber-400 text-black px-2 py-0.5 w-fit no-underline">{item.note}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <button onClick={() => onLines(order, action.lineIds, action.status)}
        className="h-12 text-base font-semibold bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] active:brightness-90">
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
          <h2 className="hidden md:block text-2xl font-semibold tracking-tight text-[var(--text-main)]">Cucina</h2>
          <p className="text-base text-[var(--text-muted)]">{active.length === 0 ? 'Nessuna comanda' : `${active.length} ${active.length === 1 ? 'comanda' : 'comande'} da preparare`}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {showStations && (
            <Segmented label="Postazione" size="lg" value={station} onChange={setStation} options={STATIONS} />
          )}
          {actions}
          <SoldOutButton />
          <button onClick={toggleSound} aria-pressed={sound} aria-label={sound ? 'Spegni il suono' : 'Accendi il suono'}
            className="h-12 w-12 rounded-lg border border-[var(--border)] flex items-center justify-center text-[var(--text-main)]">{sound ? <Volume2 size={20} /> : <VolumeX size={20} />}</button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {active.length === 0
          ? <div className="h-full min-h-40 flex flex-col items-center justify-center gap-3 text-[var(--text-muted)]"><ChefHat size={40} className="opacity-40" /><p className="text-base">Tutto in pari. Le nuove comande compaiono qui.</p></div>
          : <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(280px,1fr))] items-start">{active.map(o => <Ticket key={o.id} order={o} fresh={fresh.includes(o.id)} onLines={setLines} />)}</div>}
      </div>

      {upcoming.length > 0 && (
        <footer className="shrink-0 pt-3 border-t border-[var(--border)]">
          <p className="text-sm font-medium text-[var(--text-muted)] mb-2">In arrivo</p>
          <div className="flex flex-wrap gap-2">
            {upcoming.map(u => (
              <span key={u.table} className="px-3 py-1.5 rounded-full border border-[var(--border)] text-base text-[var(--text-muted)]">
                <span className="font-semibold text-[var(--text-main)]">{u.table}</span> · {u.courses.join(', ')}
              </span>
            ))}
          </div>
        </footer>
      )}
    </div>
  );
};

export default KitchenPage;
