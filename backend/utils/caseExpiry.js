import { PORTAL_TZ } from './bookingPortal.js';
import { REQUEST_TTL_HOURS } from './bookings.js';
import { TAKEAWAY_EXPIRE_MINUTES } from './whatsapp.js';
import { enqueue } from './whatsapp/outbox.js';

// Scadenza delle richieste non gestite, con l'avviso al cliente. Va chiamata con la connessione del locale, quando si
// leggono le richieste e a intervalli dal lavoro in background.

// Una richiesta di prenotazione scade dopo 24 ore o, se prima, all'inizio del turno (non ha senso confermare un turno
// già cominciato). I posti tornano subito disponibili.
export async function expireReservations(db) {
  const { rows } = await db.query(
    `UPDATE reservations r SET status = 'expired' FROM booking_shifts s
     WHERE s.id = r.shift_id AND r.status = 'requested'
       AND (r.requested_at < now() - make_interval(hours => $1) OR ((r.date + s.start_time) AT TIME ZONE $2) <= now())
     RETURNING r.id`, [REQUEST_TTL_HOURS, PORTAL_TZ]);
  for (const r of rows) await enqueue(db, 'reservation', r.id, 'expired');
  return rows.length;
}

// Un ordine da asporto non accettato scade a pochi minuti dal ritiro
export async function expireTakeaway(db) {
  const { rows } = await db.query(
    `UPDATE takeaway_orders SET status = 'expired', decided_at = now()
     WHERE status = 'requested' AND pickup_at - make_interval(mins => $1) <= now() RETURNING id`, [TAKEAWAY_EXPIRE_MINUTES]);
  for (const r of rows) await enqueue(db, 'takeaway', r.id, 'expired');
  return rows.length;
}

export const expireAll = async (db) => (await expireReservations(db)) + (await expireTakeaway(db));
