import { inTransaction, pool } from '../../db.js';
import { withTenantClient } from '../../middleware/tenantScope.js';
import logger from '../../logger.js';
import { getTenantModules } from '../tenantModules.js';
import { PORTAL_TZ } from '../bookingPortal.js';
import {
  EVENTS, EVENT_IDS, STATUS_BUTTON_EVENTS, eventSettingKey, QUOTA_SETTING_KEY, DEFAULT_MONTHLY_QUOTA, MAX_MESSAGES_PER_CASE,
  templateName, normalizeMobile, sendAtFor, nextAttempt, staleReason, dayLabel, euro, REMINDER_HOURS,
} from '../whatsapp.js';
import { getDriver } from './driver.js';

// Coda di invio degli avvisi WhatsApp. `enqueue` si chiama dove cambia lo stato di una pratica (con la connessione del
// locale, meglio nella stessa transazione): scrive una riga e basta, non invia nulla e non fallisce mai il chiamante per
// colpa di WhatsApp. `deliverDue` la svuota (lavoro in background di server.js). Disegno: docs/design-whatsapp.md.

const REF_TYPES = ['reservation', 'takeaway'];

// Lo stato attuale di una pratica, con tutto ciò che serve a scrivere il messaggio (nome del locale compreso)
export async function loadContext(db, refType, refId) {
  if (refType === 'reservation') {
    const { rows } = await db.query(
      `SELECT r.id, r.status, r.customer_name, r.phone, r.party_size, r.public_token,
              to_char(r.date, 'YYYY-MM-DD') AS date, to_char(s.start_time, 'HH24:MI') AS time,
              ((r.date + s.start_time) AT TIME ZONE $2) AS starts_at,
              (SELECT name FROM tenants WHERE id = r.tenant_id) AS locale
       FROM reservations r JOIN booking_shifts s ON s.id = r.shift_id WHERE r.id = $1`, [refId, PORTAL_TZ]);
    return rows[0] ?? null;
  }
  const { rows } = await db.query(
    `SELECT t.id, t.status, t.customer_name, t.phone, t.total, t.public_token,
            to_char(t.pickup_at AT TIME ZONE $2, 'YYYY-MM-DD') AS date, to_char(t.pickup_at AT TIME ZONE $2, 'HH24:MI') AS time,
            t.pickup_at AS starts_at, (SELECT name FROM tenants WHERE id = t.tenant_id) AS locale
     FROM takeaway_orders t WHERE t.id = $1`, [refId, PORTAL_TZ]);
  return rows[0] ?? null;
}

// Valori dei segnaposto, nell'ordine dichiarato in EVENTS[evento].vars
const VALUE_OF = {
  customer: c => String(c.customer_name).split(/\s+/)[0],
  date: c => dayLabel(c.date), time: c => c.time, party: c => String(c.party_size), total: c => euro(c.total),
};
export const valuesFor = (eventId, ctx) => EVENTS[eventId].vars.map(v => VALUE_OF[v](ctx));

// Impostazioni del modulo per locale: eventi accesi e tetto mensile di pratiche. Le scrive solo il Master.
export async function loadConfig(db) {
  const { rows } = await db.query(`SELECT key, value FROM settings WHERE key LIKE 'whatsapp\\_%'`);
  const s = Object.fromEntries(rows.map(r => [r.key, r.value]));
  const events = Object.fromEntries(EVENT_IDS.map(id => [id, s[eventSettingKey(id)] === undefined ? EVENTS[id].on : s[eventSettingKey(id)] === '1']));
  const quota = Number.isInteger(Number(s[QUOTA_SETTING_KEY])) && s[QUOTA_SETTING_KEY] !== undefined ? Number(s[QUOTA_SETTING_KEY]) : DEFAULT_MONTHLY_QUOTA;
  return { events, quota };
}

const tenantIdOf = async (db) => Number((await db.query(`SELECT current_setting('app.tenant_id', true) AS t`)).rows[0].t);

// Pratiche (prenotazioni/ordini) del mese con almeno un avviso non scartato
export async function monthUsage(db) {
  const { rows: [r] } = await db.query(
    `SELECT COUNT(DISTINCT (ref_type, ref_id))::int AS n FROM whatsapp_messages
     WHERE status <> 'skipped' AND created_at >= date_trunc('month', now())`);
  return r.n;
}

