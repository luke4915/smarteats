// Parole e coordinate della matrice del menu, senza grafica. Funzioni pure, provate in matrixData.test.js.
// I quattro gruppi sono quelli del «menu engineering»: popolarità (si vende molto?) per rendimento (rende bene a ogni pezzo?).

export const GROUPS = [
  { id: 'star', title: 'Punti di forza', note: 'Si vendono molto e rendono bene', advice: 'Tienili in evidenza e non toccarli.' },
  { id: 'workhorse', title: 'Molto venduti, rendono poco', note: 'Piacciono, ma lasciano poco a ogni pezzo', advice: 'Prova un piccolo ritocco di prezzo o un costo più basso.' },
  { id: 'puzzle', title: 'Rendono bene, si vendono poco', note: 'Lasciano molto, ma pochi li scelgono', advice: 'Dai loro più visibilità: proponili a voce, mettili in alto nel menu.' },
  { id: 'dog', title: 'Da rivedere', note: 'Si vendono poco e rendono poco', advice: 'Valuta se toglierli o rifarli.' },
];

// Cosa misura l'asse del rendimento, secondo i dati disponibili.
export const valueLabel = (mode) => (mode === 'margin' ? 'Margine per pezzo' : 'Ricavo per pezzo');
export const valueNote = (mode) => (mode === 'margin'
  ? 'Ricavo senza IVA meno il costo della ricetta.'
  : 'Senza i costi delle ricette non si può calcolare il margine: conta il prezzo senza IVA. Con le ricette nel Magazzino la matrice userà il margine.');

// Posizione di un prodotto nel grafico, in percentuale (0-100) da sinistra e dal basso; gli assi partono da zero e lasciano un po' d'aria.
export function pointPosition(item, { maxQuantity, maxValue }) {
  const clamp = (v) => Math.min(100, Math.max(0, v));
  return { x: clamp((item.quantity / (maxQuantity * 1.08)) * 100), y: clamp((item.valueCents / (maxValue * 1.1)) * 100) };
}

// Le righe da mostrare per un gruppo, in ordine di vendite.
export const itemsOf = (items, group) => items.filter(i => i.klass === group);

// Quanto pesa un gruppo sulle vendite, in percentuale (somma delle quote dei suoi prodotti).
export const groupShare = (items, group) => Math.round(itemsOf(items, group).reduce((s, i) => s + i.share, 0) * 10) / 10;
