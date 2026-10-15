import { pool } from '../../db.js';
import { withTenantClient } from '../../middleware/tenantScope.js';
import logger from '../../logger.js';
import { classifyInbound, inboundReply, normalizeMobile } from '../whatsapp.js';
import { getDriver } from './driver.js';

// Cosa fare di ciò che Meta ci manda sul webhook: gli stati dei messaggi (consegnato, letto, fallito) e le risposte dei
// clienti (STOP, RIPRENDI, o una domanda a cui si risponde in automatico). Il numero è unico per tutti i locali: il locale
// si risale dall'id del messaggio (stati) o dall'ultimo avviso mandato a quel numero (risposte). Disegno: docs/design-whatsapp.md.

const RANK = { queued: 0, sent: 1, delivered: 2, read: 3 };
const REPLY_EVERY_MS = 6 * 3600 * 1000;      // a chi scrive «ciao» si risponde al massimo una volta ogni 6 ore
const replied = new Map();                   // numero → quando (per processo: basta contro i rimbalzi)
const seen = new Set();                      // id dei messaggi già trattati (Meta li può rimandare)

export const resetWebhookState = () => { replied.clear(); seen.clear(); };

async function applyStatus(status) {
  const waId = status.id;
  const { rows: [link] } = await pool.query('SELECT tenant_id FROM whatsapp_message_tenants WHERE wa_message_id = $1', [waId]);
  if (!link) return false;                    // un messaggio che non conosciamo (altro ambiente): si ignora
  const next = status.status;                 // sent | delivered | read | failed
  if (!['sent', 'delivered', 'read', 'failed'].includes(next)) return false;
  const reason = next === 'failed' ? String(status.errors?.[0]?.title ?? status.errors?.[0]?.message ?? 'Consegna non riuscita').slice(0, 300) : '';
  await withTenantClient(link.tenant_id, async (db) => {
    const { rows: [m] } = await db.query('SELECT id, status FROM whatsapp_messages WHERE wa_message_id = $1', [waId]);
    if (!m) return;
    // gli stati si avanzano e basta: «letto» non torna «consegnato» se arrivano fuori ordine
    if (next === 'failed') {
      if (RANK[m.status] !== undefined && RANK[m.status] <= RANK.delivered && m.status !== 'read')
        await db.query(`UPDATE whatsapp_messages SET status = 'failed', error = $2 WHERE id = $1`, [m.id, reason]);
    } else if ((RANK[next] ?? -1) > (RANK[m.status] ?? 99)) {
      await db.query(`UPDATE whatsapp_messages SET status = $2 WHERE id = $1`, [m.id, next]);
    }
  });
  return true;
}

// Il locale a cui rimandare il cliente: quello che gli ha scritto per ultimo, col suo telefono
async function lastLocaleFor(phone) {
  const { rows: [link] } = await pool.query('SELECT tenant_id FROM whatsapp_message_tenants WHERE to_phone = $1 ORDER BY sent_at DESC LIMIT 1', [phone]);
  if (!link) return {};
  const { rows: [t] } = await pool.query('SELECT name FROM tenants WHERE id = $1', [link.tenant_id]);
  const settings = await withTenantClient(link.tenant_id, async (db) => {
    const { rows } = await db.query(`SELECT key, value FROM settings WHERE key IN ('takeaway_phone', 'booking_portal_phone')`);
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  });
  return { locale: t?.name ?? '', phone: settings.takeaway_phone || settings.booking_portal_phone || '' };
}

async function applyInbound(message, { driver, now }) {
  if (!message?.id || seen.has(message.id)) return false;
  seen.add(message.id);
  if (seen.size > 1000) seen.delete(seen.values().next().value);
  const phone = normalizeMobile(`+${String(message.from ?? '').replace(/\D/g, '')}`);
  if (!phone) return false;
  const kind = classifyInbound(message.text?.body);

  if (kind === 'optout') await pool.query('INSERT INTO whatsapp_optouts (phone) VALUES ($1) ON CONFLICT (phone) DO NOTHING', [phone]);
  if (kind === 'optin') await pool.query('DELETE FROM whatsapp_optouts WHERE phone = $1', [phone]);
  if (kind === 'other') {
    const last = replied.get(phone);
    if (last && now.getTime() - last < REPLY_EVERY_MS) return true;
    replied.set(phone, now.getTime());
  }
  const body = inboundReply(kind, kind === 'other' ? await lastLocaleFor(phone) : {});
  try { await driver.sendText({ to: phone, body }); }
  catch (err) { logger.warn({ err: err.message, kind }, 'Risposta automatica WhatsApp non inviata'); }
  return true;
}

// `payload` è il corpo del webhook (già verificato dalla firma). Ritorna quanti eventi ha trattato.
export async function handleWebhook(payload, { driver = getDriver(), now = new Date() } = {}) {
  let handled = 0;
  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value ?? {};
      for (const status of value.statuses ?? []) if (await applyStatus(status)) handled += 1;
      for (const message of value.messages ?? []) if (await applyInbound(message, { driver, now })) handled += 1;
    }
  }
  return handled;
}
