import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import Modal from '../shared/Modal';
import ModalActions from '../shared/ModalActions';
import { btn, btnPrimary } from '../shared/styles';
import { useT } from '../../i18n/useLanguage';
import { useAvoidedAllergens } from '../../i18n/useAvoidedAllergens';
import { ALLERGEN_IDS } from '../../utils/allergens';

// «Allergie»: il cliente segna gli allergeni da evitare e i prodotti che li contengono vengono segnalati nell'elenco (non spariscono: la
// decisione resta sua). Compare solo se almeno un prodotto dichiara allergeni; sotto, l'avviso che le informazioni le dà il locale.
const AllergenBar = () => {
  const t = useT();
  const [avoid, toggle, clear] = useAvoidedAllergens();
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-1.5">
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className={`${btn} !h-10 coarse:!h-11 !px-3 ${avoid.length ? '!border-[var(--accent)] !text-[var(--accent)]' : ''}`}>
        <ShieldAlert size={16} /> {avoid.length ? t('allergens.filterActive', { count: avoid.length }) : t('allergens.filter')}
      </button>
      <p className="text-xs text-[var(--text-muted)]">{t('allergens.disclaimer')}</p>
      {open && (
        <Modal title={t('allergens.filterTitle')} onClose={() => setOpen(false)}
          footer={<ModalActions onCancel={avoid.length ? clear : undefined} cancelLabel={t('allergens.clear')}><button type="button" className={btnPrimary} onClick={() => setOpen(false)}>{t('allergens.done')}</button></ModalActions>}>
          <p className="text-sm text-[var(--text-muted)] mb-3">{t('allergens.filterHint')}</p>
          <ul className="space-y-1">
            {ALLERGEN_IDS.map(id => (
              <li key={id}>
                <label className="flex items-center gap-3 min-h-11 px-1 cursor-pointer">
                  <input type="checkbox" className="w-5 h-5 accent-[var(--accent)]" checked={avoid.includes(id)} onChange={() => toggle(id)} />
                  <span className="text-base text-[var(--text-main)]">{t(`allergen.${id}`)}</span>
                </label>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </div>
  );
};

export default AllergenBar;
