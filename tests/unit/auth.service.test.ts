import { AuthService } from '../../src/modules/auth/auth.service';
import { prisma } from '../../src/config/database';
import { hashPassword } from '../../src/utils/hash';
import { AppError } from '../../src/middleware/errorHandler';

// Mock semua dependency eksternal
jest.mock('../../src/config/database', () => ({
  prisma: {
    owner: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    passwordResetToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  },
}));

jest.mock('../../src/config/email', () => ({
  sendEmail: jest.fn(),
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const authService = new AuthService();

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────
  describe('registerOwner', () => {
    it('berhasil register owner baru', async () => {
      (mockPrisma.owner.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.owner.create as jest.Mock).mockResolvedValue({
        id: 'uuid-123',
        email: 'test@test.com',
        fullName: 'Test User',
        createdAt: new Date(),
      });

      const result = await authService.registerOwner({
        email: 'test@test.com',
        password: 'Password1!',
        full_name: 'Test User',
      });

      expect(result.email).toBe('test@test.com');
      expect(mockPrisma.owner.create).toHaveBeenCalledTimes(1);
    });

    it('gagal jika email sudah terdaftar', async () => {
      (mockPrisma.owner.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing-uuid',
        email: 'test@test.com',
      });

      await expect(
        authService.registerOwner({
          email: 'test@test.com',
          password: 'Password1!',
          full_name: 'Test User',
        }),
      ).rejects.toThrow(AppError);

      await expect(
        authService.registerOwner({
          email: 'test@test.com',
          password: 'Password1!',
          full_name: 'Test User',
        }),
      ).rejects.toMatchObject({
        code: 'AUTH_EMAIL_ALREADY_EXISTS',
        statusCode: 409,
      });
    });
  });

  // ─────────────────────────────────────────
  describe('login', () => {
    it('berhasil login dengan kredensial yang benar', async () => {
      const hash = await hashPassword('Password1!');

      (mockPrisma.owner.findFirst as jest.Mock).mockResolvedValue({
        id: 'uuid-123',
        email: 'test@test.com',
        fullName: 'Test User',
        passwordHash: hash,
        isActive: true,
      });

      (mockPrisma.refreshToken.create as jest.Mock).mockResolvedValue({});
      (mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await authService.login(
        { email: 'test@test.com', password: 'Password1!', role: 'owner' },
        '127.0.0.1',
      );

      expect(result.access_token).toBeDefined();
      expect(result.refresh_token).toBeDefined();
      expect(result.user.role).toBe('owner');
    });

    it('gagal login jika password salah', async () => {
      const hash = await hashPassword('Password1!');

      (mockPrisma.owner.findFirst as jest.Mock).mockResolvedValue({
        id: 'uuid-123',
        email: 'test@test.com',
        fullName: 'Test User',
        passwordHash: hash,
        isActive: true,
      });

      await expect(
        authService.login(
          { email: 'test@test.com', password: 'WrongPassword1!', role: 'owner' },
          '127.0.0.1',
        ),
      ).rejects.toMatchObject({
        code: 'AUTH_LOGIN_INVALID_CREDENTIALS',
      });
    });

    it('gagal login jika user tidak ditemukan', async () => {
      (mockPrisma.owner.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        authService.login(
          { email: 'tidakada@test.com', password: 'Password1!', role: 'owner' },
          '127.0.0.1',
        ),
      ).rejects.toMatchObject({
        code: 'AUTH_LOGIN_INVALID_CREDENTIALS',
      });
    });

    it('gagal login jika akun tidak aktif', async () => {
      const hash = await hashPassword('Password1!');

      (mockPrisma.owner.findFirst as jest.Mock).mockResolvedValue({
        id: 'uuid-123',
        email: 'test@test.com',
        fullName: 'Test User',
        passwordHash: hash,
        isActive: false,
      });

      await expect(
        authService.login(
          { email: 'test@test.com', password: 'Password1!', role: 'owner' },
          '127.0.0.1',
        ),
      ).rejects.toMatchObject({
        code: 'AUTH_ACCOUNT_INACTIVE',
      });
    });
  });
});
