// Tiene l'app aggiornata. Il service worker scarica la versione nuova in disparte (`waiting`); questo hook decide
// quando metterla in uso: da solo nei momenti sicuri (utils/updatePolicy.js), oppure quando l'utente tocca «Aggiorna».
// Controlla se c'è una versione nuova ogni 30 minuti e a ogni ritorno in primo piano.
import { useCallback, useEffect, useRef, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { shouldApplyUpdate } from '../utils/updatePolicy';
import { countByStatus } from '../offline/syncQueue';
import { countPrintJobs } from '../print/queue';

const CHECK_EVERY_MS = 30 * 60_000;
const TICK_MS = 60_000;

const countPending = async () => {
  try { return (await countByStatus('pending')) + (await countPrintJobs()); } catch { return 1; } // nel dubbio non ricarica
};

export function useAppUpdate() {
  const [waiting, setWaiting] = useState(false);
  const state = useRef({ updateSW: null, registration: null, waitingSince: 0, hiddenAt: 0, lastTouch: Date.now(), waiting: false });

  const apply = useCallback(() => { state.current.updateSW?.(true); }, []);

  useEffect(() => {
    const s = state.current;
    s.updateSW = registerSW({
      onNeedRefresh() { s.waiting = true; s.waitingSince = Date.now(); setWaiting(true); },
      onRegisteredSW(_url, registration) { s.registration = registration ?? null; },
    });

    const checkForUpdate = () => { s.registration?.update().catch(() => {}); };   // offline: riprova al giro dopo
    const maybeApply = async (awayMs) => {
      if (!s.waiting) return;
      const pending = await countPending();
      const now = Date.now();
      if (shouldApplyUpdate({ waiting: true, pending, awayMs, idleMs: now - s.lastTouch, waitingMs: now - s.waitingSince })) apply();
    };

    const onVisibility = () => {
      if (document.hidden) { s.hiddenAt = Date.now(); return; }
      checkForUpdate();
      maybeApply(s.hiddenAt ? Date.now() - s.hiddenAt : 0);
    };
    const onTouch = () => { s.lastTouch = Date.now(); };

    const checkTimer = setInterval(checkForUpdate, CHECK_EVERY_MS);
    const tickTimer = setInterval(() => maybeApply(0), TICK_MS);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pointerdown', onTouch, { passive: true });
    window.addEventListener('keydown', onTouch);
    return () => {
      clearInterval(checkTimer);
      clearInterval(tickTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointerdown', onTouch);
      window.removeEventListener('keydown', onTouch);
    };
  }, [apply]);

  return { waiting, apply };
}
