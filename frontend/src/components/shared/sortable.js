// Logica pura dell'ordinamento per trascinamento (SortableList): quale riga è più vicina, di quanto si scostano le altre.

export const reorder = (list, from, to) => {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
};

// L'indice della riga il cui centro è più vicino alla posizione `y`.
export const nearestIndex = (centers, y) =>
  centers.reduce((best, c, i) => (Math.abs(c - y) < Math.abs(centers[best] - y) ? i : best), 0);

// La transizione di una riga. Si anima solo durante il trascinamento (le altre righe che si scostano e quella che scivola al suo posto);
// a riposo no. Se restasse, al rilascio l'ordine cambierebbe e gli scostamenti tornerebbero a zero nello stesso istante: le righe, già nel
// posto giusto, animerebbero «all'indietro» dal vecchio scostamento e si vedrebbe un salto.
export const rowTransition = (drag, isDragging) => (!drag || (isDragging && !drag.settling) ? 'none' : 'transform 180ms ease');

// Quanto si sposta (in pixel, `step` = altezza della riga trascinata più lo spazio tra le righe) la riga `index` mentre
// quella `from` viene portata sopra `to`: lascia posto a chi sta in mezzo.
export function shiftFor(index, from, to, step) {
  if (index === from) return 0;
  if (from < to && index > from && index <= to) return -step;
  if (from > to && index >= to && index < from) return step;
  return 0;
}
