// Dice se la cassa deve bloccarsi per licenza scaduta e senza rete (regole in offline/licenseLock.js). La licenza la scrive AuthProvider a ogni
// accesso e rinnovo (`noteLicense`); l'istante più avanzato mai visto resta sul dispositivo e si aggiorna ogni 30 secondi.
import { useEffect, useState } from 'react';
import { remember, recall } from '../offline/lastKnown';
import { latestSeen, isLocked, minutesLeft } from '../offline/licenseLock';

const TICK_MS = 30_000;
let listeners = [];
const notify = () => listeners.forEach(fn => fn());

// La licenza appena ricevuta dal server (null = licenza senza scadenza). Chiamata da AuthProvider.
export function noteLicense(license) {
  if (!license) return;
  remember('license', license);
  remember('lastSeen', latestSeen({ now: Date.now(), lastSeen: recall('lastSeen'), serverTime: license.serverTime }));
  notify();
}

// Il blocco si toglie quando il server conferma una licenza valida (noteLicense con una nuova scadenza); si cancella al logout.
export function forgetLicense() {
  remember('license', null);
  notify();
}

const read = () => {
  const license = recall('license');
  const seen = latestSeen({ now: Date.now(), lastSeen: recall('lastSeen') });
  return { locked: isLocked(license, seen), minutesLeft: minutesLeft(license, seen), expired: !!license?.expiresAt && Date.parse(license.expiresAt) < seen };
};

export function useLicenseLock() {
  const [state, setState] = useState(read);
  useEffect(() => {
    const update = () => { remember('lastSeen', latestSeen({ now: Date.now(), lastSeen: recall('lastSeen') })); setState(read()); };
    listeners.push(update);
    const timer = setInterval(update, TICK_MS);
    return () => { listeners = listeners.filter(fn => fn !== update); clearInterval(timer); };
  }, []);
  return state;
}
