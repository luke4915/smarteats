// La licenza di un locale e il lavoro senza rete. Online la licenza la controlla il server a ogni richiesta (middleware/tenantScope.js).
// Offline la cassa non può saperlo: lavora fino a OFFLINE_GRACE_HOURS ore *dopo* la scadenza, poi si blocca; gli ordini battuti in
// quelle ore (e già venduti) si accettano quando la cassa torna in rete, oltre no. Funzioni pure, provate in tests/license.test.js.
export const OFFLINE_GRACE_HOURS = 10;
const GRACE_MS = OFFLINE_GRACE_HOURS * 3600 * 1000;

const ms = (value) => new Date(value).getTime();

// Cosa sa il dispositivo della licenza: la scadenza, fino a quando può lavorare senza rete e l'ora del server (per accorgersi di un
// orologio riportato indietro). `expiresAt` nullo = licenza senza scadenza, mai bloccata.
export function licenseInfo(expiresAt, now = Date.now()) {
  return {
    expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
    offlineUntil: expiresAt ? new Date(ms(expiresAt) + GRACE_MS).toISOString() : null,
    serverTime: new Date(now).toISOString(),
  };
}

// Un ordine battuto offline si accetta dopo la scadenza solo se è stato battuto entro le ore di tolleranza e non nel futuro.
export function lateSyncAllowed(expiresAt, clientCreatedAt, now = Date.now()) {
  if (!expiresAt || !clientCreatedAt) return false;
  const created = ms(clientCreatedAt);
  return Number.isFinite(created) && created <= ms(expiresAt) + GRACE_MS && created <= now + 60_000;
}

// È la richiesta di un ordine battuto offline (sessione, chiave e ora dichiarate dal dispositivo)? Solo questa passa a licenza scaduta.
export const isLateOrderSync = (req) => req.method === 'POST' && req.baseUrl === '/api/orders' && req.path === '/'
  && req.body?.session_id !== undefined && !!req.body?.client_order_id && !!req.body?.client_created_at;
