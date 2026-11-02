// Verifica del PIN senza rete. Quando il PIN è confermato dal server su questo dispositivo, se ne conserva un'impronta (PBKDF2 con sale
// casuale, mai il PIN in chiaro): se poi la rete manca, lo sblocco si controlla qui. Vale solo per un dispositivo già collegato al locale,
// e i tentativi sbagliati si contano anche qui (stesse soglie del server) così l'impronta non si può «provare» all'infinito dalla console.
import { recall, remember } from './lastKnown.js';

const KEY = 'pin-verifiers';
const ITERATIONS = 150_000;
export const MAX_FAILURES = 5;
export const LOCK_MS = 5 * 60 * 1000;

const toHex = (bytes) => [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex) => Uint8Array.from(hex.match(/../g) ?? [], h => parseInt(h, 16));

async function derive(pin, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  return toHex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, key, 256));
}

// L'impronta di un PIN: { salt, hash }
export async function makeVerifier(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: toHex(salt), hash: await derive(pin, salt) };
}

export async function matchesVerifier(verifier, pin) {
  return !!verifier && (await derive(pin, fromHex(verifier.salt))) === verifier.hash;
}

// Dopo un errore: quanti ne sono stati fatti e, al quinto, fino a quando si aspetta. Pura, come `afterFailure` del server.
export function afterLocalFailure(failed, now = Date.now()) {
  const count = failed + 1;
  return count >= MAX_FAILURES ? { failed: 0, lockedUntil: now + LOCK_MS } : { failed: count, lockedUntil: null };
}

export const minutesLeft = (lockedUntil, now = Date.now()) => Math.max(1, Math.ceil((lockedUntil - now) / 60000));

const all = () => recall(KEY) ?? {};

// `pinSetAt`: quando il server ha impostato quel PIN. Serve a riconoscere un'impronta vecchia (PIN cambiato o tolto altrove).
export function saveVerifier(userId, verifier, pinSetAt = null) {
  remember(KEY, { ...all(), [userId]: { ...verifier, pinSetAt, failed: 0, lockedUntil: null } });
}
export const hasVerifier = (userId) => !!all()[userId];
export function forgetVerifier(userId) {
  const { [userId]: _gone, ...rest } = all();
  remember(KEY, rest);
}

// Il server dice com'è il PIN adesso (`hasPin`, `pinSetAt`): se l'impronta locale è di un PIN diverso o non c'è più, si butta,
// così un vecchio PIN non sblocca più nemmeno senza rete. Si ricrea al primo sblocco con il PIN fatto online.
export function dropStaleVerifier(userId, { hasPin, pinSetAt }) {
  const entry = all()[userId];
  if (entry && (!hasPin || entry.pinSetAt !== pinSetAt)) forgetVerifier(userId);
}

// Controlla un PIN senza rete. Risponde { result: 'ok' | 'wrong' | 'locked' | 'none', minutes?, attemptsLeft? }.
export async function checkOffline(userId, pin, now = Date.now()) {
  const entry = all()[userId];
  if (!entry) return { result: 'none' };
  if (entry.lockedUntil && entry.lockedUntil > now) return { result: 'locked', minutes: minutesLeft(entry.lockedUntil, now) };
  if (await matchesVerifier(entry, pin)) { remember(KEY, { ...all(), [userId]: { ...entry, failed: 0, lockedUntil: null } }); return { result: 'ok' }; }
  const next = afterLocalFailure(entry.failed ?? 0, now);
  remember(KEY, { ...all(), [userId]: { ...entry, ...next } });
  return next.lockedUntil ? { result: 'locked', minutes: minutesLeft(next.lockedUntil, now) } : { result: 'wrong', attemptsLeft: MAX_FAILURES - next.failed };
}
