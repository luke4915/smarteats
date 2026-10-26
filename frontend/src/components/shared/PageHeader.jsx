// Testata comune a tutte le pagine di lavoro (statistiche, menu, impostazioni…), nella sagra come nel ristorante:
// stesso titolo, stessa riga di spiegazione, azioni a destra. Il contenuto sta in `PageBody`, sempre alla stessa larghezza.
// Sul telefono il titolo non si ripete: il nome della pagina sta già nella testata, qui restano la spiegazione e le azioni.
export const PageHeader = ({ title, subtitle, children }) => (
  <header className="flex flex-wrap items-end justify-between gap-3">
    <div className="min-w-0">
      <h2 className="hidden md:block text-2xl font-semibold tracking-tight text-[var(--text-main)]">{title}</h2>
      {subtitle && <p className="text-sm text-[var(--text-muted)] md:mt-0.5 [@media(max-height:520px)]:hidden">{subtitle}</p>}
    </div>
    {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
  </header>
);

export const PageBody = ({ children, className = '' }) => (
  <div className={`max-w-5xl mx-auto w-full space-y-6 pb-8 ${className}`}>{children}</div>
);
