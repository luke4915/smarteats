import { useState, useEffect } from 'react';

// Il tema (scuro o chiaro) del personale: si ricorda su questo dispositivo e si applica alla pagina. Di partenza è scuro
// (lo stesso valore è già impostato da index.html prima del primo disegno, così non c'è alcun lampo).
export function useTheme() {
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('theme') === 'light' ? 'light' : 'dark'; } catch { return 'dark'; } });
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0a0b0d' : '#f1f5f9');   // colore della barra di sistema
    try { localStorage.setItem('theme', theme); } catch { /* senza archivio locale vale solo per questa visita */ }
  }, [theme]);
  return [theme, setTheme];
}
