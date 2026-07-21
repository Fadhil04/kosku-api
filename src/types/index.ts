export interface JwtPayload {
  userId: string;
  email: string;
  role: 'owner' | 'tenant' | 'superadmin';
  iat?: number;
  exp?: number;
}

export interface RequestContext {
  userId: string;
  email: string;
  role: 'owner' | 'tenant' | 'superadmin';
  ipAddress: string;
}

declare global {
  namespace Express {
    interface Request {
      context?: RequestContext;
    }
  }
}