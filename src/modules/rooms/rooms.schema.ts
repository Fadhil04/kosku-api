import { z } from 'zod';
import { RoomStatus } from '@prisma/client';

const roomFacilitiesEnum = z.enum([
  'ac',
  'private_bathroom',
  'shared_bathroom',
  'wardrobe',
  'desk',
  'chair',
  'bed',
  'window',
  'balcony',
  'kitchen_access',
  'wifi',
  'tv',
  'refrigerator',
]);

export const createRoomSchema = z.object({
  room_number: z
    .string()
    .min(1, 'Nomor kamar wajib diisi')
    .max(20, 'Nomor kamar maksimal 20 karakter'),
  floor: z.coerce.number().int().min(0).max(100).optional(),
  type: z.string().min(1, 'Tipe kamar wajib diisi').max(50),
  size_sqm: z.coerce.number().min(1).max(999).optional(),
  base_price: z.coerce
    .number()
    .min(100000, 'Harga minimal Rp 100.000')
    .max(100000000, 'Harga maksimal Rp 100.000.000'),
  facilities: z.array(z.string()).default([]),
  photos: z
    .array(z.string().url('Format URL foto tidak valid'))
    .default([]),
  notes: z.string().max(500).optional(),
});

export const updateRoomSchema = createRoomSchema.partial().omit({
  room_number: true, // nomor kamar tidak boleh diubah
});

// State machine: transisi yang diizinkan
export const ALLOWED_TRANSITIONS: Record<RoomStatus, RoomStatus[]> = {
  AVAILABLE: ['RESERVED', 'OCCUPIED'],
  RESERVED: ['OCCUPIED', 'AVAILABLE'],
  OCCUPIED: ['NEEDS_MAINTENANCE'],
  NEEDS_MAINTENANCE: ['AVAILABLE'],
};

export const updateRoomStatusSchema = z.object({
  status: z.nativeEnum(RoomStatus),
  notes: z.string().max(500).optional(),
});

export const roomQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
  status: z.nativeEnum(RoomStatus).optional(),
  floor: z.coerce.number().optional(),
  type: z.string().optional(),
  min_price: z.coerce.number().optional(),
  max_price: z.coerce.number().optional(),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
export type UpdateRoomStatusInput = z.infer<typeof updateRoomStatusSchema>;
export type RoomQueryInput = z.infer<typeof roomQuerySchema>;