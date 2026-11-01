// Come un elenco di prodotti segue gli avvisi in tempo reale del server (WebSocket): lo usano la cassa delle sagre e la sala/asporto del
// ristorante, così una tessera non resta mai con la disponibilità vecchia. Logica pura (provata in productEvents.test.js).
// Gli eventi: product_created / product_updated (riga intera), product_deleted (id), product_stock_updated (solo scorta e visibilità),
// category_order_updated (il nuovo ordine delle categorie: l'elenco si riordina).

import { sortByCategoryOrder } from './categoryOrder.js';

const withNumberPrice = (product) => ({ ...product, price: parseFloat(product.price) });

// Aggiunge il prodotto, o lo sostituisce se c'è già (stesso id): idempotente, quindi non importa se per primo arriva l'avviso del server o la risposta
// di chi l'ha salvato. Ritorna un nuovo elenco.
export const upsertProduct = (products, product) => {
  const next = withNumberPrice(product);
  return products.some(p => p.id === next.id) ? products.map(p => (p.id === next.id ? next : p)) : [...products, next];
};

// Il messaggio da mostrare per l'avviso di un altro utente (`{ text, tone }`), o null se l'evento non va annunciato (scorta, ordine delle categorie).
// `products` è l'elenco di prima dell'avviso: un prodotto eliminato si riconosce da lì. Chi ha fatto la modifica ha già il suo messaggio.
export function productNotice(msg, products) {
  switch (msg?.type) {
    case 'product_created': return { text: `Aggiunto «${msg.product.name}»`, tone: 'success' };
    case 'product_updated': return { text: `«${msg.product.name}» aggiornato`, tone: 'success' };
    case 'product_deleted': { const gone = products.find(p => p.id === msg.id); return { text: gone ? `«${gone.name}» rimosso` : 'Un prodotto è stato rimosso', tone: 'warning' }; }
    default: return null;
  }
}

// Ritorna l'elenco aggiornato dall'evento `msg`, oppure lo stesso elenco (stessa identità) se l'evento non lo riguarda.
export function applyProductEvent(products, msg) {
  switch (msg?.type) {
    case 'product_created': return upsertProduct(products, msg.product);
    case 'product_updated': return products.map(p => (p.id === msg.product.id ? withNumberPrice(msg.product) : p));
    case 'category_order_updated': return sortByCategoryOrder(products, msg.order ?? []);
    case 'product_deleted': return products.filter(p => p.id !== msg.id);
    case 'product_stock_updated': {
      const { id, stock, stock_enabled: stockEnabled, visible } = msg.product;
      // `stock_enabled` non c'è negli avvisi più vecchi: allora si tiene quello che già si sa
      return products.map(p => (p.id === id ? { ...p, stock, visible, ...(stockEnabled !== undefined && { stock_enabled: stockEnabled }) } : p));
    }
    default: return products;
  }
}

// Un prodotto è esaurito quando la scorta è contata e finita (resta in carta, in grigio).
export const isSoldOut = (product) => !!product.stock_enabled && product.stock !== null && product.stock <= 0;
