import { z } from 'zod';
import { pinProblem } from '../utils/pinRules.js';

// Il PIN da impostare: 4-6 cifre e non banale (il motivo arriva in italiano nel messaggio).
export const newPinSchema = z.object({
  pin: z.string().superRefine((pin, ctx) => { const problem = pinProblem(pin); if (problem) ctx.addIssue({ code: 'custom', message: problem }); }),
});

// Sblocco dello schermo: con il PIN, oppure con la password se il PIN non si ricorda.
export const unlockSchema = z.object({
  pin: z.string().max(10).optional(),
  password: z.string().max(200).optional(),
}).refine(v => (v.pin !== undefined) !== (v.password !== undefined), { message: 'Manda il PIN oppure la password' });

export const switchSchema = z.object({
  userId: z.number().int().positive(),
  pin: z.string().max(10),
});
