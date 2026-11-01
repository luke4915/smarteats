import Segmented from '../shared/Segmented';
import { THEME_CHOICES } from '../../utils/theme';

// La scelta dell'aspetto (Auto, Chiaro, Scuro), uguale nel menu dell'account e nelle impostazioni del dispositivo. Nelle pagine dei clienti si
// passa `t` e le parole sono nella loro lingua.
const ThemeChoice = ({ value, onChange, className = '', t = null }) => (
  <Segmented label={t ? t('shell.theme') : 'Aspetto'} className={className} value={value} onChange={onChange}
    options={t ? THEME_CHOICES.map(c => ({ ...c, label: t(`theme.${c.id}`) })) : THEME_CHOICES} />
);

export default ThemeChoice;
