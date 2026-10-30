import { Fragment } from 'react';
import { Check } from 'lucide-react';
import { dotState, progressOf, progressText } from './stepRules';

// La barra dei passi in cima alle pagine dei clienti (ordine da asporto, prenotazione): un pallino per passo che si riempie quando il passo
// è completo, e accanto «Passo 2 di 4: Quando ritiri?». Resta in alto mentre si scorre. Toccando un pallino si va alla sua sezione
// (`StepSection` con lo stesso `id`). Le regole di avanzamento stanno in `stepRules.js`.
const StepProgress = ({ steps }) => {
  const p = progressOf(steps);
  const goTo = (id) => document.getElementById(`step-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <div className="sticky top-0 z-10 -mx-4 px-4 py-2.5 bg-[var(--bg-main)] border-b border-[var(--border)]">
      <div className="flex items-center gap-3">
        <ol aria-label={progressText(steps)} className="flex items-center shrink-0">
          {steps.map((s, i) => {
            const state = dotState(steps, i);
            return (
              <Fragment key={s.id}>
                {i > 0 && <li aria-hidden="true" className={`w-4 h-0.5 rounded-full transition-colors ${steps[i - 1].done ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`} />}
                <li>
                  <button type="button" onClick={() => goTo(s.id)} aria-label={`${s.label}${state === 'done' ? ' (completato)' : ''}`} aria-current={state === 'current' ? 'step' : undefined}
                    className="flex items-center justify-center w-8 h-8 -mx-1 cursor-pointer">
                    <span className={`flex items-center justify-center rounded-full transition-all ${state === 'done' ? 'w-4 h-4 bg-[var(--accent)] text-white' : state === 'current' ? 'w-4 h-4 border-2 border-[var(--accent)]' : 'w-3 h-3 border-2 border-[var(--border-hover)]'}`}>
                      {state === 'done' && <Check size={10} strokeWidth={3.5} />}
                    </span>
                  </button>
                </li>
              </Fragment>
            );
          })}
        </ol>
        <p aria-live="polite" className="min-w-0 flex-1 truncate text-xs text-[var(--text-muted)]">
          {p.complete ? 'Tutto pronto' : <><span className="tabular-nums">Passo {p.currentIndex + 1} di {p.total}</span> · <span className="text-[var(--text-main)]">{p.currentLabel}</span></>}
        </p>
      </div>
    </div>
  );
};

export default StepProgress;
