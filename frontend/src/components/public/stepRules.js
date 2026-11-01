import { textIn } from '../../i18n/useLanguage.js';

// L'avanzamento dei passi di un ordine o di una prenotazione, senza grafica (provato in stepRules.test.js).
// `steps`: [{ id, label, done }] nell'ordine in cui si compilano. Il passo «di adesso» è il primo non ancora completato.
export function progressOf(steps) {
  const doneCount = steps.filter(s => s.done).length;
  const current = steps.findIndex(s => !s.done);       // -1 = tutto completato
  return { doneCount, total: steps.length, currentIndex: current, complete: current === -1, currentLabel: current === -1 ? null : steps[current].label };
}

// Lo stato di un singolo pallino: completato, di adesso o ancora da fare.
export const dotState = (steps, index) => (steps[index].done ? 'done' : index === progressOf(steps).currentIndex ? 'current' : 'todo');

// La frase per chi usa lo screen reader e per il testo accanto ai pallini. `t`: la traduzione (di partenza l'italiano).
export function progressText(steps, t = (key, params) => textIn('it', key, params)) {
  const p = progressOf(steps);
  return p.complete ? t('step.allDone', { total: p.total }) : t('step.current', { n: p.currentIndex + 1, total: p.total, label: p.currentLabel });
}
