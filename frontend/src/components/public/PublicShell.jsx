import { Check } from 'lucide-react';
import { useSystemTheme } from '../../hooks/useSystemTheme';
import ThemeToggle from '../shell/ThemeToggle';
import LanguageChoice from './LanguageChoice';
import { ForcedLanguage, useT, useLanguage } from '../../i18n/useLanguage';

// Le pagine che aprono i clienti (prenotazioni, ordini da asporto): niente menu né login, pensate per il telefono.
// Il body dell'app è bloccato (`overflow: hidden`): la pagina scorre dentro un proprio contenitore (CLAUDE.md §7).
// Il tema del dispositivo lo applica `useSystemTheme` (hooks/useSystemTheme.js). `translated`: la pagina è tradotta e in alto c'è la scelta della
// lingua. `true` = in tutte le lingue dell'app; un elenco (es. `['it', 'en']`) = solo in quelle, e chi ha scelto un'altra lingua legge l'inglese;
// senza, tutto ciò che contiene resta in italiano (vedi `ForcedLanguage`).

export const PublicShell = ({ info, kicker, children, footer = null, translated = false }) => {
  const [chosen] = useLanguage();
  const languages = Array.isArray(translated) ? translated : null;
  const shown = languages && !languages.includes(chosen) ? (languages.includes('en') ? 'en' : 'it') : chosen;
  return (
    <ForcedLanguage.Provider value={translated ? (languages ? shown : null) : 'it'}>
      <ShellBody info={info} kicker={kicker} footer={footer} languages={translated ? (languages ?? true) : null} shown={shown}>{children}</ShellBody>
    </ForcedLanguage.Provider>
  );
};

const ShellBody = ({ info, kicker, children, footer, languages, shown }) => {
  const [, setTheme, resolvedTheme] = useSystemTheme();
  const t = useT();
  return (
  <div className="fixed inset-0 overflow-y-auto overscroll-contain bg-[var(--bg-main)] text-[var(--text-main)]" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
    <main className="max-w-md sm:max-w-3xl mx-auto px-4 pt-6 sm:pt-8 space-y-6" style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>
      <div className="flex items-center justify-end gap-1.5 -mb-3">
        {languages && <LanguageChoice only={languages === true ? null : languages} value={shown} />}
        <ThemeToggle dark={resolvedTheme === 'dark'} onChange={setTheme} labels={{ toLight: t('theme.toLight'), toDark: t('theme.toDark') }} />
      </div>
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
        <a className="hover:underline" href="/privacy">{t('shell.privacy')}</a> · <a className="hover:underline" href="/terms">{t('shell.terms')}</a>
      </p>
      <div aria-hidden="true" style={{ height: 'env(safe-area-inset-bottom)' }} />
    </main>
  </div>
  );
};

// Una sezione numerata del modulo. `id` la rende raggiungibile dai pallini di `StepProgress`; `done` cambia il numero in una spunta.
export const StepSection = ({ id, n, title, done = false, children }) => (
  <section id={id ? `step-${id}` : undefined} className="space-y-3 scroll-mt-16">
    <h2 className="text-base font-semibold flex items-center gap-2">
      <span className={`w-6 h-6 rounded-full text-sm flex items-center justify-center tabular-nums transition-colors ${done ? 'bg-[var(--accent)] text-white' : 'bg-[var(--accent)]/15 text-[var(--accent)]'}`}>{done ? <Check size={14} strokeWidth={3} /> : n}</span>{title}
    </h2>
    {children}
  </section>
);
