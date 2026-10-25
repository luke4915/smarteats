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
