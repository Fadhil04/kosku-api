import { z } from 'zod';

const optionalPhoneSchema = z.preprocess(
  (val) => {
    if (typeof val === 'string') {
      const cleaned = val.replace(/[\s-]/g, '');
      return cleaned === '' ? undefined : cleaned;
    }
    return val;
  },
  z.string().regex(/^(\+62|62|0)8[0-9]{8,11}$/, 'Format nomor HP tidak valid (contoh: 08123456789)').optional(),
);

const optionalIdCardSchema = z.preprocess(
  (val) => {
    if (typeof val === 'string') {
      const cleaned = val.replace(/[\s-]/g, '');
      return cleaned === '' ? undefined : cleaned;
    }
    return val;
  },
  z.string().regex(/^\d{16}$/, 'Nomor KTP harus 16 digit angka').optional(),
);

export const createTenantSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  full_name: z.string().min(2).max(100),
  phone_number: optionalPhoneSchema,
  id_card_number: optionalIdCardSchema,
  emergency_contact_name: z.preprocess((val) => (val === '' ? undefined : val), z.string().max(100).optional()),
  emergency_contact_phone: optionalPhoneSchema,
});

export const updateTenantSchema = z.object({
  full_name: z.string().min(2).max(100).optional(),
  phone_number: optionalPhoneSchema,
  id_card_number: optionalIdCardSchema,
  emergency_contact_name: z.preprocess((val) => (val === '' ? undefined : val), z.string().max(100).optional()),
  emergency_contact_phone: optionalPhoneSchema,
});

export const tenantQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(10),
  property_id: z.string().uuid().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  search: z.string().optional(),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
export type TenantQueryInput = z.infer<typeof tenantQuerySchema>;