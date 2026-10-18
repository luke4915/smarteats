// L'interruttore acceso/spento di tutta l'app (impostazioni, preferenze): un solo aspetto, scorre con dolcezza.
// `label` è il nome per chi usa lo screen reader e per i test; `onChange` riceve il nuovo valore.
const Switch = ({ checked, onChange, label, disabled = false }) => (
  <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
    className={`shrink-0 w-11 h-6 p-0.5 rounded-full cursor-pointer transition-colors disabled:opacity-40 disabled:pointer-events-none ${checked ? 'bg-[var(--accent)]' : 'bg-[var(--border-hover)]'}`}>
    <span className={`block w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
  </button>
);

export default Switch;
