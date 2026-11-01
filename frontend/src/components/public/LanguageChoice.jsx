import { Globe } from 'lucide-react';
import { LANGUAGES } from '../../i18n/languages';
import { useLanguage, useT } from '../../i18n/useLanguage';

// La scelta della lingua nelle pagine dei clienti: un menu a tendina nativo (sul telefono è la ruota di scelta di iOS e Android), con il nome
// di ogni lingua scritto nella lingua stessa. Di partenza segue il telefono.
const LanguageChoice = () => {
  const t = useT();
  const [lang, setLang] = useLanguage();
  return (
    <label className="inline-flex items-center gap-2 h-9 coarse:h-11 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-sm text-[var(--text-main)]">
      <Globe size={15} className="text-[var(--text-muted)]" aria-hidden="true" />
      <select aria-label={t('shell.language')} value={lang} onChange={e => setLang(e.target.value)} className="bg-transparent outline-none text-base sm:text-sm cursor-pointer">
        {LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
      </select>
    </label>
  );
};

export default LanguageChoice;
