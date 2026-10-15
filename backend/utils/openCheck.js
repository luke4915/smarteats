import { HttpError } from './httpError.js';
import { readCoverCharge, syncCoverOrder } from './cover.js';

// Apre il conto di un tavolo nella sessione aperta. Si usa dentro una transazione (`inTransaction`): lo chiamano
// «Apri tavolo» (routes/checks.js) e «Arrivato» di una prenotazione (routes/bookings.js), così il percorso è uno solo.
// Lancia HttpError: 409 senza sessione aperta o con tavolo disattivato, 404 se il tavolo non esiste. Un tavolo che ha
// già un conto aperto fa scattare il vincolo `uniq_checks_open_table` (23505): lo gestisce chi chiama.
export async function openCheckOnTable(db, { tenantId, userId, tableId, covers }) {
  const { rows: sessions } = await db.query('SELECT id FROM sessions WHERE end_time IS NULL FOR SHARE');
  if (!sessions.length) throw new HttpError(409, 'Nessuna sessione attiva: apri una sessione prima di aprire un tavolo', 'NO_ACTIVE_SESSION');

  const { rows: tables } = await db.query('SELECT id, active FROM dining_tables WHERE id = $1', [tableId]);
  if (!tables.length) throw new HttpError(404, 'Tavolo non trovato');
  if (!tables[0].active) throw new HttpError(409, 'Il tavolo è disattivato', 'TABLE_INACTIVE');

  // Aperture contemporanee nella stessa sessione si mettono in fila: ognuna vede l'ultimo numero dato.
  await db.query(`SELECT pg_advisory_xact_lock(hashtextextended('checks:' || current_setting('app.tenant_id') || ':' || $1::text, 0))`, [sessions[0].id]);
  const { rows } = await db.query(
    `INSERT INTO checks (session_id, table_id, number, covers, opened_by, cover_charge)
     VALUES ($1, $2, (SELECT COALESCE(MAX(number), 0) + 1 FROM checks WHERE session_id = $1), $3, $4, $5) RETURNING id`,
    [sessions[0].id, tableId, covers, userId, await readCoverCharge(db)]);
  await syncCoverOrder(db, tenantId, rows[0].id, userId);
  return rows[0].id;
}
