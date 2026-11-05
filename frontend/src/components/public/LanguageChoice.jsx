import { Globe } from 'lucide-react';
import { LANGUAGES } from '../../i18n/languages';
import { useLanguage, useT } from '../../i18n/useLanguage';

// La scelta della lingua nelle pagine dei clienti: un menu a tendina nativo (sul telefono è la ruota di scelta di iOS e Android), con il nome
// di ogni lingua scritto nella lingua stessa. Di partenza segue il telefono.
// `only`: le lingue in cui la pagina è tradotta (senza, tutte); `value`: quella che si sta leggendo davvero.
const LanguageChoice = ({ only = null, value = null }) => {
  const t = useT();
  const [chosen, setLang] = useLanguage();
  const lang = value ?? chosen;
  return (
    <label className="inline-flex items-center gap-1.5 h-9 coarse:h-11 pl-2.5 pr-1.5 rounded-full text-sm text-[var(--text-muted)] hover:bg-[var(--bg-card-2)] transition">
      <Globe size={15} className="text-[var(--text-muted)]" aria-hidden="true" />
      <select aria-label={t('shell.language')} value={lang} onChange={e => setLang(e.target.value)} className="bg-transparent outline-none text-base sm:text-sm cursor-pointer text-[var(--text-main)]">
        {LANGUAGES.filter(l => !only || only.includes(l.id)).map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
      </select>
    </label>
  );
};

export default LanguageChoice;
