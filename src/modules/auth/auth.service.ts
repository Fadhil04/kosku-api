import { prisma } from '../../config/database';
import { sendEmail } from '../../config/email';
import { hashPassword, comparePassword } from '../../utils/hash';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  getRefreshTokenExpiry,
} from '../../utils/jwt';
import { generateRandomToken, getPasswordResetExpiry } from '../../utils/token';
import { AppError } from '../../middleware/errorHandler';
import {
  passwordResetTemplate,
} from '../../utils/emailTemplates';
import type {
  RegisterOwnerInput,
  LoginInput,
  RefreshTokenInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  UpdateProfileInput,
  ChangePasswordInput,
} from './auth.schema';

export class AuthService {

  // ────────────────────────────────────────────────
  // REGISTER OWNER
  // ────────────────────────────────────────────────
  async registerOwner(input: RegisterOwnerInput) {
    const existingOwner = await prisma.owner.findUnique({
      where: { email: input.email },
    });

    if (existingOwner) {
      throw new AppError('Email sudah terdaftar', 409, 'AUTH_EMAIL_ALREADY_EXISTS');
    }

    const passwordHash = await hashPassword(input.password);

    const owner = await prisma.owner.create({
      data: {
        email: input.email,
        passwordHash,
        fullName: input.full_name,
        phoneNumber: input.phone_number,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        createdAt: true,
      },
    });

    return owner;
  }

