import { z } from 'zod';
import { EVENT_IDS } from '../utils/whatsapp.js';

// Configurazione del modulo per locale (solo Master): eventi acceso/spento e tetto mensile di pratiche.
export const whatsappConfigSchema = z.object({
  // solo gli eventi indicati cambiano; un evento sconosciuto è un errore
  events: z.object(Object.fromEntries(EVENT_IDS.map(id => [id, z.boolean().optional()]))).strict().default({}),
  quota: z.number().int().min(0).max(100000).optional(),
});

export const whatsappTestSchema = z.object({ to: z.string().trim().min(6, 'Scrivi un numero di cellulare').max(40) });
