import bcrypt from 'bcrypt';
import { inTransaction } from '../db.js';
import { hashPassword, DUMMY_HASH } from './password.js';
import { HttpError } from './httpError.js';
import { pinProblem, afterFailure, isLocked, minutesLeft, canSwitchTo } from './pinRules.js';

// Il PIN di un utente nel database (regole in pinRules.js). Come per gli utenti (tenantUsers.js), ogni query filtra anche sul tenant corrente:
// `users` non ha deroghe alla RLS ma il master potrebbe leggerli tutti.
const IN_TENANT = "tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::int";

// L'amministratore imposta o cambia il PIN di un utente del suo locale. Un PIN banale o malformato è 400; l'utente non c'è: 404.
export async function setPin(db, userId, pin) {
  const { rows: [target] } = await db.query(`SELECT role FROM users WHERE id = $1 AND ${IN_TENANT}`, [userId]);
  if (!target) throw new HttpError(404, 'Utente non trovato');
  const problem = pinProblem(pin, target.role);
  if (problem) throw new HttpError(400, problem, 'WEAK_PIN');
  const { rows } = await db.query(
    `UPDATE users SET pin_hash = $1, pin_length = $2, pin_set_at = now(), pin_failed = 0, pin_locked_until = NULL WHERE id = $3 AND ${IN_TENANT} RETURNING id, username, role`,
    [await hashPassword(pin), pin.length, userId]);
  return rows[0];
}

export async function clearPin(db, userId) {
  const { rows } = await db.query(
    `UPDATE users SET pin_hash = NULL, pin_length = NULL, pin_set_at = NULL, pin_failed = 0, pin_locked_until = NULL WHERE id = $1 AND ${IN_TENANT} RETURNING id, username, role`, [userId]);
  if (!rows.length) throw new HttpError(404, 'Utente non trovato');
  return rows[0];
}

// Chi ha un PIN e si può raggiungere con il cambio utente veloce (senza password temporanea da cambiare; admin e responsabile solo con un PIN
// di 6 cifre). Con la lunghezza del PIN, per mostrare i puntini giusti.
export async function listOperators(db) {
  const { rows } = await db.query(
    `SELECT id, username, role, pin_length FROM users WHERE pin_hash IS NOT NULL AND must_change_password = false AND ${IN_TENANT} ORDER BY username`);
  return rows.filter(u => canSwitchTo(u.role, u.pin_length));
}

// Controlla il PIN di un utente. Ritorna { result, minutes?, user } con result 'ok' | 'wrong' | 'locked' | 'none' (senza PIN o utente inesistente).
// Non lancia errori per un PIN sbagliato: il conteggio degli errori deve restare salvato (un errore annullerebbe la transazione).
export async function checkPin(client, userId, pin, now = Date.now()) {
  return inTransaction(client, async (db) => {
    const { rows } = await db.query(`SELECT id, username, role, tenant_id, must_change_password, pin_hash, pin_length, pin_failed, pin_locked_until FROM users WHERE id = $1 AND ${IN_TENANT} FOR UPDATE`, [userId]);
    const user = rows[0];
    if (!user?.pin_hash) { await bcrypt.compare(String(pin), DUMMY_HASH); return { result: 'none', user: user ?? null }; }    // stesso tempo di un PIN errato
    if (isLocked(user.pin_locked_until, now)) return { result: 'locked', minutes: minutesLeft(user.pin_locked_until, now), user };
    if (await bcrypt.compare(String(pin), user.pin_hash)) {
      if (user.pin_failed || user.pin_locked_until) await db.query('UPDATE users SET pin_failed = 0, pin_locked_until = NULL WHERE id = $1', [user.id]);
      return { result: 'ok', user };
    }
    const next = afterFailure(user.pin_failed ?? 0, now);
    await db.query('UPDATE users SET pin_failed = $1, pin_locked_until = $2 WHERE id = $3', [next.failed, next.lockedUntil, user.id]);
    return next.lockedUntil ? { result: 'locked', minutes: minutesLeft(next.lockedUntil, now), justLocked: true, user } : { result: 'wrong', attemptsLeft: 5 - next.failed, user };
  });
}
