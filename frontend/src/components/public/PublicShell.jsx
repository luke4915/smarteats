import { Check } from 'lucide-react';

// Le pagine che aprono i clienti (prenotazioni, ordini da asporto): niente menu né login, pensate per il telefono.
// Il body dell'app è bloccato (`overflow: hidden`): la pagina scorre dentro un proprio contenitore (CLAUDE.md §7).
// Il tema del dispositivo lo applica `useSystemTheme` (hooks/useSystemTheme.js).

export const PublicShell = ({ info, kicker, children, footer = null }) => (
  <div className="fixed inset-0 overflow-y-auto overscroll-contain bg-[var(--bg-main)] text-[var(--text-main)]" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
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
      <p className="text-xs text-[var(--text-muted)] text-center pb-4">
        <a className="hover:underline" href="/privacy">Privacy</a> · <a className="hover:underline" href="/terms">Condizioni d'uso</a>
      </p>
      <div aria-hidden="true" style={{ height: 'env(safe-area-inset-bottom)' }} />
    </main>
  </div>
);

// Una sezione numerata del modulo. `id` la rende raggiungibile dai pallini di `StepProgress`; `done` cambia il numero in una spunta.
export const StepSection = ({ id, n, title, done = false, children }) => (
  <section id={id ? `step-${id}` : undefined} className="space-y-3 scroll-mt-16">
    <h2 className="text-base font-semibold flex items-center gap-2">
      <span className={`w-6 h-6 rounded-full text-sm flex items-center justify-center tabular-nums transition-colors ${done ? 'bg-[var(--accent)] text-white' : 'bg-[var(--accent)]/15 text-[var(--accent)]'}`}>{done ? <Check size={14} strokeWidth={3} /> : n}</span>{title}
    </h2>
    {children}
  </section>
);
