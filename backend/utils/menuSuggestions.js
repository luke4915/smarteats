// I suggerimenti del menu pubblico con il QR (sagre): «a chi sceglie un panino proponi una birra». Funzione piccola e a sé, pensata per
// poterla togliere senza toccare altro: impostazione `menu_suggestions` (elenco di regole in JSON), una rotta (`routes/menuSuggestions.js`),
// l'elenco già filtrato dentro `GET /products/menu` e un riquadro discreto nella pagina del menu. Logica pura, provata in menuSuggestions.test.js.
//   regola = { category: 'Panini', suggest: 12 }  oppure  { product: 3, suggest: 12 }   (`suggest` = id del prodotto da proporre)
export const SUGGESTIONS_KEY = 'menu_suggestions';
export const MAX_RULES = 30;

// Dal testo salvato alle regole; un valore rovinato o con regole malformate vale «nessun suggerimento».
export function parseRules(value) {
  let list;
  try { list = JSON.parse(value); } catch { return []; }
  if (!Array.isArray(list)) return [];
  return list.filter(r => r && Number.isInteger(r.suggest) && (Boolean(typeof r.category === 'string' && r.category) !== Boolean(Number.isInteger(r.product) && r.product > 0)))
    .map(r => (r.category ? { category: r.category, suggest: r.suggest } : { product: r.product, suggest: r.suggest }))
    .slice(0, MAX_RULES);
}

// Cosa si manda ai clienti: solo le regole il cui prodotto da proporre è in menu (visibile) e il cui «quando» esiste ancora.
// `visible`: i prodotti del menu pubblico ({ id, category }). Mai altro che id e nomi di categoria, già pubblici.
export function publicRules(rules, visible) {
  const ids = new Set(visible.map(p => p.id));
  const categories = new Set(visible.map(p => p.category));
  return rules.filter(r => ids.has(r.suggest) && (r.category ? categories.has(r.category) : ids.has(r.product)) && r.product !== r.suggest);
}

export async function loadRules(db) {
  const { rows } = await db.query('SELECT value FROM settings WHERE key = $1', [SUGGESTIONS_KEY]);
  return parseRules(rows[0]?.value);
}
