import { modeOf } from './availability.js';

// Cosa mostra l'elenco dei prodotti, senza grafica (provato in catalogView.test.js): i gruppi per categoria con i filtri, i conti dei
// nascosti e la selezione di più prodotti.
export const isHidden = (product) => product.visible === false;
const categoryOf = (product) => product.category || 'Generico';   // come nella carta della cassa

export const isSoldOut = (product) => modeOf(product) === 'soldout';

// 'all' tutti (i nascosti restano in elenco, in grigio), 'visible' solo quelli in uso, 'soldout' gli esauriti, 'hidden' solo quelli nascosti.
export const VIEWS = { all: () => true, visible: (p) => !isHidden(p), soldout: isSoldOut, hidden: isHidden };

export const hiddenCount = (products) => products.filter(isHidden).length;
export const soldOutCount = (products) => products.filter(isSoldOut).length;

// I gruppi nell'ordine in cui compaiono le categorie. `category`: 'all' o il nome; `search`: pezzi del nome, senza distinguere le maiuscole.
export function buildGroups(products, { category = 'all', search = '', view = 'all' } = {}) {
  const term = search.trim().toLowerCase();
  const keep = VIEWS[view] ?? VIEWS.all;
  const groups = new Map();
  for (const p of products) {
    const c = categoryOf(p);
    if (category !== 'all' && c !== category) continue;
    if (!keep(p) || (term && !p.name.toLowerCase().includes(term))) continue;
    if (!groups.has(c)) groups.set(c, []);
    groups.get(c).push(p);
  }
  return [...groups].map(([name, items]) => ({ category: name, items }));
}

export const categoriesOf = (products) => [...new Set(products.map(categoryOf))];

// «Tutti / Nessuno»: se tutti gli `ids` sono già scelti li toglie, altrimenti aggiunge quelli che mancano. Non tocca gli altri.
export function toggleMany(selected, ids) {
  const all = ids.every(id => selected.includes(id));
  return all ? selected.filter(id => !ids.includes(id)) : [...selected, ...ids.filter(id => !selected.includes(id))];
}

export const allSelected = (selected, ids) => ids.length > 0 && ids.every(id => selected.includes(id));

export const plural = (noun) => (noun === 'piatto' ? 'piatti' : 'prodotti');

// «3 selezionati» / «Tocca i prodotti da cambiare»
export const selectionText = (count, noun) => (count === 0 ? `Tocca i ${plural(noun)} da cambiare` : count === 1 ? '1 selezionato' : `${count} selezionati`);

// Le scelte del filtro per stato, con i conti: «Tutti» c'è sempre; le altre solo se hanno qualcosa da mostrare (senza nascosti né esauriti
// il filtro non serve e non compare).
export function viewOptions(products) {
  const hidden = hiddenCount(products);
  const soldOut = soldOutCount(products);
  if (!hidden && !soldOut) return [];
  return [
    { id: 'all', label: 'Tutti' },
    hidden > 0 && { id: 'visible', label: 'Visibili' },
    soldOut > 0 && { id: 'soldout', label: `Esauriti ${soldOut}` },
    hidden > 0 && { id: 'hidden', label: `Nascosti ${hidden}` },
  ].filter(Boolean);
}

// Il filtro scelto, se esiste ancora (se l'ultimo nascosto torna visibile, «Nascosti» sparisce e si torna a «Tutti»).
export const effectiveView = (products, chosen) => (viewOptions(products).some(o => o.id === chosen) ? chosen : 'all');
