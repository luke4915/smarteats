// Regole pure del modulo WhatsApp (docs/design-whatsapp.md): eventi, modelli, numeri e tempi. Niente database né rete:
// funzioni con test (tests/whatsapp.test.js). I testi dei modelli sono uguali per tutti i locali e versionati: quelli
// registrati su Meta devono corrispondere a `body` qui sotto.

export const REMINDER_HOURS = 3;            // promemoria prima dell'inizio del turno
export const RECEIVED_DELAY_MINUTES = 2;    // «ricevuta» ritardata: se nel frattempo è gestita, non parte
export const TAKEAWAY_EXPIRE_MINUTES = 10;  // una richiesta di asporto non gestita scade a così tanto dal ritiro
export const MAX_MESSAGES_PER_CASE = 6;     // massimo di avvisi per pratica
export const DEFAULT_MONTHLY_QUOTA = 300;   // pratiche al mese incluse (impostabile dal Master)
export const MAX_ATTEMPTS = 5;
export const RETRY_MINUTES = [1, 5, 15, 60, 180];

// `vars`: i segnaposto del corpo, nell'ordine ({{1}}, {{2}}…). L'intestazione è sempre «SmartEats × {{locale}}».
export const EVENTS = {
  'reservation.received':  { ref: 'reservation', label: 'Prenotazione ricevuta', category: 'utility', on: true,
    vars: ['customer', 'date', 'time', 'party'], body: 'Ciao {{1}}, abbiamo ricevuto la tua richiesta per {{2}} alle {{3}} ({{4}} persone). Ti confermiamo a breve.' },
  'reservation.confirmed': { ref: 'reservation', label: 'Prenotazione confermata', category: 'utility', on: true,
    vars: ['customer', 'date', 'time', 'party'], body: 'Ciao {{1}}, la tua prenotazione è confermata: {{2}} alle {{3}}, {{4}} persone. A presto!' },
  'reservation.reminder':  { ref: 'reservation', label: 'Promemoria (3 ore prima)', category: 'utility', on: true,
    vars: ['customer', 'time', 'party'], body: 'Ciao {{1}}, ti aspettiamo oggi alle {{2}} ({{3}} persone). A tra poco!' },
  'reservation.declined':  { ref: 'reservation', label: 'Prenotazione rifiutata', category: 'utility', on: true,
    vars: ['customer', 'date', 'time'], body: 'Ciao {{1}}, purtroppo non possiamo accettare la richiesta per {{2}} alle {{3}}. Puoi inviare una nuova richiesta o chiamarci.' },
  'reservation.cancelled': { ref: 'reservation', label: 'Prenotazione annullata', category: 'utility', on: true,
    vars: ['customer', 'date', 'time'], body: 'Ciao {{1}}, la prenotazione per {{2}} alle {{3}} è stata annullata.' },
  'reservation.kept':      { ref: 'reservation', label: 'Annullo non accettato', category: 'utility', on: true,
    vars: ['customer', 'date', 'time'], body: 'Ciao {{1}}, la prenotazione per {{2}} alle {{3}} resta valida. Per cambiarla chiamaci.' },
  'reservation.expired':   { ref: 'reservation', label: 'Richiesta scaduta', category: 'utility', on: true,
    vars: ['customer', 'date', 'time'], body: 'Ciao {{1}}, non siamo riusciti a confermare la richiesta per {{2}} alle {{3}}. Invia una nuova richiesta o chiamaci.' },
  'takeaway.received':     { ref: 'takeaway', label: 'Ordine ricevuto', category: 'utility', on: true,
    vars: ['customer', 'time', 'total'], body: 'Ciao {{1}}, abbiamo ricevuto il tuo ordine per il ritiro alle {{2}} (totale {{3}}). Ti confermiamo a breve.' },
  'takeaway.accepted':     { ref: 'takeaway', label: 'Ordine confermato', category: 'utility', on: true,
    vars: ['customer', 'time', 'total'], body: 'Ciao {{1}}, il tuo ordine è confermato: ritiro alle {{2}}, totale {{3}}. Si paga al ritiro.' },
  'takeaway.ready':        { ref: 'takeaway', label: 'Ordine pronto', category: 'utility', on: true,
    vars: ['customer'], body: 'Ciao {{1}}, il tuo ordine è pronto: ti aspettiamo!' },
  'takeaway.picked_up':    { ref: 'takeaway', label: 'Ordine ritirato', category: 'utility', on: false,
    vars: ['customer'], body: 'Grazie {{1}}, buon appetito!' },
  'takeaway.rejected':     { ref: 'takeaway', label: 'Ordine non accettato', category: 'utility', on: true,
    vars: ['customer', 'time'], body: 'Ciao {{1}}, purtroppo non abbiamo potuto accettare l\'ordine per le {{2}}. Puoi ordinare per un altro orario o chiamarci.' },
  'takeaway.cancelled':    { ref: 'takeaway', label: 'Ordine annullato', category: 'utility', on: true,
    vars: ['customer'], body: 'Ciao {{1}}, il tuo ordine è stato annullato e ci scusiamo. Chiamaci per qualsiasi dubbio.' },
  'takeaway.expired':      { ref: 'takeaway', label: 'Ordine scaduto', category: 'utility', on: true,
    vars: ['customer', 'time'], body: 'Ciao {{1}}, non siamo riusciti a confermare l\'ordine per le {{2}}. Invia una nuova richiesta o chiamaci.' },
};
export const EVENT_IDS = Object.keys(EVENTS);

