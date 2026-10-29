import { z } from 'zod';
import { idSchema } from './common.js';
import { MAX_PARTY_ITEMS } from './_takeawayLimits.js';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data nel formato AAAA-MM-GG');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'ora nel formato HH:MM');

// Le righe vengono dal client solo come id e quantità (+ nota): nome e prezzo li legge il server dal catalogo.
const item = z.object({
  id: idSchema,
  quantity: z.number().int().min(1).max(99),
  note: z.string().trim().max(200).default(''),
});
const items = z.array(item).min(1, 'Aggiungi almeno un prodotto').max(MAX_PARTY_ITEMS);

const person = {
  customer_name: z.string().trim().min(1, 'Scrivi il nome di chi ritira').max(80),
  phone: z.string().trim().max(40).default(''),
  notes: z.string().trim().max(500).default(''),
};

// Ordine inserito dal personale (banco o telefono): nasce già accettato.
export const staffOrderSchema = z.object({
  date, time, items, ...person,
  source: z.enum(['counter', 'phone']).default('counter'),
  // il personale può accettare oltre il carico della fascia, di proposito
  ignore_capacity: z.boolean().default(false),
});

// Dal sito pubblico: solo la scelta del cliente e i suoi dati.
export const portalOrderSchema = z.object({
  date, time, items,
  customer_name: person.customer_name,
  phone: z.string().trim().min(1, 'Scrivi un numero di telefono').max(40)
    .refine(v => v.replace(/\D/g, '').length >= 6, 'Il numero di telefono non sembra valido'),
  email: z.string().trim().max(120).default('').refine(v => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'L\'email non sembra valida'),
  notes: person.notes,
  consent: z.literal(true, { errorMap: () => ({ message: 'Serve il consenso al trattamento dei dati' }) }),
  website: z.string().max(200).default(''),
  opened_at: z.number().int().optional(),
});

export const acceptSchema = z.object({ time: time.optional(), ignore_capacity: z.boolean().default(false) });
export const rejectSchema = z.object({ reason: z.string().trim().max(200).default('') });
export const pickedUpSchema = z.object({ method: z.enum(['cash', 'card', 'other']) });
export const ordersQuerySchema = z.object({ date });
// Il carrello per cui si chiedono le fasce, come «id:quantità,id:quantità»: il server ne calcola i minuti di lavoro (il cliente non li vede).
const cart = z.string().max(400).transform(v => v.split(',').filter(Boolean).map(part => { const [id, quantity] = part.split(':'); return { id: Number(id), quantity: Number(quantity) }; }))
  .pipe(z.array(z.object({ id: z.number().int().positive(), quantity: z.number().int().min(1).max(99) })).max(60));
export const slotsQuerySchema = z.object({ date, cart: cart.optional() });
export const hoursSchema = z.object({
  hours: z.array(z.object({ weekday: z.number().int().min(0).max(6), open_time: time, close_time: time }))
    .max(28).refine(a => a.every(h => h.close_time > h.open_time), 'La chiusura deve essere dopo l\'apertura'),
});
export const tokenParamsSchema = z.object({ token: z.string().min(10).max(80).regex(/^[A-Za-z0-9_-]+$/) });
