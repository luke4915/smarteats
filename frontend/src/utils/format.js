// I numeri di SmartEats si scrivono sempre allo stesso modo, all'italiana (Intl «it-IT»): importi «6,00 €», durate «36,5 min».
// Un solo punto per ogni formato: nessun componente scrive a mano `toFixed(2)` per mostrare un prezzo.
const EURO = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
const ONE_DECIMAL = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// Al posto di un importo riservato (il server manda `null` finché i dati sono bloccati): puntini, mai zero.
export const RESERVED_TEXT = '•••';

// Euro (numero) → «1.234,50 €». Un valore non numerico vale zero.
export const formatEuro = (euro) => EURO.format(Number(euro) || 0);

// Centesimi → «12,50 €»; `null` (dato riservato) → puntini.
export const formatCents = (cents) => (cents === null || cents === undefined ? RESERVED_TEXT : EURO.format(cents / 100));

// Minuti con un decimale: «36,5 min».
export const formatMin = (minutes) => `${ONE_DECIMAL.format(Number(minutes) || 0)} min`;

// Da quanto tempo è occupato un tavolo, in modo compatto: «47'», «1 h 25'». I minuti sono interi.
export function formatElapsed(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  if (total < 60) return `${total}'`;
  const minutesPart = total % 60;
  return minutesPart === 0 ? `${Math.floor(total / 60)} h` : `${Math.floor(total / 60)} h ${minutesPart}'`;
}
