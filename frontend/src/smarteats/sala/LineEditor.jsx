import { Minus, Plus, Trash2 } from 'lucide-react';
import PanelFrame from './PanelFrame';
import { formatEuro } from './checkMath';
import { btnPrimary, btnDanger } from './ui';
import { moveLine } from './courses';

// Un piatto della comanda, aperto per intero: quantità, nota per la cucina e con quale uscita esce. Sostituisce l'elenco
// nello stesso pannello (niente finestre sopra le finestre). Le modifiche valgono subito; «Fatto» torna alla comanda.
const LineEditor = ({ line, index, schedule, onChange, onRemove, onBack, canIncrease }) => {
  const current = schedule.uscite.find(u => u.lines.includes(line));
  const last = schedule.uscite[schedule.uscite.length - 1];

  const goTo = (to) => onChange((cart) => moveLine(cart, index, to, schedule));
  const setQty = (delta) => onChange((cart) => cart.flatMap((l, i) => {
    if (i !== index) return [l];
    const quantity = l.quantity + delta;
    return quantity > 0 ? [{ ...l, quantity }] : [];
  }));

  return (
    <PanelFrame title={line.name} subtitle={`${formatEuro(line.price)} l'uno`} onBack={onBack}
      footer={<button className={`${btnPrimary} w-full !h-14 !text-base`} onClick={onBack}>Fatto</button>}>
      <div className="space-y-6 px-1 pb-2">
        <section className="flex items-center justify-between gap-4">
          <span className="text-base font-medium text-[var(--text-main)]">Quantità</span>
          <div className="flex items-center gap-1">
            <button className="h-12 w-12 rounded-lg border border-[var(--border)] flex items-center justify-center text-[var(--text-main)] active:scale-95" aria-label="Una in meno" onClick={() => (line.quantity === 1 ? (onRemove(), onBack()) : setQty(-1))}>
              {line.quantity === 1 ? <Trash2 size={18} className="text-red-500" /> : <Minus size={18} />}
            </button>
            <span className="w-12 text-center text-2xl font-semibold tabular-nums text-[var(--text-main)]">{line.quantity}</span>
            <button className="h-12 w-12 rounded-lg border border-[var(--border)] flex items-center justify-center text-[var(--text-main)] active:scale-95 disabled:opacity-40" aria-label="Una in più" disabled={!canIncrease} onClick={() => setQty(+1)}><Plus size={18} /></button>
          </div>
        </section>

        <section>
          <label className="text-base font-medium text-[var(--text-main)]" htmlFor="line-note">Nota per la cucina</label>
          <textarea id="line-note" rows={3} maxLength={300} autoFocus value={line.note}
            onChange={e => onChange((cart) => cart.map((l, i) => (i === index ? { ...l, note: e.target.value.toUpperCase() } : l)))}
            placeholder="Es. SENZA CIPOLLA, BEN COTTO"
            className="mt-2 w-full p-3 rounded-lg bg-[var(--bg-card-2)] border border-[var(--border)] text-[var(--text-main)] text-base placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] resize-none" />
        </section>

        {schedule.uscite.length > 0 && (
          <section>
            <p className="text-base font-medium text-[var(--text-main)]">Quando esce</p>
            <div className="mt-2 space-y-2" role="group" aria-label="Uscita">
              {schedule.uscite.map(u => {
                const on = current?.raw === u.raw;
                return (
                  <button key={u.raw} aria-pressed={on} onClick={() => goTo({ raw: u.raw })}
                    className={`w-full flex items-center gap-3 min-h-12 px-3 py-2 rounded-lg border text-left transition ${on ? 'border-[var(--accent)] bg-[var(--accent)]/10' : 'border-[var(--border)] hover:border-[var(--border-hover)]'}`}>
                    <span className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold ${on ? 'bg-[var(--accent)] text-white' : 'border border-[var(--border-hover)] text-[var(--text-main)]'}`}>{u.index}</span>
                    <span className="text-base text-[var(--text-main)]">{u.index === 1 ? 'Subito' : 'Poi'}<span className="text-[var(--text-muted)]"> · {u.courses.map(c => c.name).join(' + ')}</span></span>
                  </button>
                );
              })}
              <button onClick={() => goTo({ after: last.raw })}
                className="w-full min-h-12 px-3 rounded-lg border border-dashed border-[var(--border-hover)] text-base text-[var(--text-muted)] hover:text-[var(--text-main)] text-left">
                + In una nuova uscita, per ultimo
              </button>
            </div>
          </section>
        )}

        <button className={`${btnDanger} w-full`} onClick={() => { onRemove(); onBack(); }}><Trash2 size={16} /> Togli dalla comanda</button>
      </div>
    </PanelFrame>
  );
};

export default LineEditor;
