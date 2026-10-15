import { useEffect } from 'react';

// Il tema della pagina segue quello del dispositivo (chiaro o scuro): per le pagine dei clienti, che non hanno un
// selettore del tema.
export function useSystemTheme() {
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const apply = () => document.documentElement.classList.toggle('dark', !!media?.matches);
    apply();
    media?.addEventListener?.('change', apply);
    return () => media?.removeEventListener?.('change', apply);
  }, []);
}