// Mette in coda l'avviso `event` della pratica. Non lancia mai per motivi di WhatsApp (modulo spento, evento spento,
// numero mancante): in quel caso non fa nulla. Ritorna l'id della riga o null.
export async function enqueue(db, refType, refId, event, { now = new Date() } = {}) {
  try {
    const eventId = `${refType}.${event}`;
    if (!REF_TYPES.includes(refType) || !EVENTS[eventId]) throw new Error(`Evento WhatsApp sconosciuto: ${eventId}`);
    if (getDriver().id === 'off') return null;
    const mods = await getTenantModules(await tenantIdOf(db));
    if (!mods?.modules.includes('whatsapp')) return null;
    const cfg = await loadConfig(db);
    if (!cfg.events[eventId]) return null;
    const ctx = await loadContext(db, refType, refId);
    if (!ctx || !String(ctx.phone ?? '').trim()) return null;
    const sendAt = sendAtFor(eventId, { now, startsAt: ctx.starts_at ? new Date(ctx.starts_at) : null });
    if (!sendAt) return null;

    const to = normalizeMobile(ctx.phone);
    let status = 'queued', error = '';
    if (!to) { status = 'skipped'; error = 'NUMERO_NON_VALIDO'; }
    else {
      const { rows: [c] } = await db.query(
        `SELECT COUNT(*) FILTER (WHERE status <> 'skipped')::int AS sent FROM whatsapp_messages WHERE ref_type = $1 AND ref_id = $2`, [refType, refId]);
      if (c.sent >= MAX_MESSAGES_PER_CASE) { status = 'skipped'; error = 'TROPPI_AVVISI'; }
      else if (c.sent === 0 && (await monthUsage(db)) >= cfg.quota) { status = 'skipped'; error = 'TETTO_MENSILE'; }
    }
    const { rows } = await db.query(
      `INSERT INTO whatsapp_messages (ref_type, ref_id, event, to_phone, template, category, status, error, next_attempt_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (tenant_id, ref_type, ref_id, event) DO NOTHING RETURNING id`,
      [refType, refId, event, to ?? '', templateName(eventId), EVENTS[eventId].category, status, error, sendAt]);
    return rows[0]?.id ?? null;
  } catch (err) {
    logger.error({ err, refType, refId, event }, 'Errore messa in coda avviso WhatsApp');
    return null;
  }
}

// Un ordine di cucina è concluso: se è un ordine da asporto accettato, il cliente va avvisato che è pronto.
export async function afterOrderCompleted(db, orderId) {
  const { rows } = await db.query(`SELECT id FROM takeaway_orders WHERE order_id = $1 AND status = 'accepted'`, [orderId]);
  for (const r of rows) await enqueue(db, 'takeaway', r.id, 'ready');
}

// Una riga della coda: la rilegge, controlla che abbia ancora senso e la spedisce. Va in transazione (riga bloccata).
async function processOne(db, m, driver, cfg, now) {
  const mark = (status, error = '', extra = {}) => db.query(
    `UPDATE whatsapp_messages SET status = $2, error = $3, attempts = COALESCE($4, attempts), next_attempt_at = COALESCE($5, next_attempt_at),
       wa_message_id = COALESCE($6, wa_message_id), params = COALESCE($7, params), sent_at = COALESCE($8, sent_at) WHERE id = $1`,
    [m.id, status, error, extra.attempts ?? null, extra.next ?? null, extra.waId ?? null, extra.params ? JSON.stringify(extra.params) : null, extra.sentAt ?? null]);

  const eventId = `${m.ref_type}.${m.event}`;
  if (!cfg.events[eventId]) return mark('skipped', 'EVENTO_SPENTO');
  const ctx = await loadContext(db, m.ref_type, m.ref_id);
  if (!ctx) return mark('skipped', 'PRATICA_NON_TROVATA');
  const stale = staleReason(eventId, ctx);
  if (stale) return mark('skipped', stale);

  if (eventId === 'reservation.reminder') {
    const startsAt = new Date(ctx.starts_at);
    if (startsAt <= now) return mark('skipped', 'TURNO_PASSATO');
    const due = new Date(startsAt.getTime() - REMINDER_HOURS * 3600000);
    // la prenotazione è stata spostata: il promemoria segue il nuovo orario
    if (due.getTime() - now.getTime() > 60000) return mark('queued', '', { next: due });
  }

  const params = valuesFor(eventId, ctx);
  try {
    const { id } = await driver.send({
      to: m.to_phone, template: m.template, header: `SmartEats × ${ctx.locale}`, params,
      buttonToken: STATUS_BUTTON_EVENTS.has(eventId) ? ctx.public_token : null,
    });
    return mark('sent', '', { waId: id, params, sentAt: now, attempts: m.attempts + 1 });
  } catch (err) {
    const attempts = m.attempts + 1;
    const next = err.permanent ? null : nextAttempt(attempts, now);
    if (next) return mark('queued', String(err.message).slice(0, 300), { attempts, next });
    return mark('failed', String(err.message).slice(0, 300), { attempts });
  }
}

// Svuota la coda di un locale: fino a `limit` messaggi dovuti. Ritorna quanti ne ha trattati.
export async function deliverDue(db, { now = new Date(), limit = 20, driver = getDriver() } = {}) {
  if (driver.id === 'off') return 0;
  const cfg = await loadConfig(db);
  let handled = 0;
  while (handled < limit) {
    const more = await inTransaction(db, async (tx) => {
      const { rows: [m] } = await tx.query(
        `SELECT * FROM whatsapp_messages WHERE status = 'queued' AND next_attempt_at <= $1
         ORDER BY next_attempt_at, id LIMIT 1 FOR UPDATE SKIP LOCKED`, [now]);
      if (!m) return false;
      await processOne(tx, m, driver, cfg, now);
      return true;
    });
    if (!more) break;
    handled += 1;
  }
  return handled;
}

// Il giro del lavoro in background: per ogni locale con il modulo acceso, fa scadere ciò che è scaduto e invia.
export async function runAllTenants({ expire }) {
  if (getDriver().id === 'off') return 0;
  const { rows } = await pool.query(`SELECT id FROM tenants WHERE active AND 'whatsapp' = ANY(modules)`);
  let total = 0;
  for (const { id } of rows) {
    try {
      total += await withTenantClient(id, async (db) => { await expire(db); return deliverDue(db); });
    } catch (err) { logger.error({ err, tenantId: id }, 'Errore giro avvisi WhatsApp'); }
  }
  return total;
}
