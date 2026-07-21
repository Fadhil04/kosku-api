import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8, 'Password minimal 8 karakter')
  .regex(/[A-Z]/, 'Password harus mengandung minimal 1 huruf besar')
  .regex(/[a-z]/, 'Password harus mengandung minimal 1 huruf kecil')
  .regex(/[0-9]/, 'Password harus mengandung minimal 1 angka')
  .regex(/[^A-Za-z0-9]/, 'Password harus mengandung minimal 1 simbol');

const phoneSchema = z
  .string()
  .regex(
    /^(\+62|62|0)8[1-9][0-9]{6,10}$/,
    'Format nomor telepon tidak valid (contoh: 08123456789)',
  )
  .optional();

export const registerOwnerSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: passwordSchema,
  full_name: z
    .string()
    .min(2, 'Nama minimal 2 karakter')
    .max(100, 'Nama maksimal 100 karakter'),
  phone_number: phoneSchema,
});

export const loginSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
  role: z.enum(['owner', 'tenant'] as const, {
    error: 'Role harus owner atau tenant',
  }),
});

export const refreshTokenSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token wajib diisi'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  role: z.enum(['owner', 'tenant']),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Token wajib diisi'),
    new_password: passwordSchema,
    confirm_password: z.string().min(1, 'Konfirmasi password wajib diisi'),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: 'Konfirmasi password tidak cocok',
    path: ['confirm_password'],
  });

export const updateProfileSchema = z.object({
  full_name: z
    .string()
    .min(2, 'Nama minimal 2 karakter')
    .max(100, 'Nama maksimal 100 karakter')
    .optional(),
  phone_number: phoneSchema,
  avatar_url: z.string().url('Format URL tidak valid').optional(),
});

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, 'Password saat ini wajib diisi'),
    new_password: passwordSchema,
    confirm_password: z.string().min(1, 'Konfirmasi password wajib diisi'),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: 'Konfirmasi password tidak cocok',
    path: ['confirm_password'],
  });

export type RegisterOwnerInput = z.infer<typeof registerOwnerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;