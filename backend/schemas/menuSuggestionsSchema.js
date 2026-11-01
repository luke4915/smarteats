import { z } from 'zod';
import { MAX_RULES } from '../utils/menuSuggestions.js';

// Le regole dei suggerimenti del menu: «quando» è una categoria o un prodotto (uno solo), «suggest» il prodotto da proporre.
const rule = z.object({
  category: z.string().trim().min(1, 'categoria vuota').max(60).optional(),
  product: z.number().int().positive().optional(),
  suggest: z.number().int().positive(),
}).refine(r => (r.category !== undefined) !== (r.product !== undefined), { message: 'scegli una categoria oppure un prodotto' });

export const menuSuggestionsSchema = z.object({ rules: z.array(rule).max(MAX_RULES, `al massimo ${MAX_RULES} suggerimenti`) });
