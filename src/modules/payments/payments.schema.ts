import { z } from 'zod';

export const createPaymentSchema = z.object({
  idempotency_key: z
    .string()
    .min(10, 'Idempotency key minimal 10 karakter')
    .max(255),
  amount: z.coerce.number().min(1, 'Jumlah pembayaran harus lebih dari 0'),
  payment_method: z.enum(['CASH', 'BANK_TRANSFER', 'EWALLET', 'OTHER']),
  payment_date: z.coerce.date(),
  reference_number: z.string().max(100).optional(),
  proof_url: z.string().url('Format URL bukti pembayaran tidak valid').optional(),
  notes: z.string().max(500).optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;