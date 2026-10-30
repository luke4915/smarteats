import { useState, useCallback } from 'react';

// Un suggerimento che si mostra finché la persona non ha provato il gesto o non lo chiude: poi non torna più su quel dispositivo.
// Si ricorda in `localStorage` (per dispositivo, come l'aspetto); se il browser non lo permette, il suggerimento si vede ogni volta,
// che è meglio che non vederlo mai. `active`: spento, non si mostra e non si ricorda niente.
export function useOnceHint(key, active = true) {
  const storageKey = `smarteats.hint.${key}`;
  const [seen, setSeen] = useState(() => {
    try { return localStorage.getItem(storageKey) === '1'; } catch { return false; }
  });
  const dismiss = useCallback(() => {
    setSeen(true);
    try { localStorage.setItem(storageKey, '1'); } catch { /* niente memoria nel browser: pazienza */ }
  }, [storageKey]);
  return { show: active && !seen, dismiss };
}
