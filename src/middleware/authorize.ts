import { Request, Response, NextFunction } from 'express';
import { apiResponse } from '../utils/apiResponse';

type Role = 'owner' | 'tenant' | 'superadmin';

export const authorize = (...allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.context) {
      apiResponse.error(
        res,
        'Tidak terautentikasi',
        401,
        'AUTH_UNAUTHENTICATED',
      );
      return;
    }

    if (!allowedRoles.includes(req.context.role)) {
      apiResponse.error(
        res,
        'Kamu tidak memiliki akses ke resource ini',
        403,
        'AUTH_FORBIDDEN_INSUFFICIENT_ROLE',
      );
      return;
    }

    next();
  };
};