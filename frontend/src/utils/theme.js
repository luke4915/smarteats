// Il tema dell'app: «auto» segue il sistema (come le app di iPhone e iPad), «chiaro» e «scuro» sono scelte fisse.
// La scelta si ricorda su ogni dispositivo. Di partenza è scuro (si legge meglio con le luci della sagra la sera).
export const THEME_CHOICES = [{ id: 'auto', label: 'Auto' }, { id: 'light', label: 'Chiaro' }, { id: 'dark', label: 'Scuro' }];
export const DEFAULT_THEME = 'dark';

// Il valore salvato (anche vecchio o strano) → una scelta valida.
export const parseTheme = (stored) => (['auto', 'light', 'dark'].includes(stored) ? stored : DEFAULT_THEME);

// La scelta → il tema da disegnare adesso. `systemDark` = il sistema è in modalità scura.
export const resolveTheme = (choice, systemDark) => (choice === 'auto' ? (systemDark ? 'dark' : 'light') : choice);
