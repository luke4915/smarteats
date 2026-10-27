// Lavoro in background dell'asporto: fa arrivare in cucina gli ordini accettati in anticipo il cui ritiro è per oggi, anche se il
// servizio è aperto da ieri sera (senza questo nascerebbero solo all'apertura di un servizio nuovo, e un ordine accettato ieri per
// il pranzo di oggi non comparirebbe mai in cucina). Gira ogni minuto da server.js, solo per i locali con il modulo e un servizio aperto.
import { pool } from '../db.js';
import { withTenantClient } from '../middleware/tenantScope.js';
import logger from '../logger.js';
import { fireDueTakeaway, announceKitchenOrder } from './takeawayDb.js';

// Ritorna quanti ordini di cucina sono nati. `broadcast` avvisa cucina e KDS (può mancare nei test).
export async function fireDueTakeawayAllTenants(broadcast) {
  const { rows } = await pool.query(`SELECT id FROM tenants WHERE active AND 'takeaway' = ANY(modules)`);
  let total = 0;
  for (const { id } of rows) {
    try {
      total += await withTenantClient(id, async (db) => {
        const { rows: open } = await db.query('SELECT 1 FROM sessions WHERE end_time IS NULL LIMIT 1');
        if (!open.length) return 0;
        const fired = await fireDueTakeaway(db, { tenantId: id, userId: null });
        fired.forEach(({ created, row }) => announceKitchenOrder(broadcast, id, created, row, row.pickup_at));
        return fired.length;
      });
    } catch (err) { logger.error({ err, tenantId: id }, 'Errore giro asporti in anticipo'); }
  }
  return total;
}
