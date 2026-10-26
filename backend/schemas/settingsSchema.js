import { z } from 'zod';

// Chiavi di impostazione gestite dall'app. Una chiave nuova va aggiunta qui;
// se deve essere visibile anche senza login (menu pubblico), va anche in PUBLIC_SETTINGS_KEYS.
//
// receipt_*: contenuto degli scontrini, per tenant (intestazione, titoli, testi legali, immagini).
// Le scrive solo il pannello master (PUT /master/tenants/:id/receipt); sono private: le legge la cassa
// autenticata (GET /settings/all) e le salva in locale per stampare offline.
export const RECEIPT_SETTINGS_KEYS = [
  'receipt_org_name',     // intestazione: nome dell'organizzazione
  'receipt_org_tax_code', // intestazione: codice fiscale / partita IVA
  'receipt_title',        // titolo del documento (es. DOCUMENTO NON FISCALE)
  'receipt_item_header',  // titolo della colonna delle righe (es. ARTICOLO)
  'receipt_amount_header', // titolo della colonna degli importi (es. IMPORTO)
  'receipt_total_label',  // etichetta del totale (es. TOTALE)
  'receipt_legal_text',   // testo legale a piè di scontrino, una riga per riga di stampa
  'receipt_logo',         // logo in cima alle copie: immagine PNG in data URL, già in bianco e nero
  'receipt_side_image',   // immagine ai lati del numero ordine (numeretto e copie di ritiro), stesso formato
];

// Portale di prenotazione (modulo `bookings`): acceso/spento, telefono mostrato ai clienti, testo di benvenuto. Non sono
// in PUBLIC_SETTINGS_KEYS: le legge solo il portale (routes/publicBooking.js), con le sue regole.
const BOOKING_PORTAL_KEYS = ['booking_portal_enabled', 'booking_portal_phone', 'booking_portal_welcome'];

// cover_charge: coperto per persona, in euro (ristoranti): si fissa su ogni conto all'apertura.
// Asporto (modulo `takeaway`): ordini dal sito pubblico acceso/spento, durata delle fasce (minuti), pizze (carico) per
// fascia, anticipo minimo (minuti), telefono e messaggio mostrati ai clienti. Le legge solo il portale, con le sue regole.
const TAKEAWAY_KEYS = ['takeaway_portal_enabled', 'takeaway_slot_minutes', 'takeaway_slot_capacity', 'takeaway_min_lead_minutes', 'takeaway_phone', 'takeaway_welcome'];

// default_vat_rate: IVA di vendita dei piatti senza un'aliquota propria, in percentuale (magazzino: ricavi e margini al netto dell'IVA).
// reserved_data_lock: '1' = costi, margini e statistiche di incasso restano bloccati finché un amministratore non li sblocca (utils/reservedData.js).
export const SETTINGS_KEYS = ['welcome_message', 'cover_charge', 'default_vat_rate', 'reserved_data_lock', ...BOOKING_PORTAL_KEYS, ...TAKEAWAY_KEYS, ...RECEIPT_SETTINGS_KEYS];
export const PUBLIC_SETTINGS_KEYS = ['welcome_message'];

// Chiavi che l'admin del tenant può modificare: quelle dello scontrino sono solo del master.
const TENANT_WRITABLE_SETTINGS_KEYS = ['welcome_message', 'cover_charge', 'default_vat_rate', 'reserved_data_lock', ...BOOKING_PORTAL_KEYS, ...TAKEAWAY_KEYS];

export const settingParamsSchema = z.object({ key: z.enum(TENANT_WRITABLE_SETTINGS_KEYS) });

export const settingValueSchema = z.object({
  value: z.string().max(2000).nullable(),
});
