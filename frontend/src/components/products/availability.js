// La disponibilità di un prodotto vista dalla cassa, senza grafica (provata in availability.test.js). Tre stati, uno solo alla volta:
//   unlimited  nessun limite: si può sempre ordinare
//   portions   ne restano N (nella scheda si chiama «Quantità»: «Porzioni» è la regola di azzeramento del modulo prodotto, un'altra cosa) (al server: stock_enabled + stock)
//   soldout    finito: resta in carta, in grigio, e non si ordina (stock_enabled + stock a zero)
export const MODES = [
  { id: 'unlimited', label: 'Disponibile' },
  { id: 'portions', label: 'Quantità' },
  { id: 'soldout', label: 'Esaurito' },
];

export function modeOf(product) {
  if (!product.stock_enabled || product.stock === null || product.stock === undefined) return 'unlimited';
  return product.stock <= 0 ? 'soldout' : 'portions';
}

// Come si legge lo stato di un prodotto in una riga.
export function stateLabel(product) {
  const mode = modeOf(product);
  if (mode === 'soldout') return 'Esaurito';
  if (mode === 'portions') return product.stock === 1 ? 'Ne resta 1' : `${product.stock} rimaste`;
  return 'Disponibile';
}

// Il numero con cui si apre il campo delle porzioni: quelle di adesso, o vuoto se non si contano.
export const startQuantity = (product) => (modeOf(product) === 'portions' ? String(product.stock) : '');

const isWhole = (text) => /^\d+$/.test(String(text).trim());

// Cosa manca per poter applicare, o null se va bene. Con le porzioni serve un numero intero di almeno 1 (zero è «Esaurito»).
export function quantityProblem(mode, quantity) {
  if (mode !== 'portions') return null;
  return isWhole(quantity) && Number(quantity) >= 1 ? null : 'Scrivi quante porzioni restano (almeno 1)';
}

// Il corpo di `PATCH /products/:id/stock` per lo stato scelto.
export function stockPatch(mode, quantity) {
  if (mode === 'unlimited') return { stock_enabled: false, stock: null };
  if (mode === 'soldout') return { stock_enabled: true, stock: 0 };
  return { stock_enabled: true, stock: Number(String(quantity).trim()) };
}

// Il messaggio dopo il salvataggio.
export function savedMessage(name, mode, quantity) {
  if (mode === 'soldout') return `«${name}» segnato esaurito`;
  if (mode === 'portions') return `«${name}»: ${Number(quantity) === 1 ? 'ne resta 1' : `ne restano ${Number(quantity)}`}`;
  return `«${name}» di nuovo disponibile`;
}

// Cambia solo se lo stato scelto è diverso da quello di adesso.
export function isChange(product, mode, quantity) {
  if (mode !== modeOf(product)) return true;
  return mode === 'portions' && Number(quantity) !== product.stock;
}
