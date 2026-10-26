import Segmented from '../../smarteats/floor/Segmented';
import { THEME_CHOICES } from '../../utils/theme';

// La scelta dell'aspetto (Auto, Chiaro, Scuro), uguale nel menu dell'account e nelle impostazioni del dispositivo.
const ThemeChoice = ({ value, onChange, className = '' }) => (
  <Segmented label="Aspetto" className={className} value={value} onChange={onChange} options={THEME_CHOICES} />
);

export default ThemeChoice;
