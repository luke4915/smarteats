// Le regole del PIN, senza database (provate in pinRules.test.js). Un PIN è fatto di 4-6 cifre: poco, quindi niente PIN banali (0000, 1234…)
// e un blocco dopo pochi errori. Vale solo dove l'utente è già collegato; la password resta sempre l'alternativa.
export const PIN_MIN = 4;
export const PIN_MAX = 6;
export const MAX_FAILURES = 5;
export const LOCK_MS = 5 * 60 * 1000;
// Chi si può raggiungere con il cambio utente veloce: il personale operativo con qualsiasi PIN. Admin e responsabile hanno poteri che un
// PIN di 4 cifre non deve aprire: per loro il PIN è sempre di 6 cifre (si impone quando lo si imposta) e il cambio utente lo controlla.
export const SWITCHABLE_ROLES = ['cashier', 'waiter', 'kitchen'];
export const PRIVILEGED_ROLES = ['admin', 'manager'];
export const PRIVILEGED_PIN_LENGTH = 6;

// Si può passare a questo utente con il PIN? Il personale operativo sì; admin e responsabile solo se il PIN è di 6 cifre.
export const canSwitchTo = (role, pinLength) => SWITCHABLE_ROLES.includes(role) || (PRIVILEGED_ROLES.includes(role) && pinLength === PRIVILEGED_PIN_LENGTH);

export const isPinFormat = (pin) => typeof pin === 'string' && new RegExp(`^\\d{${PIN_MIN},${PIN_MAX}}$`).test(pin);

// Banali: tutte cifre uguali (1111) o una scala crescente/decrescente (1234, 4321, 123456).
export function isWeakPin(pin) {
  if (/^(\d)\1+$/.test(pin)) return true;
  const d = [...pin].map(Number);
  const step = d[1] - d[0];
  return Math.abs(step) === 1 && d.every((x, i) => i === 0 || x - d[i - 1] === step);
}

// Perché un PIN non va bene, o null se va bene. Con il `role` di chi lo avrà si applica anche la lunghezza dei ruoli con più poteri.
export function pinProblem(pin, role) {
  if (!isPinFormat(pin)) return `Il PIN è di ${PIN_MIN}-${PIN_MAX} cifre, solo numeri`;
  if (PRIVILEGED_ROLES.includes(role) && pin.length !== PRIVILEGED_PIN_LENGTH) return `Per amministratore e responsabile il PIN è di ${PRIVILEGED_PIN_LENGTH} cifre`;
  if (isWeakPin(pin)) return 'Troppo semplice (1111, 1234…): scegline un altro';
  return null;
}

export const isLocked = (lockedUntil, now = Date.now()) => !!lockedUntil && new Date(lockedUntil).getTime() > now;

// Dopo un PIN sbagliato: il nuovo conteggio e, se si è arrivati al limite, fino a quando è bloccato (il conteggio riparte da zero).
export function afterFailure(failed, now = Date.now()) {
  const next = failed + 1;
  return next >= MAX_FAILURES ? { failed: 0, lockedUntil: new Date(now + LOCK_MS) } : { failed: next, lockedUntil: null };
}

export const minutesLeft = (lockedUntil, now = Date.now()) => Math.max(1, Math.ceil((new Date(lockedUntil).getTime() - now) / 60000));
