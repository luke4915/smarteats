// Logica del tabellone della cucina (KDS pubblico, solo lettura): attesa e urgenza di ogni comanda, riepilogo di ciò che c'è da
// preparare. Pura (provata in board.test.js). Le soglie sono quelle del monitor della cucina (smarteats/kitchen/board.js).
import { minutesSince, urgency } from '../../smarteats/kitchen/board.js';

// Minuti dall'uscita della comanda (per i tavoli) o dalla creazione.
export const waitOf = (order, now = Date.now()) => minutesSince(order, now);

// Le comande da mostrare: quelle ancora da fare, dalla più vecchia. Una portata non ancora mandata non c'è (non è pubblica).
export function boardOrders(orders) {
  return orders.filter(o => ['pending', 'preparing'].includes(o.status))
    .sort((a, b) => new Date(a.fired_at ?? a.created_at) - new Date(b.fired_at ?? b.created_at) || a.id - b.id);
}

// Come presentare una comanda: livello (ok/warn/late), attesa in minuti, dove va e il codice da chiamare.
export function ticketMeta(order, now = Date.now()) {
  const minutes = waitOf(order, now);
  const pickup = order.pickup_at ? new Date(order.pickup_at) : null;
  const where = order.table_name ? `Tavolo ${order.table_name}${order.covers > 0 ? ` · ${order.covers} cop.` : ''}` : pickup ? 'Asporto' : order.is_takeaway ? 'Asporto' : 'Banco';
  return { level: urgency(minutes), minutes, where, code: order.display_code ?? String(order.id) };
}

// «Da preparare»: i pezzi di tutte le comande sommati per piatto (e per nota, che cambia la preparazione), dal più richiesto.
export function summarize(orders) {
  const map = new Map();
  for (const o of orders) {
    for (const i of o.items ?? []) {
      const key = `${i.name}__${i.note || ''}__${(i.modifiers ?? []).join('|')}`;
      const row = map.get(key) ?? { key, name: i.name, note: i.note || '', modifiers: i.modifiers ?? [], quantity: 0 };
      row.quantity += Number(i.quantity || 0);
      map.set(key, row);
    }
  }
  return [...map.values()].sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, 'it'));
}

// Quanto manca in tutto: pezzi totali e comanda più vecchia (per l'intestazione).
export function headline(orders, now = Date.now()) {
  const active = boardOrders(orders);
  return { tickets: active.length, pieces: active.reduce((n, o) => n + (o.items ?? []).reduce((m, i) => m + Number(i.quantity || 0), 0), 0), oldest: active.length ? waitOf(active[0], now) : 0 };
}
