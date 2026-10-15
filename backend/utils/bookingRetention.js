import { pool } from '../db.js';
import { withTenantClient } from '../middleware/tenantScope.js';
import logger from '../logger.js';
import { localNow, retentionCutoff } from './bookingPortal.js';

// Conservazione dei dati personali: passati RETENTION_DAYS dalla data di una prenotazione, nome, telefono, email e note
// si svuotano (restano data, turno e numero di persone, che servono alle statistiche). Idempotente: si può rilanciare.
export async function purgePersonalData(db, today = localNow().date) {
  const { rowCount } = await db.query(
    `UPDATE reservations SET customer_name = 'Cliente', phone = '', email = '', notes = '', personal_data_purged_at = now()
     WHERE date < $1 AND personal_data_purged_at IS NULL AND status NOT IN ('requested', 'confirmed', 'seated')`,
    [retentionCutoff(today)]);
  return rowCount;
}

// Tutti i locali con le prenotazioni accese, uno alla volta con la propria connessione (RLS).
export async function purgeAllTenants() {
  const { rows } = await pool.query(`SELECT id FROM tenants WHERE active AND 'bookings' = ANY(modules)`);
  let total = 0;
  for (const { id } of rows) {
    try { total += await withTenantClient(id, purgePersonalData); }
    catch (err) { logger.error({ err, tenantId: id }, 'Errore pulizia dati prenotazioni'); }
  }
  if (total) logger.info({ purged: total }, 'Dati personali delle prenotazioni svuotati');
  return total;
}
