import { Plus, X } from 'lucide-react';
import { formatEuro } from '../../utils/format';
import { useT, useEffectiveLanguage } from '../../i18n/useLanguage';
import { localName } from '../../utils/localName';

// Il suggerimento del menu con il QR: una sola riga discreta sopra il pulsante dell'ordine («Ci sta bene anche: Birra»), che si aggiunge con un
// tocco o si scarta con la X (e non torna). Non copre nulla, non è una finestra e non si ripete. Funzione isolata, facile da togliere
// (vedi `utils/menuSuggestions.js` nel server).
const SuggestionNudge = ({ product, onAdd, onDismiss }) => {
  const t = useT();
  const name = localName(product, useEffectiveLanguage());
  return (
  <div role="note" className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] pl-3 pr-1 py-1 mb-2.5">
    <p className="min-w-0 flex-1 text-sm text-[var(--text-muted)] truncate">{t('nudge.also')} <span className="font-medium text-[var(--text-main)]">{name}</span> <span className="tabular-nums">· {formatEuro(product.price)}</span></p>
    <button type="button" onClick={onAdd} className="inline-flex items-center gap-1 h-10 px-3 rounded-lg text-sm font-medium text-[var(--accent)] hover:bg-[var(--bg-card-2)] cursor-pointer" aria-label={t('menu.addNamed', { name })}><Plus size={16} /> {t('menu.add')}</button>
    <button type="button" onClick={onDismiss} className="inline-flex items-center justify-center w-10 h-10 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-card-2)] cursor-pointer" aria-label={t('nudge.hide')}><X size={16} /></button>
  </div>
  );
};

export default SuggestionNudge;
