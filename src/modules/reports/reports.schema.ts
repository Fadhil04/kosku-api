import { z } from 'zod';

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

export const revenueReportSchema = z.object({
  property_id: z.string().uuid('Property ID tidak valid'),
  month: z.coerce.number().min(1).max(12).default(currentMonth),
  year: z.coerce.number().min(2020).max(2100).default(currentYear),
});

export const occupancyReportSchema = z.object({
  property_id: z.string().uuid('Property ID tidak valid'),
  year: z.coerce.number().min(2020).max(2100).default(currentYear),
});

export const paymentBehaviorSchema = z.object({
  property_id: z.string().uuid('Property ID tidak valid'),
  months: z.coerce.number().min(1).max(24).default(6),
});

export const complaintsSummarySchema = z.object({
  property_id: z.string().uuid('Property ID tidak valid'),
  month: z.coerce.number().min(1).max(12).optional(),
  year: z.coerce.number().min(2020).max(2100).optional(),
});

export const expiringContractsReportSchema = z.object({
  property_id: z.string().uuid().optional(),
  days: z.coerce.number().min(1).max(365).default(60),
});

export type RevenueReportInput = z.infer<typeof revenueReportSchema>;
export type OccupancyReportInput = z.infer<typeof occupancyReportSchema>;
export type PaymentBehaviorInput = z.infer<typeof paymentBehaviorSchema>;
export type ComplaintsSummaryInput = z.infer<typeof complaintsSummarySchema>;
export type ExpiringContractsReportInput = z.infer<typeof expiringContractsReportSchema>;