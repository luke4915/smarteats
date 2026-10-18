import { z } from 'zod';

const FEEDBACK_MODULES = ['general', 'pos', 'floor', 'reservations', 'takeaway', 'kitchen', 'catalog', 'stats', 'settings'];

export const feedbackSchema = z.object({
  module: z.enum(FEEDBACK_MODULES).default('general'),
  message: z.string().trim().min(3, 'Scrivi almeno qualche parola').max(2000, 'Al massimo 2000 caratteri'),
});

export const feedbackStatusSchema = z.object({ status: z.enum(['new', 'read']) });
