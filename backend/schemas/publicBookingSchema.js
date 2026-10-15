import { z } from 'zod';
import { idSchema } from './common.js';
import { MAX_PARTY } from '../utils/bookingPortal.js';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data nel formato AAAA-MM-GG');

export const availabilityQuerySchema = z.object({
  date,
  party: z.coerce.number().int().min(1).max(MAX_PARTY).default(1),
});

// Il portale manda solo la scelta del cliente e i suoi dati: capienze, stati e orari li decide il server.
export const portalRequestSchema = z.object({
  date,
  shift_id: idSchema,
  party_size: z.number().int().min(1, 'Indica quante persone siete').max(MAX_PARTY, `Oltre ${MAX_PARTY} persone telefonaci`),
  customer_name: z.string().trim().min(1, 'Scrivi il tuo nome').max(80),
  phone: z.string().trim().min(1, 'Scrivi un numero di telefono').max(40)
    .refine(v => v.replace(/\D/g, '').length >= 6, 'Il numero di telefono non sembra valido'),
  email: z.string().trim().max(120).default('')
    .refine(v => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'L\'email non sembra valida'),
  notes: z.string().trim().max(500).default(''),
  // consenso separato e facoltativo ai messaggi di ringraziamento e novità del locale
  marketing: z.boolean().default(false),
  consent: z.literal(true, { errorMap: () => ({ message: 'Serve il consenso al trattamento dei dati' }) }),
  // Campo «trappola»: una persona non lo vede e lo lascia vuoto; un programma automatico lo compila.
  website: z.string().max(200).default(''),
  // Quando il modulo è stato aperto (ms): un invio in meno di tre secondi non lo ha scritto una persona.
  opened_at: z.number().int().optional(),
});

export const tokenParamsSchema = z.object({ token: z.string().min(10).max(80).regex(/^[A-Za-z0-9_-]+$/) });
