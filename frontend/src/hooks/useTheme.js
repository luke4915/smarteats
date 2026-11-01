import { useState, useEffect } from 'react';
import { parseTheme, resolveTheme, DEFAULT_THEME } from '../utils/theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

// Il tema del personale (vedi utils/theme.js): si ricorda su questo dispositivo e si applica alla pagina. Con «auto» segue il sistema
// anche mentre l'app è aperta. `fallback` è la scelta di partenza se non ce n'è una salvata (le pagine dei clienti partono da «auto»).
// Si salva solo quando chi usa la pagina cambia scelta: aprire una pagina pubblica non deve fissare il tema del personale. Lo stesso valore iniziale è già impostato da index.html prima del primo disegno, così non c'è alcun lampo.
export function useTheme(fallback = DEFAULT_THEME) {
  const [choice, setChoice] = useState(() => { try { return parseTheme(localStorage.getItem('theme'), fallback); } catch { return fallback; } });
  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const apply = () => {
      const dark = resolveTheme(choice, media.matches) === 'dark';
      document.documentElement.classList.toggle('dark', dark);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0a0b0d' : '#f1f5f9');   // colore della barra di sistema
    };
    apply();
    if (choice !== 'auto') return undefined;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [choice]);
  const choose = (next) => {
    setChoice(next);
    try { localStorage.setItem('theme', next); } catch { /* senza archivio locale vale solo per questa visita */ }
  };
  return [choice, choose];
}
