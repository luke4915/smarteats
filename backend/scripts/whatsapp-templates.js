// Registra su Meta i modelli di messaggio degli avvisi WhatsApp (uno per evento, in italiano), una volta per account.
// Uso:  node --env-file=.env scripts/whatsapp-templates.js [--dry-run]
// Serve WHATSAPP_TOKEN, WHATSAPP_WABA_ID e WHATSAPP_LINK_BASE (https://<dominio>, per il bottone «Vedi dettagli»).
// È sicuro rilanciarlo: salta i modelli già presenti. Dopo la registrazione Meta li approva (da minuti a qualche ora).
import { EVENTS, EVENT_IDS, STATUS_BUTTON_EVENTS, templateName } from '../utils/whatsapp.js';

const { WHATSAPP_TOKEN: token, WHATSAPP_WABA_ID: waba, WHATSAPP_LINK_BASE: base, WHATSAPP_API_VERSION: version = 'v21.0' } = process.env;
const dryRun = process.argv.includes('--dry-run');
const SAMPLE = { customer: 'Marta', date: 'venerdì 23 ottobre', time: '20:00', party: '4', total: '12,50 €' };

if (!dryRun && (!token || !waba)) { console.error('Mancano WHATSAPP_TOKEN e WHATSAPP_WABA_ID.'); process.exit(1); }
if (STATUS_BUTTON_EVENTS.size && !base) { console.error('Manca WHATSAPP_LINK_BASE (es. https://smarteats.example.it).'); process.exit(1); }

const graph = (path, init) => fetch(`https://graph.facebook.com/${version}/${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }).then(r => r.json());

const payloadFor = (eventId) => {
  const e = EVENTS[eventId];
  const components = [
    { type: 'HEADER', format: 'TEXT', text: 'SmartEats × {{1}}', example: { header_text: ['Pizzeria Rossi'] } },
    { type: 'BODY', text: e.body, example: { body_text: [e.vars.map(v => SAMPLE[v])] } },
  ];
  if (STATUS_BUTTON_EVENTS.has(eventId))
    components.push({ type: 'BUTTONS', buttons: [{ type: 'URL', text: 'Vedi dettagli', url: `${base.replace(/\/$/, '')}/s/{{1}}`, example: [`${base.replace(/\/$/, '')}/s/pizzeria-rossi/book/abc123`] }] });
  return { name: templateName(eventId), language: 'it', category: e.category === 'marketing' ? 'MARKETING' : 'UTILITY', components };
};

const existing = new Set();
if (!dryRun) {
  let next = `${waba}/message_templates?fields=name&limit=100`;
  while (next) {
    const page = await graph(next);
    if (page.error) { console.error('Errore Meta:', page.error.message); process.exit(1); }
    (page.data ?? []).forEach(t => existing.add(t.name));
    next = page.paging?.next ? page.paging.next.replace(/^https:\/\/graph\.facebook\.com\/[^/]+\//, '') : null;
  }
}

let created = 0, skipped = 0, failed = 0;
for (const eventId of EVENT_IDS) {
  const payload = payloadFor(eventId);
  if (existing.has(payload.name)) { skipped += 1; console.log(`= ${payload.name} (già presente)`); continue; }
  if (dryRun) { console.log(JSON.stringify(payload)); continue; }
  const res = await graph(`${waba}/message_templates`, { method: 'POST', body: JSON.stringify(payload) });
  if (res.error) { failed += 1; console.error(`✖ ${payload.name}: ${res.error.error_user_msg ?? res.error.message}`); } else { created += 1; console.log(`+ ${payload.name} → ${res.status ?? 'inviato'}`); }
}
console.log(dryRun ? 'Prova a vuoto: nulla è stato inviato.' : `Creati ${created}, già presenti ${skipped}, errori ${failed}.`);
process.exit(failed ? 1 : 0);
