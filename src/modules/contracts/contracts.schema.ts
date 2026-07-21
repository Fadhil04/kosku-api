import { z } from 'zod';

const additionalChargeSchema = z.object({
  name: z.string().min(1).max(100),
  amount: z.coerce.number().min(0),
});

export const createContractSchema = z
  .object({
    room_id: z.string().uuid('Room ID tidak valid'),
    tenant_id: z.string().uuid('Tenant ID tidak valid'),
    start_date: z.coerce.date(),
    end_date: z.coerce.date(),
    monthly_rent: z.coerce.number().min(100000, 'Sewa minimal Rp 100.000'),
    deposit_amount: z.coerce.number().min(0).default(0),
    billing_date: z.coerce.number().int().min(1).max(28).default(1),
    additional_charges: z.array(additionalChargeSchema).default([]),
    notes: z.string().max(500).optional(),
  })
  .refine(
    (data) => {
      const maxStartDate = new Date();
      maxStartDate.setDate(maxStartDate.getDate() + 30);
      return data.start_date <= maxStartDate;
    },
    {
      message: 'Tanggal mulai tidak boleh lebih dari 30 hari dari sekarang',
      path: ['start_date'],
    },
  )
  .refine(
    (data) => {
      const minEndDate = new Date(data.start_date);
      minEndDate.setMonth(minEndDate.getMonth() + 1);
      return data.end_date >= minEndDate;
    },
    {
      message: 'Tanggal selesai minimal 1 bulan dari tanggal mulai',
      path: ['end_date'],
    },
  );

export const terminateContractSchema = z.object({
  termination_date: z.coerce.date(),
  termination_reason: z.string().min(5, 'Alasan terminasi wajib diisi'),
  deposit_action: z.enum(['REFUND_FULL', 'REFUND_PARTIAL', 'FORFEIT']),
  deposit_refund_amount: z.coerce.number().min(0).optional(),
});

export const renewContractSchema = z.object({
  new_end_date: z.coerce.date(),
  new_monthly_rent: z.coerce.number().min(100000).optional(),
});

export const contractQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(10),
  property_id: z.string().uuid().optional(),
  room_id: z.string().uuid().optional(),
  tenant_id: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'ACTIVE', 'TERMINATED', 'EXPIRED']).optional(),
});

export const expiringContractQuerySchema = z.object({
  days: z.coerce.number().min(1).max(365).default(30),
  property_id: z.string().uuid().optional(),
});

export type CreateContractInput = z.infer<typeof createContractSchema>;
export type TerminateContractInput = z.infer<typeof terminateContractSchema>;
export type RenewContractInput = z.infer<typeof renewContractSchema>;
export type ContractQueryInput = z.infer<typeof contractQuerySchema>;
export type ExpiringContractQueryInput = z.infer<typeof expiringContractQuerySchema>;