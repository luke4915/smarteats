import { z } from 'zod';
import { idSchema } from './common.js';

// Fornitori, listino dei loro prodotti e carichi di merce (modulo `inventory`, modalità magazzino). Costi in centesimi, senza IVA.
const text = (max) => z.string().trim().max(max).nullable().default(null).transform(v => (v === '' ? null : v));
const vatRate = z.number().min(0).max(100).nullable().default(null);
const quantity = z.number().positive().max(10_000_000);
const packagingFields = {
  purchase_unit_name: z.string().trim().min(1).max(40),                     // «cassa da 12», «sacco da 25 kg»
  base_units_per_purchase_unit: z.number().positive().max(10_000_000),     // quante unità di base ha una confezione
  unit_cost_cents: z.number().int().min(0).max(100_000_000),                // prezzo di una confezione, senza IVA
  vat_rate: vatRate,
};

export const supplierSchema = z.object({
  name: z.string().trim().min(1).max(80),
  phone: text(30),
  email: text(120),
  vat_number: text(30),
  notes: text(500),
  active: z.boolean().default(true),
});

// Il listino di un fornitore: sostituisce quello di prima.
export const supplierPriceListSchema = z.object({
  items: z.array(z.object({ ingredient_id: idSchema, ...packagingFields })).max(300)
    .refine(items => new Set(items.map(i => i.ingredient_id)).size === items.length, { message: 'Ingrediente ripetuto nel listino' }),
});

export const goodsReceiptSchema = z.object({
  supplier_id: idSchema,
  received_on: z.iso.date(),
  document_number: text(40),
  notes: text(500),
  lines: z.array(z.object({ ingredient_id: idSchema, quantity, ...packagingFields })).min(1, 'Serve almeno una riga').max(100),
});

export const goodsReceiptsQuerySchema = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  supplier_id: idSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const receiptDocumentParamsSchema = z.object({ id: idSchema, documentId: idSchema });
