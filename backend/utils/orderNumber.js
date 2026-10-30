// Il numero di un ordine: un solo modo di darlo, uguale per ogni tipo di locale (sagra, ristorante, asporto).
// Ogni ordine ha un `number` dentro la sua serata. Può venire da due fonti:
//   • una cassa (stand): lettera del dispositivo + il suo progressivo, battuto e stampato dalla cassa anche offline → «A13»;
//   • il server (sala, asporto, ordini senza cassa): il progressivo della serata, assegnato sotto lock → «23».
// Come lo si scrive (`code`, salvato in `orders.display_code`) dipende dalla fonte; il database ha sempre il numero.
// Funzioni pure, provate in tests/orderNumber.test.js; `nextServerNumber` è l'unico punto che incrementa il progressivo del server.

// Il numero e il codice di un ordine. Con `letter` vale il progressivo della cassa (`deviceSeq`), altrimenti quello del server (`counter`).
export function orderNumber({ letter = null, deviceSeq = null, counter = null }) {
  if (letter) return { number: deviceSeq, code: `${letter}${deviceSeq}` };
  return { number: counter, code: String(counter) };
}

// Prossimo numero del server per la serata `sessionId`: il lock sulla riga mette in fila chi numera insieme.
export async function nextServerNumber(db, sessionId) {
  const { rows } = await db.query('UPDATE sessions SET order_counter = order_counter + 1 WHERE id = $1 RETURNING order_counter', [sessionId]);
  return orderNumber({ counter: rows[0].order_counter });
}
