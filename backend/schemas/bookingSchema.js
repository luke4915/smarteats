import { z } from 'zod';
import { idSchema } from './common.js';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data nel formato AAAA-MM-GG').refine((v) => {
  const [y, m, d] = v.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}, 'data non valida');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'ora nel formato HH:MM');

export const shiftSchema = z.object({
  name: z.string().trim().min(1).max(40),
  start_time: time,
  duration_minutes: z.number().int().min(15).max(480).default(90),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1, 'Scegli almeno un giorno').max(7)
    .refine(a => new Set(a).size === a.length, 'Giorno ripetuto'),
  capacity: z.number().int().min(1).max(999),
  active: z.boolean().default(true),
});

export const closureSchema = z.object({
  date_from: date,
  date_to: date,
  shift_id: idSchema.nullable().default(null),
  reason: z.string().trim().max(200).default(''),
}).refine(c => c.date_to >= c.date_from, { message: 'La data finale è prima di quella iniziale', path: ['date_to'] });

export const closuresQuerySchema = z.object({ from: date.optional(), to: date.optional() });

// Campi del cliente: nella creazione hanno un valore predefinito (vuoto), in modifica no (un campo assente non si tocca).
const emailRule = (v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const fields = {
  customer_name: z.string().trim().min(1, 'Il nome è obbligatorio').max(80),
  phone: z.string().trim().max(40),
  email: z.string().trim().max(120).refine(emailRule, 'email non valida'),
  notes: z.string().trim().max(500),
};
const person = { customer_name: fields.customer_name, phone: fields.phone.default(''), email: fields.email.default(''), notes: fields.notes.default('') };

// Inserimento a mano del personale (telefonata, di persona): nasce già confermata.
export const createReservationSchema = z.object({
  date,
  shift_id: idSchema,
  party_size: z.number().int().min(1).max(99),
  ...person,
  table_ids: z.array(idSchema).max(12).default([]),
  // il personale può accettare oltre la capienza, di proposito
  ignore_capacity: z.boolean().default(false),
});

export const updateReservationSchema = z.object({
  date: date.optional(),
  shift_id: idSchema.optional(),
  party_size: z.number().int().min(1).max(99).optional(),
  customer_name: fields.customer_name.optional(),
  phone: fields.phone.optional(),
  email: fields.email.optional(),
  notes: fields.notes.optional(),
  ignore_capacity: z.boolean().default(false),
}).refine(v => ['date', 'shift_id', 'party_size', 'customer_name', 'phone', 'email', 'notes'].some(k => v[k] !== undefined), { message: 'Niente da modificare' });

export const declineSchema = z.object({ reason: z.string().trim().max(200).default('') });

export const reservationTablesSchema = z.object({
  table_ids: z.array(idSchema).max(12).refine(a => new Set(a).size === a.length, 'Tavolo ripetuto'),
});

export const arrivedSchema = z.object({ table_id: idSchema.optional() });

export const reservationsQuerySchema = z.object({ date, shift_id: idSchema.optional() });
export const availabilityQuerySchema = z.object({ date });
