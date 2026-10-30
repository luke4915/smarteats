import { useEffect, useState, useMemo } from 'react';
import { ChefHat, Wifi, WifiOff } from 'lucide-react';
import { useLiveUpdates } from '../hooks/useLiveUpdates';
import { apiFetch } from '../utils/apiClient';
import TicketCard from '../components/kds/TicketCard';
import ToPrepare from '../components/kds/ToPrepare';
import { boardOrders, headline } from '../components/kds/board';
import Loading from '../components/shared/Loading';

// Lo schermo della cucina (`/kds`, senza login): un tabellone da appendere, solo lettura. A sinistra tutto ciò che c'è da preparare
// sommato per piatto, a destra le comande dalla più vecchia con la testata che cambia colore (verde, ambra, rossa) man mano che
// aspettano. Sempre scuro (si legge da lontano e non abbaglia), niente prezzi né dati dei clienti: arrivano solo dal server pubblico.
const mergeOrders = (existing, incoming) => {
  const map = new Map();
  for (const o of existing) map.set(o.id, o);
  for (const o of incoming) map.set(o.id, o);
  return Array.from(map.values());
};

export default function KDS() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [disabled, setDisabled] = useState(false);   // modulo KDS spento per questo locale
  const [now, setNow] = useState(() => Date.now());

  // L'attesa e l'ora si aggiornano da sole ogni 15 secondi
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(t); }, []);

  // Schermo pubblico, senza login: riceve dal server solo gli eventi della cucina, senza prezzi.
  // Se il modulo KDS è spento il collegamento si chiude e non riparte.
  const live = useLiveUpdates((msg) => {
    if (msg.type === 'order_created' || msg.type === 'new_order') {
      if (['pending', 'preparing'].includes(msg.order.status)) setOrders(prev => mergeOrders(prev, [msg.order]));
    } else if (msg.type === 'order_updated') {
      if (['completed', 'canceled'].includes(msg.order.status)) setOrders(prev => prev.filter(o => o.id !== msg.order.id));
      else setOrders(prev => mergeOrders(prev, [msg.order]));
    } else if (msg.type === 'session_ended') {
      setOrders([]);
    }
  }, { publicKds: true, enabled: !disabled });

  useEffect(() => {
    apiFetch('/orders/kds')
      .then(data => setOrders(prev => mergeOrders(prev, data)))
      .catch(err => { if (err.code === 'MODULE_DISABLED') setDisabled(true); })
      .finally(() => setLoading(false));
  }, []);

  const active = useMemo(() => boardOrders(orders), [orders]);
  const { tickets, pieces, oldest } = headline(orders, now);

  if (disabled) return (
    <div className="min-h-dvh bg-neutral-950 text-white flex items-center justify-center p-6">
      <p className="text-base text-neutral-400 text-center">Lo schermo cucina non è attivo per questo locale.</p>
    </div>
  );

  return (
    <div className="h-dvh bg-neutral-950 text-white flex flex-col overflow-hidden">
      <header className="flex items-center justify-between gap-4 px-6 py-3.5 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-[var(--accent)] flex items-center justify-center text-lg font-semibold select-none">S</span>
          <h1 className="text-xl font-semibold tracking-tight">Cucina</h1>
        </div>
        <dl className="hidden sm:flex items-center gap-6 text-neutral-400">
          <div className="flex items-baseline gap-1.5"><dd className="text-2xl font-semibold tabular-nums text-white">{tickets}</dd><dt className="text-sm">{tickets === 1 ? 'comanda' : 'comande'}</dt></div>
          <div className="flex items-baseline gap-1.5"><dd className="text-2xl font-semibold tabular-nums text-white">{pieces}</dd><dt className="text-sm">{pieces === 1 ? 'pezzo' : 'pezzi'}</dt></div>
          <div className="flex items-baseline gap-1.5"><dd className={`text-2xl font-semibold tabular-nums ${oldest >= 20 ? 'text-red-400' : oldest >= 10 ? 'text-amber-400' : 'text-white'}`}>{oldest}</dd><dt className="text-sm">min la più vecchia</dt></div>
        </dl>
        <div className="flex items-center gap-4 shrink-0">
          <span className="text-2xl font-semibold tabular-nums text-neutral-300" aria-label="Ora">{new Date(now).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
          <span className={`flex items-center gap-1.5 text-sm font-medium ${live ? 'text-emerald-400' : 'text-red-400'}`}>{live ? <Wifi size={16} /> : <WifiOff size={16} />}{live ? 'In diretta' : 'Senza collegamento'}</span>
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center"><Loading /></div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          <aside className="lg:w-[340px] xl:w-[400px] max-h-[34dvh] lg:max-h-none flex flex-col min-h-0 border-b lg:border-b-0 lg:border-r border-white/10">
            <ToPrepare orders={active} />
          </aside>
          <main className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4">
            {active.length === 0 ? (
              <div className="h-full min-h-48 flex flex-col items-center justify-center gap-3 text-neutral-600"><ChefHat size={48} /><p className="text-xl">Nessuna comanda in attesa</p></div>
            ) : (
              <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(300px,1fr))] items-start">
                {active.map(order => <TicketCard key={order.id} order={order} now={now} />)}
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
