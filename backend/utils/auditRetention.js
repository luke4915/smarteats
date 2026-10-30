import { masterPool } from '../db.js';
import { withTenantClient } from '../middleware/tenantScope.js';
import logger from '../logger.js';

// Conservazione dei registri di audit (`audit_logs`): 60 giorni di partenza; passati N giorni le righe si cancellano. L'app non può cancellarle (è voluto: nessuno
// deve poter cancellare le tracce di ciò che ha fatto); la pulizia periodica usa il ruolo del master, l'unica eccezione fuori da
// `routes/master.js` (CLAUDE.md §3). Idempotente: si può rilanciare quando si vuole.
export const DEFAULT_RETENTION_DAYS = 60;
const MIN_DAYS = 7;       // sotto una settimana non si scende: un valore sbagliato nell'ambiente non deve azzerare il registro
const MAX_DAYS = 3650;

// I giorni da tenere: `AUDIT_RETENTION_DAYS` se è un intero ragionevole, altrimenti 60.
export function retentionDays(env = process.env) {
  const n = Number(env.AUDIT_RETENTION_DAYS);
  return Number.isInteger(n) && n >= MIN_DAYS && n <= MAX_DAYS ? n : DEFAULT_RETENTION_DAYS;
}

// Un locale: cancella le righe più vecchie di `days` giorni e ritorna quante.
export async function purgeAuditLogsOf(tenantId, days = retentionDays()) {
  return withTenantClient(tenantId, async (db) => {
    const { rowCount } = await db.query(`DELETE FROM audit_logs WHERE created_at < now() - make_interval(days => $1)`, [days]);
    return rowCount;
  }, masterPool);
}

// Tutti i locali (anche quelli disattivati), uno alla volta con la propria connessione (RLS).
export async function purgeAuditLogs(days = retentionDays()) {
  const { rows } = await masterPool.query('SELECT id FROM tenants');
  let total = 0;
  for (const { id } of rows) {
    try { total += await purgeAuditLogsOf(id, days); }
    catch (err) { logger.error({ err, tenantId: id }, 'Errore pulizia registro di audit'); }
  }
  if (total) logger.info({ purged: total, days }, 'Registro di audit: righe vecchie cancellate');
  return total;
}
