// Cosa succede a ogni tasto del tastierino del PIN: cifre fino a 6, «cancella» toglie l'ultima. Pura, così si prova senza il browser.
export const PIN_MIN = 4;
export const PIN_MAX = 6;
// Chi può darsi il cambio con il PIN sulla stessa cassa (come SWITCHABLE_ROLES del server)
export const SWITCHABLE_ROLES = ['cashier', 'waiter', 'kitchen'];
// Admin e responsabile hanno sempre un PIN di 6 cifre (poteri maggiori: lo impone il server)
export const PRIVILEGED_PIN_LENGTH = 6;
export const needsLongPin = (role) => role === 'admin' || role === 'manager';


export const pressKey = (pin, key) => {
  if (key === 'back') return pin.slice(0, -1);
  return /^\d$/.test(key) && pin.length < PIN_MAX ? pin + key : pin;
};

export const canSubmit = (pin) => pin.length >= PIN_MIN && pin.length <= PIN_MAX;

// Il messaggio per chi ha sbagliato PIN, a partire dalla risposta del server o del controllo senza rete
export const failureText = (check) => {
  if (check.result === 'locked') return `Troppi tentativi: riprova tra ${check.minutes} ${check.minutes === 1 ? 'minuto' : 'minuti'}, oppure usa la password.`;
  if (check.result === 'none') return 'Per questo utente non c\'è un PIN: usa la password.';
  return `PIN errato (${check.attemptsLeft} ${check.attemptsLeft === 1 ? 'tentativo' : 'tentativi'} prima del blocco)`;
};

// Il PIN di questa lunghezza va bene per questo ruolo?
export const pinFitsRole = (pin, role) => canSubmit(pin) && (!needsLongPin(role) || pin.length === PRIVILEGED_PIN_LENGTH);
