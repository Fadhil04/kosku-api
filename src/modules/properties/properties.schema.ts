import { z } from 'zod';

const facilitiesSchema = z.array(z.string()).default([]);
const photosSchema = z.array(z.string().url('Format URL foto tidak valid')).default([]);

export const createPropertySchema = z.object({
  name: z
    .string()
    .min(3, 'Nama properti minimal 3 karakter')
    .max(255, 'Nama properti maksimal 255 karakter'),
  address: z.string().min(10, 'Alamat terlalu pendek'),
  city: z.string().min(2, 'Kota wajib diisi'),
  province: z.string().min(2, 'Provinsi wajib diisi'),
  postal_code: z
    .string()
    .regex(/^\d{5}$/, 'Kode pos harus 5 digit angka')
    .optional(),
  description: z.string().max(2000).optional(),
  rules: z.string().max(2000).optional(),
  facilities: facilitiesSchema,
  photos: photosSchema,
});

export const updatePropertySchema = createPropertySchema.partial();

export const propertyQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(10),
  search: z.string().optional(),
  city: z.string().optional(),
  is_active: z.coerce.boolean().optional(),
});

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
export type PropertyQueryInput = z.infer<typeof propertyQuerySchema>;