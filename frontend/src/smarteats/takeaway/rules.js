// Logica pura della vista Asporto (date, gruppi della lista, carico delle fasce). Le regole vere (fasce, capienza,
// stati) le applica il server (backend/utils/takeaway.js): qui servono solo a mostrare.

export const STATUS = {
  requested: { label: 'Da approvare', tone: 'amber' },
  accepted: { label: 'Da preparare', tone: 'accent' },
  ready: { label: 'Pronto', tone: 'green' },
  picked_up: { label: 'Consegnato', tone: 'muted' },
  rejected: { label: 'Rifiutato', tone: 'muted' },
  cancelled: { label: 'Annullato', tone: 'muted' },
  expired: { label: 'Scaduto', tone: 'muted' },
};
export const SOURCE = { portal: 'Sito', counter: 'Banco', phone: 'Telefono' };

// Lo stato mostrato: un ordine accettato con la cucina che ha finito è «Pronto».
export const shownStatus = (order) => (order.ready ? 'ready' : order.status);

// Le liste della giornata: prima ciò che va deciso, poi ciò che è in lavorazione (per orario di ritiro), poi il resto.
export function groupOrders(orders) {
  const by = (pred) => orders.filter(pred);
  return [
    { key: 'requested', title: 'Da approvare', items: by(o => o.status === 'requested') },
    { key: 'active', title: 'Da preparare e ritirare', items: by(o => o.status === 'accepted') },
    { key: 'done', title: 'Consegnati', items: by(o => o.status === 'picked_up') },
    { key: 'closed', title: 'Rifiutati, annullati e scaduti', items: by(o => ['rejected', 'cancelled', 'expired'].includes(o.status)) },
  ].filter(g => g.items.length);
}

// Carico per fascia degli ordini vivi (da approvare o accettati): Map «HH:MM» → carico.
export function loadByTime(orders) {
  const map = new Map();
  for (const o of orders) if (['requested', 'accepted'].includes(o.status)) map.set(o.time, (map.get(o.time) ?? 0) + o.load);
  return map;
}

// «2× Margherita, 1× Acqua» (le prime `max` righe, poi «+ altre n»)
export function itemsSummary(items, max = 3) {
  const parts = items.slice(0, max).map(i => `${i.quantity}× ${i.name}`);
  return items.length > max ? `${parts.join(', ')} + altre ${items.length - max}` : parts.join(', ');
}

export const cartCount = (cart) => cart.reduce((n, l) => n + l.quantity, 0);
export const cartTotal = (cart) => cart.reduce((s, l) => s + Math.round(l.price * 100) * l.quantity, 0) / 100;
export const cartLoad = (cart) => cart.reduce((n, l) => n + l.quantity * (l.takeaway_load ?? 1), 0);

// Aggiunge un prodotto al carrello (stessa riga: si somma), o ne toglie uno.
export function addToCart(cart, product, delta = 1) {
  const found = cart.find(l => l.id === product.id);
  if (!found) return delta > 0 ? [...cart, { id: product.id, name: product.name, price: product.price, takeaway_load: product.takeaway_load ?? 1, quantity: delta, note: '' }] : cart;
  const quantity = found.quantity + delta;
  return quantity > 0 ? cart.map(l => (l === found ? { ...l, quantity } : l)) : cart.filter(l => l !== found);
}
