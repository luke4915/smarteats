// Le pagine che aprono i clienti (prenotazioni, ordini da asporto): niente menu né login, pensate per il telefono.
// Il body dell'app è bloccato (`overflow: hidden`): la pagina scorre dentro un proprio contenitore (CLAUDE.md §7).
// Il tema del dispositivo lo applica `useSystemTheme` (hooks/useSystemTheme.js).

export const PublicShell = ({ info, kicker, children, footer = null }) => (
  <div className="se-app fixed inset-0 overflow-y-auto overscroll-contain bg-[var(--bg-main)] text-[var(--text-main)]" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
    <main className="max-w-md sm:max-w-3xl mx-auto px-4 pt-6 sm:pt-8 space-y-6" style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>
      {info && (
        <header className="space-y-1">
          <p className="text-sm text-[var(--text-muted)]">{kicker}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{info.name}</h1>
          {info.welcome && <p className="text-sm text-[var(--text-muted)] pt-1">{info.welcome}</p>}
        </header>
      )}
      {children}
      {info?.phone && (
        <p className="text-sm text-[var(--text-muted)] text-center pt-2">
          Preferite telefonare? <a className="inline-block py-2 text-[var(--accent)] font-medium" href={`tel:${info.phone.replace(/[^\d+]/g, '')}`}>{info.phone}</a>
        </p>
      )}
      {footer}
      <div aria-hidden="true" style={{ height: 'env(safe-area-inset-bottom)' }} />
    </main>
  </div>
);

export const StepSection = ({ n, title, children }) => (
  <section className="space-y-3">
    <h2 className="text-base font-semibold flex items-center gap-2">
      <span className="w-6 h-6 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] text-sm flex items-center justify-center tabular-nums">{n}</span>{title}
    </h2>
    {children}
  </section>
);
