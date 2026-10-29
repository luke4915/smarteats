import { z } from 'zod';
import { idSchema } from './common.js';

const timeZone = z.string().max(64).refine((tz) => {
  try { new Intl.DateTimeFormat('it-IT', { timeZone: tz }); return true; } catch { return false; }
}, 'fuso orario non valido');

// "1,2,3" → [1, 2, 3]. Assente o vuoto = tutte le serate.
const sessionIds = z.string().max(500).transform((v) => v.split(',').filter(Boolean)).pipe(z.array(idSchema).max(100));

export const statsQuerySchema = z.object({
  sessions: sessionIds.optional(),
  tz: timeZone.default('Europe/Rome'),
});

// Esportazioni di una serata: `type` sceglie il CSV (una riga per riga d'ordine, oppure il riepilogo per prodotto); le ore sono nel fuso `tz`.
export const sessionExportQuerySchema = z.object({
  type: z.enum(['lines', 'products']).default('lines'),
  tz: timeZone.default('Europe/Rome'),
});
export const sessionReportQuerySchema = z.object({ tz: timeZone.default('Europe/Rome') });

export const sharedProductsQuerySchema = z.object({
  a: idSchema.optional(),
  b: idSchema.optional(),
});

export const headToHeadQuerySchema = z.object({
  a: idSchema,
  b: idSchema,
  product: idSchema,
});

// Elenco ordini: paginazione "keyset" (before = id dell'ultimo ricevuto) e filtro per stato.
export const listOrdersQuerySchema = z.object({
  session: z.literal('active').optional(),
  status: z.string().max(100).transform((v) => v.split(',').filter(Boolean)).pipe(z.array(z.enum(['scheduled', 'pending', 'preparing', 'completed', 'canceled']))).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  before: idSchema.optional(),
});
