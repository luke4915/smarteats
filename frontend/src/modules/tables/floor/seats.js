// L'intervallo di posti di un tavolo («da 4 a 6») e quanto un gruppo ci sta bene. Logica pura, con test (seats.test.js).
// `seats` è il massimo (non si supera mai), `seats_min` da quante persone conviene usarlo: un gruppo più piccolo si può
// comunque sedere, ma costa un po' di «spreco», così la scelta lo evita se c'è di meglio.

export const minOf = (table) => table.seats_min ?? table.seatsMin ?? table.seats;
export const maxOf = (table) => table.seats;

// Il minimo che conta davvero: un tavolo fisso (minimo = massimo) non ha un «sotto il minimo», perché nessuno lo ha scelto.
export const effectiveMin = (table) => (minOf(table) < maxOf(table) ? minOf(table) : 1);

// «4–6», oppure «4» se il tavolo è fisso.
export const seatsLabel = (table) => (minOf(table) < maxOf(table) ? `${minOf(table)}–${maxOf(table)}` : `${maxOf(table)}`);

// Pesi della scelta (in «posti equivalenti»): un posto vuoto sopra il gruppo costa 1; un posto sotto il minimo del tavolo
// (gruppo troppo piccolo per quel tavolo) costa di più, perché toglie un tavolo grande a chi ne ha bisogno; unire un
// tavolo in più costa lavoro in sala.
const UNDER_MIN_WEIGHT = 2;
const EXTRA_TABLE_COST = 3;

// Come sta un gruppo in un insieme di tavoli con minimo totale `minSum` e massimo `maxSum`. Ritorna null se non ci sta.
//   waste     posti vuoti rispetto al massimo (più è basso, meglio si riempie)
//   shortfall di quanto il gruppo è sotto il minimo (0 se è nell'intervallo)
export function fitOf(party, minSum, maxSum) {
  if (party > maxSum) return null;
  return { waste: maxSum - party, shortfall: Math.max(0, minSum - party) };
}

// Il costo di una scelta: più basso = meglio. `count` è il numero di tavoli uniti.
export const fitCost = ({ waste, shortfall }, count = 1) => waste + UNDER_MIN_WEIGHT * shortfall + EXTRA_TABLE_COST * (count - 1);

// Dal modulo dei posti ai dati da mandare al server: il minimo vuoto non si manda (il server lo pone uguale al massimo).
export const rangeBody = ({ min, max }) => ({ seats: Number(max), ...(min !== '' && min != null ? { seats_min: Number(min) } : {}) });
