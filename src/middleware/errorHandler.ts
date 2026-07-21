import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

export class AppError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 400, code = 'ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      error: { code: err.code },
    });
    return;
  }

  // Prisma errors
  if (err.constructor.name === 'PrismaClientKnownRequestError') {
    const prismaError = err as unknown as { code: string; meta?: { target?: string[] } };

    if (prismaError.code === 'P2002') {
      res.status(409).json({
        success: false,
        message: 'Data sudah ada, terjadi duplikasi',
        error: {
          code: 'DUPLICATE_ENTRY',
          details: prismaError.meta?.target,
        },
      });
      return;
    }

    if (prismaError.code === 'P2025') {
      res.status(404).json({
        success: false,
        message: 'Data tidak ditemukan',
        error: { code: 'NOT_FOUND' },
      });
      return;
    }
  }

  // Zod validation errors
  if (err.constructor.name === 'ZodError') {
    res.status(400).json({
      success: false,
      message: 'Validasi data gagal',
      error: {
        code: 'VALIDATION_FAILED',
        details: (err as unknown as { errors: unknown[] }).errors,
      },
    });
    return;
  }

  // Unknown error
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Terjadi kesalahan pada server',
    error: {
      code: 'SERVER_INTERNAL_ERROR',
      ...(env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
};