import { z } from 'zod';

export const billQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(10),
  property_id: z.string().uuid().optional(),
  tenant_id: z.string().uuid().optional(),
  room_id: z.string().uuid().optional(),
  status: z.enum(['UNPAID', 'PARTIALLY_PAID', 'PAID', 'WAIVED']).optional(),
  month: z.coerce.number().min(1).max(12).optional(),
  year: z.coerce.number().min(2020).max(2100).optional(),
});

export const overdueBillQuerySchema = z.object({
  property_id: z.string().uuid().optional(),
  min_days_overdue: z.coerce.number().min(0).default(1),
});

export const discountBillSchema = z.object({
  discount_amount: z.coerce.number().min(0),
  discount_reason: z.string().min(5, 'Alasan diskon wajib diisi').max(500),
});

export const waiveBillSchema = z.object({
  reason: z.string().min(5, 'Alasan penghapusan tagihan wajib diisi').max(500),
});

export type BillQueryInput = z.infer<typeof billQuerySchema>;
export type OverdueBillQueryInput = z.infer<typeof overdueBillQuerySchema>;
export type DiscountBillInput = z.infer<typeof discountBillSchema>;
export type WaiveBillInput = z.infer<typeof waiveBillSchema>;