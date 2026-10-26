import { z } from 'zod';
import { idSchema } from './common.js';

// Magazzino: ingredienti, preparazioni e ricette. Le quantità sono sempre nell'unità di base dell'ingrediente (g, ml, pc).
export const BASE_UNITS = ['g', 'ml', 'pc'];

const name = z.string().trim().min(1).max(60);
const quantity = z.number().positive().max(10_000_000);

export const ingredientSchema = z.object({
  name,
  base_unit: z.enum(BASE_UNITS),
  // La resa: da 100 g di ingrediente ne restano utilizzabili questa percentuale (1 kg di carne → 800 g = 80)
  yield_percent: z.number().gt(0).max(100).default(100),
  // Sotto questa quantità l'ingrediente è da riordinare
  reorder_level: z.number().min(0).max(10_000_000).nullable().default(null),
  active: z.boolean().default(true),
});

// Una riga di ricetta usa un ingrediente O un'altra preparazione, mai tutti e due.
export const recipeLineSchema = z.object({
  ingredient_id: idSchema.nullable().default(null),
  component_preparation_id: idSchema.nullable().default(null),
  quantity,
}).refine(l => (l.ingredient_id === null) !== (l.component_preparation_id === null), { message: 'Una riga usa un ingrediente o una preparazione' });

const recipeLines = z.array(recipeLineSchema).max(60).refine(
  lines => new Set(lines.map(l => `${l.ingredient_id ?? ''}/${l.component_preparation_id ?? ''}`)).size === lines.length,
  { message: 'Ingrediente ripetuto nella ricetta' });

export const preparationSchema = z.object({
  name,
  base_unit: z.enum(BASE_UNITS),
  // Quanto se ne ottiene con le quantità della ricetta («1000 g di sugo»)
  output_quantity: quantity,
  active: z.boolean().default(true),
  lines: recipeLines.refine(lines => lines.length > 0, { message: 'Serve almeno un ingrediente' }),
});

export const productRecipeSchema = z.object({ lines: recipeLines });

// Cosa cambia un'opzione di un piatto: ingredienti in più (quantità positiva) o in meno (negativa). `affects_stock` spenta = non scala.
export const modifierRecipeSchema = z.object({
  affects_stock: z.boolean().default(true),
  lines: z.array(z.object({ ingredient_id: idSchema, quantity_change: z.number().min(-10_000_000).max(10_000_000).refine(v => v !== 0, { message: 'La variazione non può essere zero' }) })).max(30)
    .refine(lines => new Set(lines.map(l => l.ingredient_id)).size === lines.length, { message: 'Ingrediente ripetuto' }),
});

// «Esaurito» / «di nuovo disponibile», anche dalla cucina
export const availabilitySchema = z.object({ available: z.boolean() });

// ── Scarti, rettifiche, controlli di magazzino, scarico semplificato, report ──
export const WASTE_REASONS = ['broken', 'expired', 'staff', 'gift', 'other'];
const note = z.string().trim().max(200).nullable().default(null).transform(v => (v === '' ? null : v));

// Uno scarto (roba buttata: quantità positiva, motivo) o una rettifica (correzione con segno, nota obbligatoria: si deve capire perché).
export const movementSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('waste'), ingredient_id: idSchema, quantity, reason: z.enum(WASTE_REASONS), note }),
  z.object({
    type: z.literal('adjustment'), ingredient_id: idSchema, note: z.string().trim().min(3, 'Scrivi il motivo della rettifica').max(200),
    quantity_change: z.number().min(-10_000_000).max(10_000_000).refine(v => v !== 0, { message: 'La variazione non può essere zero' }),
  }),
]);

// Un controllo di magazzino: per ogni ingrediente contato, quanto se ne è trovato (nell'unità di base). Gli altri non si toccano.
export const stockLevelSchema = z.object({
  kind: z.enum(['closing', 'periodic']).default('periodic'),
  notes: note,
  lines: z.array(z.object({ ingredient_id: idSchema, counted_quantity: z.number().min(0).max(10_000_000) })).min(1, 'Conta almeno un ingrediente').max(500)
    .refine(lines => new Set(lines.map(l => l.ingredient_id)).size === lines.length, { message: 'Ingrediente ripetuto' }),
});

// Lo scarico semplificato: per ogni ingrediente quanto è stato usato OPPURE quanto ne resta (uno solo dei due).
export const usageSchema = z.object({
  lines: z.array(z.object({ ingredient_id: idSchema, used: z.number().positive().max(10_000_000).optional(), remaining: z.number().min(0).max(10_000_000).optional() })
    .refine(l => (l.used === undefined) !== (l.remaining === undefined), { message: 'Per ogni ingrediente scrivi quanto è stato usato o quanto resta' }))
    .min(1, 'Scrivi almeno un ingrediente').max(500)
    .refine(lines => new Set(lines.map(l => l.ingredient_id)).size === lines.length, { message: 'Ingrediente ripetuto' }),
});

export const movementsQuerySchema = z.object({
  ingredient_id: idSchema.optional(),
  kind: z.enum(['receipt', 'sale', 'sale_reversal', 'usage', 'waste', 'adjustment', 'stock_level']).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export const reportQuerySchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
  tz: z.string().max(60).default('Europe/Rome'),
}).refine(q => q.from <= q.to, { message: 'La data di inizio è dopo quella di fine', path: ['from'] });

export const restockQuerySchema = z.object({
  only: z.enum(['low']).optional(),
  days: z.coerce.number().int().min(1).max(90).default(14),
});
