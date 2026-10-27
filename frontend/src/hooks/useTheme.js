import { useState, useEffect } from 'react';
import { parseTheme, resolveTheme } from '../utils/theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

// Il tema del personale (vedi utils/theme.js): si ricorda su questo dispositivo e si applica alla pagina. Con «auto» segue il sistema
// anche mentre l'app è aperta. Lo stesso valore iniziale è già impostato da index.html prima del primo disegno, così non c'è alcun lampo.
export function useTheme() {
  const [choice, setChoice] = useState(() => { try { return parseTheme(localStorage.getItem('theme')); } catch { return parseTheme(null); } });
  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const apply = () => {
      const dark = resolveTheme(choice, media.matches) === 'dark';
      document.documentElement.classList.toggle('dark', dark);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0a0b0d' : '#f1f5f9');   // colore della barra di sistema
    };
    apply();
    try { localStorage.setItem('theme', choice); } catch { /* senza archivio locale vale solo per questa visita */ }
    if (choice !== 'auto') return undefined;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [choice]);
  return [choice, setChoice];
}
