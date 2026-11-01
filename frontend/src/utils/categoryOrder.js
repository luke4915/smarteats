// L'ordine delle categorie scelto dal locale, per il browser: stessa regola di `backend/utils/categoryOrder.js` (il server manda già
// l'elenco ordinato; questa serve quando arriva l'avviso `category_order_updated`, per riordinare senza ricaricare). Provata in categoryOrder.test.js.
export const categoryOf = (product) => product.category || 'Generico';

// I prodotti nell'ordine scelto delle categorie; dentro una categoria resta l'ordine di arrivo, le categorie fuori elenco seguono.
export function sortByCategoryOrder(products, order) {
  const rank = new Map(order.map((name, i) => [name, i]));
  let next = order.length;
  for (const p of products) { const c = categoryOf(p); if (!rank.has(c)) rank.set(c, next++); }
  return products.map((p, i) => [p, i]).sort((a, b) => rank.get(categoryOf(a[0])) - rank.get(categoryOf(b[0])) || a[1] - b[1]).map(([p]) => p);
}

// Le categorie dell'elenco, nell'ordine in cui compaiono.
export const categoriesInOrder = (products) => [...new Set(products.map(categoryOf))];
