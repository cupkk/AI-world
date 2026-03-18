import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { MailService } from '../../common/mail/mail.service';

// ── Mocks ──────────────────────────────────────────────────
const mockPrisma: any = {
  invite: { findUnique: jest.fn(), update: jest.fn() },
  user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  profile: { create: jest.fn() },
  $transaction: jest.fn((fn: any) => fn(mockPrisma)),
};

const mockRedis = {
  client: { ping: jest.fn() },
  checkRateLimit: jest.fn().mockResolvedValue(true),
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

const mockMail = {
  send: jest.fn().mockResolvedValue(undefined),
};

const defaultConfigValues: Record<string, string> = {
  NODE_ENV: 'development',
  ENABLE_DEMO_INVITES: '',
  DEMO_INVITE_CODES: '',
  ENABLE_PUBLIC_SAMPLE_INVITES: '',
  PUBLIC_SAMPLE_INVITES: '',
};

function getConfigValue(key: string, fallback?: any) {
  return defaultConfigValues[key] ?? fallback;
}

const mockConfig = {
  get: jest.fn(getConfigValue),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfig.get.mockImplementation(getConfigValue);
    mockRedis.checkRateLimit.mockResolvedValue(true);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: ConfigService, useValue: mockConfig },
        { provide: MailService, useValue: mockMail },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  // ── verifyInviteCode ──────────────────────────────────────
  describe('verifyInviteCode', () => {
    it('should accept a valid unused DB invite', async () => {
      const fakeInvite = {
        id: 'inv1',
        code: 'REAL-CODE',
        status: 'unused',
        expiresAt: null,
        createdAt: new Date(),
        boundUserId: null,
      };
      mockPrisma.invite.findUnique.mockResolvedValue(fakeInvite);

      const result = await service.verifyInviteCode('REAL-CODE');
      expect(result.valid).toBe(true);
    });

    it('should reject an already-used invite', async () => {
      mockPrisma.invite.findUnique.mockResolvedValue({
        id: 'inv2',
        code: 'USED-CODE',
        status: 'used',
        expiresAt: null,
      });

      await expect(service.verifyInviteCode('USED-CODE')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject an expired invite', async () => {
      mockPrisma.invite.findUnique.mockResolvedValue({
        id: 'inv3',
        code: 'EXPIRED',
        status: 'unused',
        expiresAt: new Date('2020-01-01'),
      });

      await expect(service.verifyInviteCode('EXPIRED')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should fall back to dev demo code in development', async () => {
      mockConfig.get.mockImplementation((key: string, fallback?: any) => {
        const map: Record<string, string> = {
          NODE_ENV: 'development',
          ENABLE_DEMO_INVITES: 'true',
          DEMO_INVITE_CODES: 'LOCAL-DEMO-EXPERT',
          ENABLE_PUBLIC_SAMPLE_INVITES: 'false',
        };
        return map[key] ?? fallback;
      });

      mockPrisma.invite.findUnique.mockResolvedValue(null);
      const result = await service.verifyInviteCode('LOCAL-DEMO-EXPERT');
      expect(result.valid).toBe(true);
      expect(result.id).toContain('demo-');
    });

    it('should reject configured demo codes in production', async () => {
      mockConfig.get.mockImplementation((key: string, fallback?: any) => {
        const map: Record<string, string> = {
          NODE_ENV: 'production',
          ENABLE_DEMO_INVITES: 'true',
          DEMO_INVITE_CODES: 'AIWORLD-ENTERPRISE-2026',
          ENABLE_PUBLIC_SAMPLE_INVITES: 'false',
        };
        return map[key] ?? fallback;
      });

      mockPrisma.invite.findUnique.mockResolvedValue(null);

      await expect(
        service.verifyInviteCode('AIWORLD-ENTERPRISE-2026'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject unknown code when no DB match and not demo', async () => {
      mockPrisma.invite.findUnique.mockResolvedValue(null);
      await expect(service.verifyInviteCode('BAD-CODE')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject public sample invites in production when not explicitly enabled', async () => {
      mockConfig.get.mockImplementation((key: string, fallback?: any) => {
        const map: Record<string, string> = {
          NODE_ENV: 'production',
          ENABLE_PUBLIC_SAMPLE_INVITES: '',
          PUBLIC_SAMPLE_INVITES:
            'EXPERT:AIWORLD-EXPERT-2026,LEARNER:AIWORLD-LEARNER-2026',
        };
        return map[key] ?? fallback;
      });

      mockPrisma.invite.findUnique.mockResolvedValue(null);

      await expect(
        service.verifyInviteCode('AIWORLD-EXPERT-2026'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should expose public sample invites in production when enabled', async () => {
      mockConfig.get.mockImplementation((key: string, fallback?: any) => {
        const map: Record<string, string> = {
          NODE_ENV: 'production',
          ENABLE_PUBLIC_SAMPLE_INVITES: 'true',
          PUBLIC_SAMPLE_INVITES:
            'EXPERT:AIWORLD-EXPERT-2026,LEARNER:AIWORLD-LEARNER-2026',
        };
        return map[key] ?? fallback;
      });

      const result = await service.verifyInviteCode('AIWORLD-EXPERT-2026');
      expect(result.valid).toBe(true);
      expect(result.role).toBe('EXPERT');
      expect(result.id).toContain('public_sample-');
    });
  });

  describe('register', () => {
    it('should create an active expert demo account with onboarding completed in non-production demo mode', async () => {
      mockConfig.get.mockImplementation((key: string, fallback?: any) => {
        const map: Record<string, string> = {
          NODE_ENV: 'development',
          ENABLE_DEMO_INVITES: 'true',
          DEMO_INVITE_CODES: 'AIWORLD-EXPERT-2026',
        };
        return map[key] ?? fallback;
      });

      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'u-expert',
          email: 'expert@demo.aiworld.dev',
          role: 'EXPERT',
          status: 'active',
          profile: {
            displayName: 'Demo Expert',
            onboardingDone: true,
            profileTags: [],
          },
        });
      mockPrisma.user.create.mockResolvedValue({
        id: 'u-expert',
        email: 'expert@demo.aiworld.dev',
      });
      mockPrisma.profile.create.mockResolvedValue({});

      const result = await service.register({
        email: 'expert@demo.aiworld.dev',
        password: 'Demo@2026',
        displayName: 'Demo Expert',
        inviteCode: 'AIWORLD-EXPERT-2026',
      });

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: 'EXPERT',
            status: 'active',
          }),
        }),
      );
      expect(mockPrisma.profile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            onboardingDone: true,
            researchField: 'Machine Learning',
            personalPage: 'https://ai-world.asia',
          }),
        }),
      );
      expect(result.role).toBe('EXPERT');
      expect(result.onboardingDone).toBe(true);
    });

    it('should create an active account from a public sample invite in production', async () => {
      mockConfig.get.mockImplementation((key: string, fallback?: any) => {
        const map: Record<string, string> = {
          NODE_ENV: 'production',
          ENABLE_PUBLIC_SAMPLE_INVITES: 'true',
          PUBLIC_SAMPLE_INVITES:
            'ENTERPRISE_LEADER:AIWORLD-ENTERPRISE-2026',
        };
        return map[key] ?? fallback;
      });

      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'u-enterprise',
          email: 'enterprise@sample.aiworld.dev',
          role: 'ENTERPRISE_LEADER',
          status: 'active',
          profile: {
            displayName: 'Sample Enterprise',
            onboardingDone: true,
            profileTags: [],
          },
        });
      mockPrisma.user.create.mockResolvedValue({
        id: 'u-enterprise',
        email: 'enterprise@sample.aiworld.dev',
      });
      mockPrisma.profile.create.mockResolvedValue({});

      const result = await service.register({
        email: 'enterprise@sample.aiworld.dev',
        password: 'Demo@2026',
        displayName: 'Sample Enterprise',
        inviteCode: 'AIWORLD-ENTERPRISE-2026',
      });

      expect(mockPrisma.invite.update).not.toHaveBeenCalled();
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: 'ENTERPRISE_LEADER',
            status: 'active',
          }),
        }),
      );
      expect(result.role).toBe('ENTERPRISE_LEADER');
      expect(result.onboardingDone).toBe(true);
    });
  });

  // ── login ─────────────────────────────────────────────────
  describe('login', () => {
    const loginDto = { email: 'test@example.com', password: 'pass123' };
    const hashedPw = bcrypt.hashSync('pass123', 10);

    it('should succeed with correct credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'test@example.com',
        passwordHash: hashedPw,
        role: 'LEARNER',
        status: 'active',
        deletedAt: null,
        profile: { profileTags: [] },
      });
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.login(loginDto, '127.0.0.1');
      expect(result.user.id).toBe('u1');
    });

    it('should reject wrong password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'test@example.com',
        passwordHash: bcrypt.hashSync('different', 10),
        role: 'LEARNER',
        status: 'active',
        deletedAt: null,
        profile: { profileTags: [] },
      });

      await expect(service.login(loginDto, '127.0.0.1')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject suspended user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'test@example.com',
        passwordHash: hashedPw,
        role: 'LEARNER',
        status: 'suspended',
        deletedAt: null,
        profile: { profileTags: [] },
      });

      await expect(service.login(loginDto, '127.0.0.1')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject when rate limited', async () => {
      mockRedis.checkRateLimit.mockResolvedValue(false);

      await expect(service.login(loginDto, '127.0.0.1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject non-existent user', async () => {
      mockRedis.checkRateLimit.mockResolvedValue(true);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto, '127.0.0.1')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ── requestPasswordReset ─────────────────────────────────
  describe('requestPasswordReset', () => {
    it('should send email and store token for existing user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'user@example.com',
        deletedAt: null,
      });

      const result = await service.requestPasswordReset('user@example.com');
      expect(result.success).toBe(true);
      expect(mockRedis.set).toHaveBeenCalled();
      expect(mockMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: expect.stringContaining('Password Reset'),
        }),
      );
    });

    it('should return success even for non-existent email (no enumeration)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.requestPasswordReset('nobody@example.com');
      expect(result.success).toBe(true);
      expect(mockMail.send).not.toHaveBeenCalled();
    });
  });

  // ── resetPassword ─────────────────────────────────────────
  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      mockRedis.get.mockResolvedValue('u1');
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.resetPassword('valid-token', 'NewPass1!');
      expect(result.success).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u1' },
          data: { passwordHash: expect.any(String) },
        }),
      );
      expect(mockRedis.del).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid/expired token', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(
        service.resetPassword('expired-token', 'NewPass1!'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
