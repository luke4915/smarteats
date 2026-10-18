// Il modulo «prodotto» (nome, prezzo, categoria, portata…): logica pura, senza React, così si legge e si prova da sola.
// Il server ricontrolla tutto (backend/schemas/productSchema.js): qui si evita solo di mandare dati evidentemente sbagliati.

export const DEFAULT_COLOR = '#3b82f6';

// Il modulo di un prodotto nuovo. I campi in più dipendono dal locale: la portata e le opzioni solo nei ristoranti,
// il carico sul forno solo con l'asporto.
export function blankForm({ courses = null, takeawayEnabled = false, modifierGroups = null } = {}) {
  return {
    name: '', price: '', category: '', color: DEFAULT_COLOR, visible: true, print_destination: 'both',
    ...(courses && { course_id: null }),
    ...(takeawayEnabled && { takeaway_load: 1 }),
    ...(modifierGroups && { modifier_group_ids: [] }),
    stock_enabled: false, stock: '',
  };
}

// Il modulo precompilato con un prodotto esistente.
export function formFromProduct(product, { courses = null, takeawayEnabled = false, modifierGroups = null } = {}) {
  return {
    name: product.name || '',
    price: product.price !== undefined && product.price !== null ? String(product.price) : '',
    category: product.category || '',
    color: product.color || DEFAULT_COLOR,
    visible: product.visible ?? true,
    print_destination: product.print_destination || 'both',
    ...(courses && { course_id: product.course_id ?? null }),
    ...(takeawayEnabled && { takeaway_load: product.takeaway_load ?? 1 }),
    ...(modifierGroups && { modifier_group_ids: modifierGroups.filter(g => g.product_ids.includes(product.id)).map(g => g.id) }),
    stock_enabled: product.stock_enabled ?? false,
    stock: product.stock !== undefined && product.stock !== null ? String(product.stock) : '',
  };
}

// Mentre si scrive il prezzo: accetta la virgola e al massimo due decimali. Ritorna il testo da tenere, o null se l'ultima battuta non va.
export function cleanPriceInput(text) {
  const value = text.replace(',', '.');
  return /^\d*\.?\d{0,2}$/.test(value) ? value : null;
}

const same = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

// Il colore già usato da altri prodotti della stessa categoria (così una categoria ha un solo colore), o null.
export function colorOfCategory(products, category) {
  if (!category.trim()) return null;
  return products.find(p => p.category && same(p.category, category) && p.color)?.color ?? null;
}

// I nomi da suggerire mentre si scrive: quelli della categoria scelta (se esiste), altrimenti tutti.
export function namesForCategory(products, category) {
  const inCategory = products.filter(p => same(p.category, category));
  const pool = category.trim() && inCategory.length ? inCategory : products;
  return [...new Set(pool.map(p => p.name).filter(Boolean))];
}

// Un prodotto con lo stesso nome esiste già? Ritorna { product, sameCategory } oppure null. Lo stesso prodotto in modifica non conta.
export function findNameConflict(products, form, editingId = null) {
  const others = products.filter(p => p.id !== editingId && same(p.name, form.name));
  const exact = others.find(p => same(p.category, form.category));
  if (exact) return { product: exact, sameCategory: true };
  return others[0] ? { product: others[0], sameCategory: false } : null;
}

// Con la disponibilità limitata serve una quantità valida (numero intero, zero o più).
export function stockProblem(form) {
  if (!form.stock_enabled) return null;
  const quantity = parseInt(form.stock, 10);
  return form.stock === '' || Number.isNaN(quantity) || quantity < 0 ? 'Inserisci una quantità valida per la disponibilità limitata' : null;
}

// Ciò che si manda al server per salvare il prodotto (il prezzo diventa un numero).
export const buildPayload = (form) => ({ ...form, price: parseFloat(String(form.price).replace(',', '.')) || 0 });

// Le categorie con il loro colore, una sola volta ciascuna (per le pastiglie di scelta rapida del colore).
export function categoryColors(products) {
  return [...new Map(products.filter(p => p.category && p.color).map(p => [p.category.toLowerCase(), p])).values()]
    .map(p => ({ id: p.id, category: p.category, color: p.color }));
}
