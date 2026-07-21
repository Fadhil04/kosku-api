import { Router } from 'express';
import { authController } from './auth.controller';
import { authenticate } from '../../middleware/authenticate';
import {
  authRateLimiter,
  forgotPasswordRateLimiter,
} from '../../middleware/rateLimiter';

const router = Router();

// Public routes (tidak perlu login)
router.post('/register/owner', authController.registerOwner.bind(authController));
router.post('/login', authRateLimiter, authController.login.bind(authController));
router.post('/refresh-token', authController.refreshToken.bind(authController));
router.post('/logout', authController.logout.bind(authController));
router.post('/forgot-password', forgotPasswordRateLimiter, authController.forgotPassword.bind(authController));
router.post('/reset-password', authController.resetPassword.bind(authController));

// Protected routes (harus login)
router.get('/me', authenticate, authController.getProfile.bind(authController));
router.put('/me', authenticate, authController.updateProfile.bind(authController));
router.put('/me/password', authenticate, authController.changePassword.bind(authController));

export { router as authRouter };