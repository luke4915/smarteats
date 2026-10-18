// Logica del monitor cucina: da quanto aspetta una comanda, quanto è urgente, come si ordinano e si raggruppano.
// Una comanda di un tavolo è una portata (passo 3-1): arriva quando il cameriere la manda, e porta tavolo e coperti.

// Minuti trascorsi da quando la comanda è uscita (mandata in cucina; per le vecchie comande, da quando è stata creata).
export const minutesSince = (order, now = Date.now()) =>
  Math.max(0, Math.floor((now - new Date(order.fired_at ?? order.created_at).getTime()) / 60000));

// Soglie in minuti: oltre `warn` è da sbrigare, oltre `late` è in ritardo.
const WARN_MINUTES = 10;
const LATE_MINUTES = 20;
export const urgency = (minutes) => (minutes >= LATE_MINUTES ? 'late' : minutes >= WARN_MINUTES ? 'warn' : 'ok');

// Asporto: l'ordine ha un orario di ritiro. Minuti da adesso al ritiro (negativi = in ritardo); `null` per gli altri.
export const pickupIn = (order, now = Date.now()) =>
  (order.pickup_at ? Math.round((new Date(order.pickup_at).getTime() - now) / 60000) : null);
// Per l'asporto l'urgenza è quanto manca al ritiro: in ritardo se è già passato, da sbrigare se manca poco.
const PICKUP_WARN_MINUTES = 15;
export const orderUrgency = (order) => (order.pickupIn === null || order.pickupIn === undefined ? urgency(order.minutes)
  : order.pickupIn < 0 ? 'late' : order.pickupIn <= PICKUP_WARN_MINUTES ? 'warn' : 'ok');
// Quando va iniziata una comanda: dall'uscita (tavoli) o 15 minuti prima del ritiro (asporto)
const dueAt = (o) => (o.pickup_at ? new Date(o.pickup_at).getTime() - PICKUP_WARN_MINUTES * 60000 : new Date(o.fired_at ?? o.created_at).getTime());

// Postazioni: una riga è del bar se si stampa solo al bar, altrimenti della cucina (anche «bar + cucina»).
export const STATIONS = [{ id: 'all', label: 'Tutto' }, { id: 'kitchen', label: 'Cucina' }, { id: 'bar', label: 'Bar' }];
export const stationOf = (item) => (item.print_destination === 'bar' ? 'bar' : 'kitchen');
export const isDone = (item) => item.prep_status === 'ready' || item.prep_status === 'served';

// Comande da mostrare a una postazione (`all` = tutte): solo le righe di quella postazione, e solo finché ce n'è una
// ancora da fare. La riga automatica del coperto non è per la cucina. Le più vecchie per prime.
export function boardOrders(orders, station = 'all', now = Date.now()) {
  return orders
    .filter(o => ['pending', 'preparing'].includes(o.status) && o.order_type !== 'cover')
    .map(o => ({ ...o, items: station === 'all' ? o.items : o.items.filter(i => stationOf(i) === station), minutes: minutesSince(o, now), pickupIn: pickupIn(o, now) }))
    .filter(o => o.items.some(i => !isDone(i)))
    .sort((a, b) => dueAt(a) - dueAt(b) || a.id - b.id);
}

// Il pulsante della comanda: segna pronte tutte le righe ancora da fare. Un solo gesto: la cucina non gestisce stati
// intermedi (l'unica cosa che interessa a sala e cassa è «pronta»).
export function ticketAction(order) {
  return { label: 'Pronta', status: 'ready', lineIds: order.items.filter(i => !isDone(i)).map(i => i.line_id) };
}

// Un tocco sulla singola riga: da fare → pronta; già pronta → di nuovo da fare (correzione di un tocco sbagliato).
export const toggleLineStatus = (item) => (isDone(item) ? 'new' : 'ready');

// I tab Cucina/Bar servono solo se c'è del lavoro per il bar; altrimenti non si mostrano.
export const hasBarWork = (orders) => orders.some(o => o.status !== 'scheduled' && o.items.some(i => stationOf(i) === 'bar' && !isDone(i)));

// Portate già sul conto ma non ancora mandate, raggruppate per tavolo, per far vedere alla cucina cosa sta per arrivare.
export function upcomingByTable(orders) {
  const byTable = new Map();
  for (const o of orders.filter(x => x.status === 'scheduled')) {
    const key = o.table_name ?? `Conto ${o.check_number ?? o.check_id}`;
    byTable.set(key, [...(byTable.get(key) ?? []), o]);
  }
  return [...byTable].map(([table, list]) => ({
    table,
    courses: list.sort((a, b) => a.course_seq - b.course_seq || a.id - b.id).map(o => o.course_name ?? 'Bevande e altro'),
  }));
}

// Aggiorna a schermo lo stato di alcune righe, in attesa che il server risponda.
export const withLineStatus = (orders, orderId, lineIds, status) =>
  orders.map(o => (o.id === orderId ? { ...o, items: o.items.map(i => (lineIds.includes(i.line_id) ? { ...i, prep_status: status } : i)) } : o));

// Gli id delle comande comparse rispetto alla volta prima (per evidenziarle e far suonare un segnale). La prima
// lettura non conta: chi apre la pagina non deve essere avvisato di tutto quello che c'era già.
export const newOrderIds = (previous, orders) => {
  if (previous === null) return [];
  return orders.filter(o => !previous.has(o.id)).map(o => o.id);
};
