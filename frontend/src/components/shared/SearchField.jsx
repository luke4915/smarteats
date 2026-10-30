import { Search, X } from 'lucide-react';

// L'unico campo di ricerca di tutta l'app (carta, ingredienti, prodotti, locali…): un campo con gli stessi angoli degli altri (`rounded-lg`), con la lente a sinistra e la X per
// svuotare a destra. Stessa altezza dei campi (44 px, comoda col dito), tastiera «Cerca» su iPhone e iPad, niente correzioni automatiche.
// Non se ne fanno altri: serve una ricerca nuova, si usa questo.  `label` è il nome per lo screen reader e per i test.
const SearchField = ({ value, onChange, placeholder = 'Cerca…', label, className = '' }) => (
  <div className={`relative min-w-0 ${className}`}>
    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" aria-hidden="true" />
    <input type="text" inputMode="search" enterKeyHint="search" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
      value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={label ?? placeholder}
      className="w-full h-11 pl-11 pr-11 rounded-lg bg-[var(--bg-card-2)] border border-[var(--border)] text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] transition focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/25" />
    {value && (
      <button type="button" onClick={() => onChange('')} aria-label="Svuota la ricerca"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 coarse:w-10 coarse:h-10 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card)] cursor-pointer"><X size={14} /></button>)}
  </div>
);

export default SearchField;
