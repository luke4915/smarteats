// L'ordine delle categorie dei prodotti, scelto dal locale (barra dei filtri in cassa e in sala, gruppi del Menu, menu QR). Si salva come
// impostazione `category_order` (un elenco di nomi in JSON). Chi non è nell'elenco (una categoria nuova) va dopo, nell'ordine di prima.
// Logica pura, provata in categoryOrder.test.js; la copia per il browser è `frontend/src/utils/categoryOrder.js` (stessa regola).
export const CATEGORY_ORDER_KEY = 'category_order';
export const categoryOf = (product) => product.category || 'Generico';

// Dal testo salvato all'elenco di nomi; un valore rovinato o mancante vale «nessun ordine scelto».
export function parseOrder(value) {
  try {
    const list = JSON.parse(value);
    return Array.isArray(list) ? list.filter(x => typeof x === 'string' && x) : [];
  } catch { return []; }
}

// I prodotti nell'ordine scelto delle categorie. Dentro una categoria resta l'ordine di arrivo (per nome); le categorie fuori elenco
// seguono nell'ordine in cui compaiono. Ritorna una copia, non cambia l'elenco ricevuto.
export function sortByCategoryOrder(products, order) {
  const rank = new Map(order.map((name, i) => [name, i]));
  let next = order.length;
  for (const p of products) { const c = categoryOf(p); if (!rank.has(c)) rank.set(c, next++); }
  return products.map((p, i) => [p, i]).sort((a, b) => rank.get(categoryOf(a[0])) - rank.get(categoryOf(b[0])) || a[1] - b[1]).map(([p]) => p);
}

export async function loadCategoryOrder(db) {
  const { rows } = await db.query('SELECT value FROM settings WHERE key = $1', [CATEGORY_ORDER_KEY]);
  return parseOrder(rows[0]?.value);
}
