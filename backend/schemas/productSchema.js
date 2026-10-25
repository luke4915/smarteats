import { z } from 'zod';
import { PORTIONS_RULES } from '../utils/inventory/portions.js';

const DEFAULT_COLOR = '#3b82f6';

// Prodotto a catalogo (creazione e modifica). I campi extra che il frontend invia
// insieme al prodotto (id, stock, tenant_id…) vengono ignorati.
export const productSchema = z.object({
  name: z.string().trim().min(1).max(40),
  price: z.coerce.number().nonnegative().max(100000),
  category: z.string().trim().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullish().transform(c => c || DEFAULT_COLOR),
  visible: z.boolean().default(true),
  print_destination: z.enum(['bar', 'kitchen', 'both']).default('both'),
  // Portata (modulo tavoli). Assente = non si cambia; null = nessuna portata.
  course_id: z.number().int().positive().nullable().optional(),
  // Carico sul forno (modulo asporto): quante unità di capienza occupa una porzione. Assente = non si cambia.
  takeaway_load: z.number().int().min(0).max(20).optional(),
  // Porzioni (modulo magazzino): regola di azzeramento e porzioni di partenza. Assenti = non si cambiano.
  portions_reset_rule: z.enum(PORTIONS_RULES).optional(),
  portions_start: z.number().int().min(1).max(100000).nullable().optional(),
  // IVA di vendita del piatto, in percentuale (magazzino: margini al netto dell'IVA). Assente = non si cambia; null = quella predefinita del locale.
  // (PostgreSQL restituisce i numeri decimali come testo, e il frontend può rimandarli così com'erano: «10.00» vale 10)
  vat_rate: z.preprocess(v => (typeof v === 'string' && v.trim() !== '' ? Number(v) : v), z.number().min(0).max(99).nullable().optional()),
}).refine(p => p.portions_reset_rule !== 'restart_each_service' || p.portions_start != null,
  { message: 'Con «riparti da N» serve il numero di porzioni di partenza', path: ['portions_start'] });

export const bulkVisibilitySchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
  visible: z.boolean(),
});

// Stock attivo → quantità obbligatoria; stock disattivo → disponibilità illimitata.
export const stockSchema = z.object({
  stock_enabled: z.boolean(),
  stock: z.number().int().nonnegative().nullable(),
}).refine(s => !s.stock_enabled || s.stock !== null, { message: 'Con lo stock attivo serve una quantità', path: ['stock'] })
  .transform(s => ({ stock_enabled: s.stock_enabled, stock: s.stock_enabled ? s.stock : null }));
