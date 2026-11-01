// Quale suggerimento mostrare nel menu pubblico, se uno va mostrato. Pura, provata in suggestions.test.js.
// `rules`: [{ category | product, suggest }] (già filtrate dal server); `products`: i prodotti del menu; `cart`: { [id]: quantità };
// `dismissed`: gli id che il cliente ha già scartato. Mai più di uno alla volta, mai un prodotto già nel carrello o già scartato,
// e solo se nel carrello c'è davvero qualcosa che fa scattare la regola: niente suggerimenti a carrello vuoto.
export function pickSuggestion(rules, products, cart, dismissed = []) {
  const byId = new Map(products.map(p => [p.id, p]));
  const inCart = products.filter(p => (cart[p.id] ?? 0) > 0);
  if (!inCart.length) return null;
  for (const rule of rules ?? []) {
    const target = byId.get(rule.suggest);
    if (!target || (cart[target.id] ?? 0) > 0 || dismissed.includes(target.id)) continue;
    const triggered = rule.category ? inCart.some(p => p.category === rule.category) : (cart[rule.product] ?? 0) > 0;
    if (triggered) return target;
  }
  return null;
}
