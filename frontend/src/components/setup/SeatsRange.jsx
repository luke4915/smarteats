// I posti di un tavolo come intervallo: «da 4 a 6». Il minimo è facoltativo (vuoto = tavolo fisso, solo il massimo).
// Un gruppo più piccolo del minimo può comunque sedersi: il minimo serve a scegliere il tavolo giusto, non a vietare.
const field = 'h-9 px-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-main)] outline-none focus:border-[var(--accent)] w-16 text-center tabular-nums';

const SeatsRange = ({ min, max, onChange }) => (
  <span className="inline-flex items-center gap-1.5" role="group" aria-label="Posti del tavolo">
    <input className={field} aria-label="Posti minimi" placeholder="min" type="number" min={1} max={99} value={min} onChange={e => onChange({ min: e.target.value, max })} />
    <span className="text-[var(--text-muted)]" aria-hidden="true">–</span>
    <input className={field} aria-label="Posti" placeholder="max" type="number" min={1} max={99} value={max} onChange={e => onChange({ min, max: e.target.value })} />
  </span>
);

export default SeatsRange;
