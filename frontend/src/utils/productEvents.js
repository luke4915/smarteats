// Come un elenco di prodotti segue gli avvisi in tempo reale del server (WebSocket): lo usano la cassa delle sagre e la sala/asporto del
// ristorante, così una tessera non resta mai con la disponibilità vecchia. Logica pura (provata in productEvents.test.js).
// Gli eventi: product_created / product_updated (riga intera), product_deleted (id), product_stock_updated (solo scorta e visibilità).

const withNumberPrice = (product) => ({ ...product, price: parseFloat(product.price) });

// Ritorna l'elenco aggiornato dall'evento `msg`, oppure lo stesso elenco (stessa identità) se l'evento non lo riguarda.
export function applyProductEvent(products, msg) {
  switch (msg?.type) {
    case 'product_created': return products.some(p => p.id === msg.product.id) ? products : [...products, withNumberPrice(msg.product)];
    case 'product_updated': return products.map(p => (p.id === msg.product.id ? withNumberPrice(msg.product) : p));
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
