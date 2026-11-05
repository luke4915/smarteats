import { Sun, Moon } from 'lucide-react';
import { iconBtn } from '../shared/styles';

// Il pulsante sole/luna: un tocco passa dall'aspetto chiaro allo scuro e viceversa (sullo schermo scuro mostra il sole, su quello chiaro la luna: è
// ciò che si ottiene toccandolo). Sta nella testata dell'app e in alto nelle pagine dei clienti. «Auto» (segui il telefono) si sceglie dalle
// impostazioni del dispositivo; qui la scelta è sempre chiaro o scuro. `dark`: l'aspetto di adesso; `labels`: i testi, per le pagine tradotte.
const ThemeToggle = ({ dark, onChange, labels = { toLight: 'Passa all\'aspetto chiaro', toDark: 'Passa all\'aspetto scuro' } }) => (
  <button type="button" onClick={() => onChange(dark ? 'light' : 'dark')} aria-label={dark ? labels.toLight : labels.toDark} title={dark ? labels.toLight : labels.toDark}
    className={`${iconBtn} !h-9 !w-9 coarse:!h-11 coarse:!w-11 !p-0 rounded-full`}>
    {dark ? <Sun size={18} /> : <Moon size={18} />}
  </button>
);

export default ThemeToggle;
