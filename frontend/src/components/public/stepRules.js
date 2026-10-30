// L'avanzamento dei passi di un ordine o di una prenotazione, senza grafica (provato in stepRules.test.js).
// `steps`: [{ id, label, done }] nell'ordine in cui si compilano. Il passo «di adesso» è il primo non ancora completato.
export function progressOf(steps) {
  const doneCount = steps.filter(s => s.done).length;
  const current = steps.findIndex(s => !s.done);       // -1 = tutto completato
  return { doneCount, total: steps.length, currentIndex: current, complete: current === -1, currentLabel: current === -1 ? null : steps[current].label };
}

// Lo stato di un singolo pallino: completato, di adesso o ancora da fare.
export const dotState = (steps, index) => (steps[index].done ? 'done' : index === progressOf(steps).currentIndex ? 'current' : 'todo');

// La frase per chi usa lo screen reader e per il testo accanto ai pallini.
export function progressText(steps) {
  const p = progressOf(steps);
  return p.complete ? `Tutti i passi completati (${p.total} di ${p.total})` : `Passo ${p.currentIndex + 1} di ${p.total}: ${p.currentLabel}`;
}
