import rateLimit from 'express-rate-limit';
import { apiResponse } from '../utils/apiResponse';

export const globalRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 menit
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    apiResponse.error(
      res,
      'Terlalu banyak request, coba lagi nanti',
      429,
      'RATE_LIMIT_EXCEEDED',
    );
  },
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Hanya hitung attempt yang gagal
  handler: (_req, res) => {
    apiResponse.error(
      res,
      'Terlalu banyak percobaan login, coba lagi dalam 15 menit',
      429,
      'AUTH_LOGIN_ACCOUNT_LOCKED',
    );
  },
});

export const forgotPasswordRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 jam
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    apiResponse.error(
      res,
      'Terlalu banyak permintaan reset password, coba lagi dalam 1 jam',
      429,
      'RATE_LIMIT_EXCEEDED',
    );
  },
});

export const reportsRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.context?.userId || req.ip || 'unknown',
  handler: (_req, res) => {
    apiResponse.error(
      res,
      'Terlalu banyak request laporan, tunggu sebentar',
      429,
      'RATE_LIMIT_EXCEEDED',
    );
  },
});