  // ────────────────────────────────────────────────
  // LOGIN
  // ────────────────────────────────────────────────
  async login(input: LoginInput, ipAddress: string) {
    const role = input.role;

    // Ambil user sesuai role
    let user: { id: string; email: string; fullName: string; passwordHash: string; isActive: boolean } | null = null;

    if (role === 'owner') {
      user = await prisma.owner.findFirst({
        where: { email: input.email, deletedAt: null },
        select: {
          id: true,
          email: true,
          fullName: true,
          passwordHash: true,
          isActive: true,
        },
      });
    } else {
      user = await prisma.tenant.findFirst({
        where: { email: input.email, deletedAt: null },
        select: {
          id: true,
          email: true,
          fullName: true,
          passwordHash: true,
          isActive: true,
        },
      });
    }

    if (!user) {
      throw new AppError(
        'Email atau password salah',
        401,
        'AUTH_LOGIN_INVALID_CREDENTIALS',
      );
    }

    if (!user.isActive) {
      throw new AppError(
        'Akun kamu tidak aktif, hubungi administrator',
        403,
        'AUTH_ACCOUNT_INACTIVE',
      );
    }

    const isPasswordValid = await comparePassword(input.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError(
        'Email atau password salah',
        401,
        'AUTH_LOGIN_INVALID_CREDENTIALS',
      );
    }

    // Generate tokens
    const tokenPayload = { userId: user.id, email: user.email, role };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Simpan refresh token ke database
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        userType: role,
        token: refreshToken,
        expiresAt: getRefreshTokenExpiry(),
      },
    });

    // Catat audit log
    await prisma.auditLog.create({
      data: {
        entityType: role,
        entityId: user.id,
        action: 'LOGIN',
        newValues: { ip: ipAddress },
        performedBy: user.id,
        performerRole: role,
        ipAddress,
      },
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 900, // 15 menit dalam detik
      user: {
        id: user.id,
        email: user.email,
        full_name: user.fullName,
        role,
      },
    };
  }

  // ────────────────────────────────────────────────
  // REFRESH TOKEN
  // ────────────────────────────────────────────────
  async refreshToken(input: RefreshTokenInput) {
    let payload;
    try {
      payload = verifyRefreshToken(input.refresh_token);
    } catch {
      throw new AppError('Refresh token tidak valid atau kadaluarsa', 401, 'AUTH_TOKEN_INVALID');
    }

    // Cek refresh token di database
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: input.refresh_token },
    });

    if (!storedToken) {
      throw new AppError('Refresh token tidak ditemukan', 401, 'AUTH_TOKEN_NOT_FOUND');
    }

    if (storedToken.revokedAt) {
      throw new AppError('Refresh token sudah digunakan atau dicabut', 401, 'AUTH_TOKEN_REVOKED');
    }

    if (storedToken.expiresAt < new Date()) {
      throw new AppError('Refresh token sudah kadaluarsa', 401, 'AUTH_TOKEN_EXPIRED');
    }

    // Revoke token lama (rolling refresh token)
    await prisma.refreshToken.update({
      where: { token: input.refresh_token },
      data: { revokedAt: new Date() },
    });

    // Generate token baru
    const tokenPayload = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    };

    const newAccessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    await prisma.refreshToken.create({
      data: {
        userId: payload.userId,
        userType: payload.role,
        token: newRefreshToken,
        expiresAt: getRefreshTokenExpiry(),
      },
    });

    return {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      expires_in: 900,
    };
  }

  // ────────────────────────────────────────────────
  // LOGOUT
  // ────────────────────────────────────────────────
  async logout(refreshToken: string) {
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (storedToken && !storedToken.revokedAt) {
      await prisma.refreshToken.update({
        where: { token: refreshToken },
        data: { revokedAt: new Date() },
      });
    }

    return { message: 'Logout berhasil' };
  }

  // ────────────────────────────────────────────────
  // FORGOT PASSWORD
  // ────────────────────────────────────────────────
  async forgotPassword(input: ForgotPasswordInput) {
    let user: { id: string; fullName: string } | null = null;

    if (input.role === 'owner') {
      user = await prisma.owner.findFirst({
        where: { email: input.email, deletedAt: null },
        select: { id: true, fullName: true },
      });
    } else {
      user = await prisma.tenant.findFirst({
        where: { email: input.email, deletedAt: null },
        select: { id: true, fullName: true },
      });
    }

    // Selalu return 200 meskipun user tidak ditemukan
    // untuk mencegah email enumeration attack
    if (!user) {
      return { message: 'Jika email terdaftar, link reset akan dikirim' };
    }

    // Hapus token lama yang belum dipakai
    await prisma.passwordResetToken.deleteMany({
      where: {
        userId: user.id,
        userType: input.role,
        usedAt: null,
      },
    });

    // Buat token baru
    const resetToken = generateRandomToken();
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        userType: input.role,
        token: resetToken,
        expiresAt: getPasswordResetExpiry(),
      },
    });

    // Kirim email
    const template = passwordResetTemplate({
      fullName: user.fullName,
      resetToken,
    });

    await sendEmail({
      to: input.email,
      subject: template.subject,
      html: template.html,
    });

    return { message: 'Jika email terdaftar, link reset akan dikirim' };
  }

  // ────────────────────────────────────────────────
  // RESET PASSWORD
  // ────────────────────────────────────────────────
  async resetPassword(input: ResetPasswordInput) {
    const resetRecord = await prisma.passwordResetToken.findUnique({
      where: { token: input.token },
    });

    if (!resetRecord) {
      throw new AppError('Token reset tidak valid', 400, 'AUTH_RESET_TOKEN_INVALID');
    }

    if (resetRecord.usedAt) {
      throw new AppError('Token reset sudah pernah digunakan', 400, 'AUTH_RESET_TOKEN_USED');
    }

    if (resetRecord.expiresAt < new Date()) {
      throw new AppError('Token reset sudah kadaluarsa', 400, 'AUTH_RESET_TOKEN_EXPIRED');
    }

    const newPasswordHash = await hashPassword(input.new_password);

    // Update password dan tandai token sebagai sudah dipakai
    if (resetRecord.userType === 'owner') {
      await prisma.owner.update({
        where: { id: resetRecord.userId },
        data: { passwordHash: newPasswordHash },
      });
    } else {
      await prisma.tenant.update({
        where: { id: resetRecord.userId },
        data: { passwordHash: newPasswordHash },
      });
    }

    await prisma.passwordResetToken.update({
      where: { token: input.token },
      data: { usedAt: new Date() },
    });

    // Revoke semua refresh token user ini
    await prisma.refreshToken.updateMany({
      where: {
        userId: resetRecord.userId,
        userType: resetRecord.userType,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    return { message: 'Password berhasil direset, silakan login kembali' };
  }

  // ────────────────────────────────────────────────
  // GET PROFILE
  // ────────────────────────────────────────────────
  async getProfile(userId: string, role: string) {
    if (role === 'owner') {
      const owner = await prisma.owner.findFirst({
        where: { id: userId, deletedAt: null },
        select: {
          id: true,
          email: true,
          fullName: true,
          phoneNumber: true,
          avatarUrl: true,
          isVerified: true,
          createdAt: true,
        },
      });

      if (!owner) throw new AppError('Akun tidak ditemukan', 404, 'OWNER_NOT_FOUND');
      return { ...owner, role: 'owner' };
    }

    const tenant = await prisma.tenant.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        fullName: true,
        phoneNumber: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        createdAt: true,
      },
    });

    if (!tenant) throw new AppError('Akun tidak ditemukan', 404, 'TENANT_NOT_FOUND');
    return { ...tenant, role: 'tenant' };
  }

  // ────────────────────────────────────────────────
  // UPDATE PROFILE
  // ────────────────────────────────────────────────
  async updateProfile(userId: string, role: string, input: UpdateProfileInput) {
    if (role === 'owner') {
      const updated = await prisma.owner.update({
        where: { id: userId },
        data: {
          ...(input.full_name && { fullName: input.full_name }),
          ...(input.phone_number && { phoneNumber: input.phone_number }),
          ...(input.avatar_url && { avatarUrl: input.avatar_url }),
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          phoneNumber: true,
          avatarUrl: true,
        },
      });
      return updated;
    }

    const updated = await prisma.tenant.update({
      where: { id: userId },
      data: {
        ...(input.full_name && { fullName: input.full_name }),
        ...(input.phone_number && { phoneNumber: input.phone_number }),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phoneNumber: true,
      },
    });
    return updated;
  }

  // ────────────────────────────────────────────────
  // CHANGE PASSWORD
  // ────────────────────────────────────────────────
  async changePassword(userId: string, role: string, input: ChangePasswordInput) {
    let currentHash = '';

    if (role === 'owner') {
      const owner = await prisma.owner.findUnique({
        where: { id: userId },
        select: { passwordHash: true },
      });
      if (!owner) throw new AppError('Akun tidak ditemukan', 404, 'OWNER_NOT_FOUND');
      currentHash = owner.passwordHash;
    } else {
      const tenant = await prisma.tenant.findUnique({
        where: { id: userId },
        select: { passwordHash: true },
      });
      if (!tenant) throw new AppError('Akun tidak ditemukan', 404, 'TENANT_NOT_FOUND');
      currentHash = tenant.passwordHash;
    }

    const isCurrentPasswordValid = await comparePassword(input.current_password, currentHash);
    if (!isCurrentPasswordValid) {
      throw new AppError('Password saat ini salah', 400, 'AUTH_WRONG_CURRENT_PASSWORD');
    }

    const newPasswordHash = await hashPassword(input.new_password);

    if (role === 'owner') {
      await prisma.owner.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash },
      });
    } else {
      await prisma.tenant.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash },
      });
    }

    // Revoke semua refresh token kecuali yang sedang aktif
    await prisma.refreshToken.updateMany({
      where: { userId, userType: role, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { message: 'Password berhasil diubah' };
  }
}

export const authService = new AuthService();