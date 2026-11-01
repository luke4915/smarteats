import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { LockContext } from './useLock';
import { useAuth } from './useAuth';
import { useToast } from './useToast';
import { recall, remember } from '../offline/lastKnown';
import { hasVerifier } from '../offline/pinVerifier';
import { isAutoLockChoice, shouldAutoLock } from '../utils/idleLock';
import { isPublicPath } from '../utils/publicPaths';
import LockScreen from '../components/layout/LockScreen';

// Il blocco dello schermo di chi è collegato. L'app resta montata sotto (ordini in coda, stampe e avvisi continuano a funzionare): la
// schermata di blocco le sta sopra finché non si inserisce il PIN o la password. Lo stato si ricorda per utente, così ricaricare la pagina
// non sblocca. Il blocco automatico è una scelta di questo dispositivo (non dell'utente): spento di partenza.
const IDLE_CHECK_MS = 15_000;
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'];

export const LockProvider = ({ children }) => {
  const { user, loading } = useAuth();
  const { showToast } = useToast();
  const [lockedFor, setLockedFor] = useState(() => recall('locked'));
  const [autoLockMinutes, setAutoLock] = useState(() => (isAutoLockChoice(recall('autolock')) ? recall('autolock') : 0));
  const lastActivity = useRef(Date.now());

  // Sulle pagine pubbliche (menu, prenotazioni…) il blocco non si vede né scatta: sono per i clienti, non per chi è collegato
  const publicPage = isPublicPath(window.location.pathname);
  const locked = !!user && lockedFor === user.id && !publicPage;
  const canLock = !!user && !!user.hasPin && !user.needsPassword && !publicPage;

  // Chi esce dal locale non lascia un blocco in sospeso (ma durante il caricamento l'utente non c'è ancora: il blocco va tenuto)
  useEffect(() => {
    if (!loading && !user && lockedFor != null) { setLockedFor(null); remember('locked', null); }
  }, [loading, user, lockedFor]);

  const unlock = useCallback(() => { setLockedFor(null); remember('locked', null); lastActivity.current = Date.now(); }, []);

  // Senza rete si blocca solo se il dispositivo sa già verificare il PIN: altrimenti nessuno potrebbe più sbloccarlo
  const lock = useCallback(() => {
    if (!canLock) return false;
    if (!navigator.onLine && !hasVerifier(user.id)) {
      showToast('Senza rete non si può bloccare: serve prima aver usato il PIN su questo dispositivo', 'error');
      return false;
    }
    setLockedFor(user.id);
    remember('locked', user.id);
    return true;
  }, [canLock, user, showToast]);

  const setAutoLockMinutes = useCallback((minutes) => {
    if (!isAutoLockChoice(minutes)) return;
    setAutoLock(minutes);
    remember('autolock', minutes);
  }, []);

  // Blocco automatico dopo un po' che non si tocca nulla
  useEffect(() => {
    if (!canLock || locked || !autoLockMinutes) return undefined;
    lastActivity.current = Date.now();
    const touch = () => { lastActivity.current = Date.now(); };
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, touch, { passive: true }));
    const timer = setInterval(() => { if (shouldAutoLock(autoLockMinutes, lastActivity.current)) lock(); }, IDLE_CHECK_MS);
    return () => { ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, touch)); clearInterval(timer); };
  }, [canLock, locked, autoLockMinutes, lock]);

  const value = useMemo(() => ({ locked, canLock, lock, unlock, autoLockMinutes, setAutoLockMinutes }), [locked, canLock, lock, unlock, autoLockMinutes, setAutoLockMinutes]);

  return (
    <LockContext.Provider value={value}>
      {children}
      {locked && <LockScreen />}
    </LockContext.Provider>
  );
};
