// Gli allergeni nell'interfaccia: l'elenco (gli stessi codici del server, backend/utils/allergens.js), come si scrivono in una frase e quali
// toccano chi deve evitarne alcuni. Funzioni pure, provate in allergens.test.js. I nomi sono nelle lingue dell'app (i18n/messages/*).
export const ALLERGEN_IDS = ['gluten', 'crustaceans', 'eggs', 'fish', 'peanuts', 'soybeans', 'milk', 'tree_nuts', 'celery', 'mustard', 'sesame', 'sulphites', 'lupin', 'molluscs'];

// Gli allergeni di un prodotto (elenco, anche se manca) nell'ordine dell'allegato.
export const allergensOf = (product) => ALLERGEN_IDS.filter(id => product?.allergens?.includes(id));

// Quelli che un prodotto ha tra gli allergeni da evitare.
export const conflicts = (product, avoid) => allergensOf(product).filter(id => avoid.includes(id));

// «latte, glutine» → una sola frase. `name(id)` dà il nome nella lingua scelta.
export const listText = (ids, name) => ids.map(name).join(', ');

// Gli allergeni da evitare, da ciò che è salvato su questo telefono: solo codici validi.
export const parseAvoid = (stored) => {
  try { const list = JSON.parse(stored); return Array.isArray(list) ? ALLERGEN_IDS.filter(id => list.includes(id)) : []; } catch { return []; }
};

// Aggiunge o toglie un allergene dall'elenco di quelli da evitare.
export const toggleAvoid = (avoid, id) => ALLERGEN_IDS.filter(x => (x === id ? !avoid.includes(id) : avoid.includes(x)));
