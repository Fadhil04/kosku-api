import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import {
  registerOwnerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
  changePasswordSchema,
} from './auth.schema';
import { apiResponse } from '../../utils/apiResponse';

export class AuthController {

  async registerOwner(req: Request, res: Response, next: NextFunction) {
    try {
      const input = registerOwnerSchema.parse(req.body);
      const data = await authService.registerOwner(input);
      return apiResponse.created(
        res,
        data,
        'Registrasi berhasil',
      );
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const input = loginSchema.parse(req.body);
      const ipAddress = req.ip || 'unknown';
      const data = await authService.login(input, ipAddress);
      return apiResponse.success(res, data, 'Login berhasil');
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const input = refreshTokenSchema.parse(req.body);
      const data = await authService.refreshToken(input);
      return apiResponse.success(res, data, 'Token berhasil diperbarui');
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const input = refreshTokenSchema.parse(req.body);
      const data = await authService.logout(input.refresh_token);
      return apiResponse.success(res, data, 'Logout berhasil');
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const input = forgotPasswordSchema.parse(req.body);
      const data = await authService.forgotPassword(input);
      return apiResponse.success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const input = resetPasswordSchema.parse(req.body);
      const data = await authService.resetPassword(input);
      return apiResponse.success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId, role } = req.context!;
      const data = await authService.getProfile(userId, role);
      return apiResponse.success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId, role } = req.context!;
      const input = updateProfileSchema.parse(req.body);
      const data = await authService.updateProfile(userId, role, input);
      return apiResponse.success(res, data, 'Profil berhasil diperbarui');
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId, role } = req.context!;
      const input = changePasswordSchema.parse(req.body);
      const data = await authService.changePassword(userId, role, input);
      return apiResponse.success(res, data);
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();