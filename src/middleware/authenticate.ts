import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { apiResponse } from '../utils/apiResponse';

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      apiResponse.error(
        res,
        'Token autentikasi tidak ditemukan',
        401,
        'AUTH_TOKEN_MISSING',
      );
      return;
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyAccessToken(token);

    req.context = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      ipAddress: req.ip || 'unknown',
    };

    next();
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'TokenExpiredError') {
        apiResponse.error(
          res,
          'Token sudah kadaluarsa',
          401,
          'AUTH_TOKEN_EXPIRED',
        );
        return;
      }
      if (error.name === 'JsonWebTokenError') {
        apiResponse.error(
          res,
          'Token tidak valid',
          401,
          'AUTH_TOKEN_INVALID',
        );
        return;
      }
    }
    apiResponse.error(res, 'Autentikasi gagal', 401, 'AUTH_FAILED');
  }
};