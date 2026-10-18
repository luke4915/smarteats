import crypto from 'crypto';

// Chi spedisce davvero i messaggi. `WHATSAPP_DRIVER`: `mock` (sviluppo e test: non esce nulla, risponde bene), `meta`
// (WhatsApp Business Platform, credenziali della piattaforma in variabili d'ambiente), `off` (modulo inattivo: la coda
// non si riempie). Un driver con le credenziali del singolo locale si aggiunge qui senza toccare coda ed eventi.
// Un driver ha `send({ to, template, header, params, buttonToken })` → `{ id }` e `sendText({ to, body })` (risposta libera,
// ammessa dentro le 24 ore dall'ultimo messaggio del cliente) oppure lancia `SendError`.

class SendError extends Error {
  constructor(message, { permanent = false, code = '' } = {}) { super(message); this.permanent = permanent; this.code = code; }
}

const GRAPH = 'https://graph.facebook.com';

// La firma che Meta mette nel webhook: `X-Hub-Signature-256: sha256=<HMAC-SHA256 del corpo con il segreto dell'app>`
export function verifySignature(rawBody, header, secret) {
  if (!secret || !header || !Buffer.isBuffer(rawBody)) return false;
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const a = Buffer.from(expected), b = Buffer.from(String(header));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function metaDriver(env = process.env, fetchImpl = globalThis.fetch) {
  const { WHATSAPP_TOKEN: token, WHATSAPP_PHONE_NUMBER_ID: phoneId, WHATSAPP_API_VERSION: version = 'v21.0' } = env;
  return {
    id: 'meta',
    configured: !!(token && phoneId),
    async sendText({ to, body }) {
      if (!token || !phoneId) throw new SendError('Credenziali WhatsApp non configurate', { permanent: true, code: 'NOT_CONFIGURED' });
      const res = await fetchImpl(`${GRAPH}/${version}/${phoneId}/messages`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body, preview_url: false } }),
        signal: AbortSignal.timeout(10_000),
      }).catch(err => { throw new SendError(`Rete: ${err.message}`, { code: 'NETWORK' }); });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.messages?.[0]?.id) return { id: data.messages[0].id };
      throw new SendError(data.error?.message ?? `HTTP ${res.status}`, { permanent: !(res.status === 429 || res.status >= 500), code: String(data.error?.code ?? res.status) });
    },
    async send({ to, template, header, params, buttonToken }) {
      if (!token || !phoneId) throw new SendError('Credenziali WhatsApp non configurate', { permanent: true, code: 'NOT_CONFIGURED' });
      const components = [
        { type: 'header', parameters: [{ type: 'text', text: header }] },
        { type: 'body', parameters: params.map(text => ({ type: 'text', text: String(text) })) },
        ...(buttonToken ? [{ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: buttonToken }] }] : []),
      ];
      let res;
      try {
        res = await fetchImpl(`${GRAPH}/${version}/${phoneId}/messages`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'template', template: { name: template, language: { code: 'it' }, components } }),
          signal: AbortSignal.timeout(10_000),
        });
      } catch (err) {
        throw new SendError(`Rete: ${err.message}`, { permanent: false, code: 'NETWORK' });
      }
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.messages?.[0]?.id) return { id: data.messages[0].id };
      const detail = data.error?.message ?? `HTTP ${res.status}`;
      // 429 e 5xx sono temporanei; il resto (numero non su WhatsApp, modello non approvato, token) non migliora riprovando
      const temporary = res.status === 429 || res.status >= 500;
      throw new SendError(detail, { permanent: !temporary, code: String(data.error?.code ?? res.status) });
    },
  };
}

export function mockDriver() {
  const sent = [];
  const texts = [];
  return {
    id: 'mock', configured: true, sent, texts,
    async sendText(message) { texts.push(message); return { id: `mock-text-${crypto.randomUUID()}` }; },
    async send(message) {
      // un numero che finisce per 0000 simula un rifiuto definitivo, uno per 9999 un errore temporaneo (per i test)
      if (message.to.endsWith('0000')) throw new SendError('Numero non su WhatsApp', { permanent: true, code: '131026' });
      if (message.to.endsWith('9999')) throw new SendError('Servizio non disponibile', { permanent: false, code: '503' });
      sent.push(message);
      return { id: `mock-${crypto.randomUUID()}` };
    },
  };
}

let current = null;
export function getDriver(env = process.env) {
  if (current) return current;
  const name = env.WHATSAPP_DRIVER ?? (env.NODE_ENV === 'production' ? 'off' : 'mock');
  current = name === 'meta' ? metaDriver(env) : name === 'mock' ? mockDriver() : { id: 'off', configured: false };
  return current;
}
// Per i test: sostituisce il driver (o lo ripristina con null)
export const setDriver = (driver) => { current = driver; };
