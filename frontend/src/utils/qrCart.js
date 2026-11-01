// Il QR del menu pubblico è una scelta del cliente, non un dato affidabile: di ogni riga contano
// solo id e quantità. Nome, prezzo e destinazione di stampa si leggono dal catalogo della cassa.
const MAX_QUANTITY = 999;

// Il formato del QR (versione 1): `SE1:` e poi le righe separate da `+`, ognuna `id` oppure `id*quantità` (la quantità 1 non si scrive).
// Esempio: `SE1:1204*2+1207+1311*3`. Solo maiuscole, cifre e `* + :` perché sono i caratteri della modalità «alfanumerica» dei QR, che
// occupa circa la metà del testo normale: con 25 prodotti il QR ha 41 quadratini per lato invece di 97, e si legge anche da lontano.
// Prima era un JSON in base64 (3-4 volte più lungo); la cassa legge ancora quello, per i QR già salvati o stampati.
const PREFIX = 'SE1:';
const LINE = /^(\d{1,9})(?:\*(\d{1,4}))?$/;

export function encodeCart(lines) {
  if (!lines.length) return '';
  return PREFIX + lines.map(l => (l.quantity > 1 ? `${l.id}*${l.quantity}` : `${l.id}`)).join('+');
}

// Dal testo del QR alle righe `{ id, quantity }`; `null` se non è un QR di SmartEats che si riconosce.
export function decodeCart(text) {
  if (typeof text !== 'string') return null;
  if (text.startsWith(PREFIX)) {
    const lines = [];
    for (const part of text.slice(PREFIX.length).split('+')) {
      const m = LINE.exec(part);
      if (!m) return null;
      lines.push({ id: Number(m[1]), quantity: m[2] ? Number(m[2]) : 1 });
    }
    return lines;
  }
  try {                                                  // formato precedente: JSON in base64
    const lines = JSON.parse(atob(text));
    return Array.isArray(lines) ? lines : null;
  } catch { return null; }
}

export function itemsFromQr(rawItems, products) {
  if (!Array.isArray(rawItems)) return [];
  const byId = new Map(products.map(p => [p.id, p]));
  const items = [];
  for (const raw of rawItems) {
    const product = byId.get(Number(raw?.id));
    const quantity = Math.trunc(Number(raw?.quantity));
    if (!product || !(quantity > 0)) continue;
    items.push({ ...product, quantity: Math.min(quantity, MAX_QUANTITY), type: 'sale', discountMode: null, discountValue: null, note: '' });
  }
  return items;
}
