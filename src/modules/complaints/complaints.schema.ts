import { z } from 'zod';

export const createComplaintSchema = z.object({
  room_id: z.string().uuid('Room ID tidak valid'),
  title: z.string().min(5, 'Judul minimal 5 karakter').max(255),
  description: z.string().min(10, 'Deskripsi minimal 10 karakter').max(2000),
  category: z.enum([
    'FACILITY_DAMAGE',
    'NEIGHBOR_DISTURBANCE',
    'CLEANLINESS',
    'SECURITY',
    'OTHER',
  ]),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  photos: z.array(z.string().url('Format URL foto tidak valid')).default([]),
});

// Urutan status yang diizinkan — tidak bisa mundur
export const COMPLAINT_STATUS_ORDER = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;

export const updateComplaintStatusSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
  note: z.string().max(500).optional(),
});

export const addResponseSchema = z.object({
  message: z.string().min(1, 'Pesan tidak boleh kosong').max(1000),
});

export const complaintQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(10),
  property_id: z.string().uuid().optional(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  category: z
    .enum(['FACILITY_DAMAGE', 'NEIGHBOR_DISTURBANCE', 'CLEANLINESS', 'SECURITY', 'OTHER'])
    .optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
});

export type CreateComplaintInput = z.infer<typeof createComplaintSchema>;
export type UpdateComplaintStatusInput = z.infer<typeof updateComplaintStatusSchema>;
export type AddResponseInput = z.infer<typeof addResponseSchema>;
export type ComplaintQueryInput = z.infer<typeof complaintQuerySchema>;