// Gli eventi il cui modello ha un bottone «Vedi …» verso la pagina di stato del cliente (`/book/<codice>`, `/order/<codice>`)
export const STATUS_BUTTON_EVENTS = new Set(['reservation.received', 'reservation.confirmed', 'takeaway.received', 'takeaway.accepted']);

// Chiave dell'impostazione che accende/spegne un evento (la scrive solo il Master)
export const eventSettingKey = (eventId) => `whatsapp_event_${eventId.replace('.', '_')}`;
export const QUOTA_SETTING_KEY = 'whatsapp_monthly_quota';

// Nome del modello su Meta: `se_reservation_confirmed_v1`
export const templateName = (eventId, version = 1) => `se_${eventId.replace('.', '_')}_v${version}`;

// Il testo con i segnaposto sostituiti (anteprima nel Master, messaggio di prova, registro)
export const renderBody = (eventId, values) =>
  EVENTS[eventId].body.replace(/\{\{(\d+)\}\}/g, (_, n) => String(values[Number(n) - 1] ?? ''));

// ─── Numeri ──────────────────────────────────────────────────────────────────────────────────────────────────────
// Ritorna il numero in formato internazionale senza «+» (come lo vuole Meta) oppure null se non è un cellulare
// raggiungibile. Un numero italiano senza prefisso si completa con 39; un fisso (inizia per 0) si scarta.
export function normalizeMobile(raw, defaultCountry = '39') {
  let digits = String(raw ?? '').replace(/[^\d+]/g, '');
  if (!digits) return null;
  const international = digits.startsWith('+') || digits.startsWith('00');
  digits = digits.replace(/^\+|^00/, '').replace(/\D/g, '');
  if (!international) {
    if (digits.startsWith(defaultCountry) && digits.length >= 11) { /* già con prefisso */ } else digits = defaultCountry + digits.replace(/^0+(?=3)/, '');
  }
  if (digits.length < 8 || digits.length > 15) return null;
  if (digits.startsWith('39')) {
    const national = digits.slice(2);
    if (!/^3\d{8,9}$/.test(national)) return null;   // fisso o numero italiano non valido
  }
  return digits;
}

// ─── Tempi ───────────────────────────────────────────────────────────────────────────────────────────────────────
// Quando deve partire un evento. `startsAt` è l'inizio del turno (prenotazioni) come Date. Ritorna Date, o null se
// l'evento non ha senso (promemoria quando manca troppo poco: la conferma è già recente).
export function sendAtFor(eventId, { now = new Date(), startsAt = null } = {}) {
  if (eventId === 'reservation.received' || eventId === 'takeaway.received') return new Date(now.getTime() + RECEIVED_DELAY_MINUTES * 60000);
  if (eventId === 'reservation.reminder') {
    if (!startsAt) return null;
    const at = new Date(startsAt.getTime() - REMINDER_HOURS * 3600000);
    return at.getTime() - now.getTime() > 5 * 60000 ? at : null;
  }
  return now;
}

// Prossimo tentativo dopo `attempts` fallimenti temporanei, oppure null se i tentativi sono finiti.
export function nextAttempt(attempts, now = new Date()) {
  if (attempts >= MAX_ATTEMPTS) return null;
  return new Date(now.getTime() + RETRY_MINUTES[Math.min(attempts, RETRY_MINUTES.length - 1)] * 60000);
}

// L'evento ha ancora senso rispetto allo stato attuale della pratica? Ritorna null se sì, altrimenti il motivo.
const STILL = {
  'reservation.received': (c) => (c.status === 'requested' ? null : 'GIA_GESTITA'),
  'reservation.confirmed': (c) => (['confirmed', 'seated', 'completed'].includes(c.status) ? null : 'STATO_CAMBIATO'),
  'reservation.reminder': (c) => (c.status === 'confirmed' ? null : 'STATO_CAMBIATO'),
  'reservation.declined': (c) => (c.status === 'declined' ? null : 'STATO_CAMBIATO'),
  'reservation.cancelled': (c) => (c.status === 'cancelled' ? null : 'STATO_CAMBIATO'),
  'reservation.kept': (c) => (c.status === 'confirmed' ? null : 'STATO_CAMBIATO'),
  'reservation.expired': (c) => (c.status === 'expired' ? null : 'STATO_CAMBIATO'),
  'takeaway.received': (c) => (c.status === 'requested' ? null : 'GIA_GESTITA'),
  'takeaway.accepted': (c) => (['accepted', 'picked_up'].includes(c.status) ? null : 'STATO_CAMBIATO'),
  'takeaway.ready': (c) => (c.status === 'accepted' ? null : 'STATO_CAMBIATO'),
  'takeaway.picked_up': (c) => (c.status === 'picked_up' ? null : 'STATO_CAMBIATO'),
  'takeaway.rejected': (c) => (c.status === 'rejected' ? null : 'STATO_CAMBIATO'),
  'takeaway.cancelled': (c) => (c.status === 'cancelled' ? null : 'STATO_CAMBIATO'),
  'takeaway.expired': (c) => (c.status === 'expired' ? null : 'STATO_CAMBIATO'),
};
export const staleReason = (eventId, context) => STILL[eventId](context);

// Il mese di una data, per il contatore delle pratiche (`2026-10`)
export const monthKey = (date = new Date()) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

// Giorno e ora per i testi (fuso del locale): «venerdì 23 ottobre», «20:00»
export const dayLabel = (isoDate) => {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
};
export const euro = (n) => `${Number(n).toFixed(2).replace('.', ',')} €`;
