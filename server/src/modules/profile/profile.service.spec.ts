import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';

// ── Helpers ──────────────────────────────────────────────────
function fakeUser(overrides: Record<string, any> = {}) {
  return {
    id: 'u1',
    email: 'test@example.com',
    role: 'LEARNER',
    status: 'active',
    deletedAt: null,
    profile: {
      displayName: 'Test User',
      avatarUrl: null,
      bio: 'bio',
      org: null,
      headline: null,
      location: null,
      contactEmail: null,
      emailVisibility: 'public',
      socialLinks: null,
      phone: null,
      phonePublic: false,
      companyName: null,
      taxId: null,
      businessScope: null,
      researchField: null,
      personalPage: null,
      academicTitle: null,
      major: null,
      platformIntents: null,
      onboardingDone: false,
      whatImDoing: null,
      whatICanProvide: null,
      whatImLookingFor: null,
      aiStrategy: null,
      profileTags: [],
      ...overrides.profile,
    },
    ...overrides,
  };
}

// ── Mocks ──────────────────────────────────────────────────
const mockPrisma: any = {
  user: { findUnique: jest.fn(), update: jest.fn() },
  profile: { upsert: jest.fn(), update: jest.fn() },
  profileTag: { deleteMany: jest.fn(), create: jest.fn() },
  tag: { upsert: jest.fn() },
};

const mockStorage = {
  upload: jest.fn().mockResolvedValue({ key: 'avatars/u1/test.jpg', url: 'uploads/avatars/u1/test.jpg' }),
  delete: jest.fn().mockResolvedValue(undefined),
};

describe('ProfileService', () => {
  let service: ProfileService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StorageService, useValue: mockStorage },
      ],
    }).compile();

    service = module.get(ProfileService);
  });

  // ── getUserById ────────────────────────────────────────────
  describe('getUserById', () => {
    it('should return serialized user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(fakeUser());

      const result = await service.getUserById('u1');
      expect(result.id).toBe('u1');
      expect(result.name).toBe('Test User');
    });

    it('should throw NotFoundException for missing user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserById('missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ── getProfile ─────────────────────────────────────────────
  describe('getProfile', () => {
    it('should return profile without masking for same user', async () => {
      const user = fakeUser({
        profile: {
          contactEmail: 'test@example.com',
          emailVisibility: 'hidden',
          profileTags: [],
        },
      });
      mockPrisma.user.findUnique.mockResolvedValue(user);

      const result = await service.getProfile('u1', 'u1');
      // No masking when requester === owner
      expect(result.contactEmail).toBe('test@example.com');
    });

    it('should mask email when requester is different and visibility is hidden', async () => {
      const user = fakeUser({
        profile: {
          contactEmail: 'test@example.com',
          emailVisibility: 'hidden',
          profileTags: [],
        },
      });
      mockPrisma.user.findUnique.mockResolvedValue(user);

      const result = await service.getProfile('u1', 'other-user');
      expect(result.contactEmail).toBeUndefined();
    });

    it('should throw NotFoundException when no profile', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', profile: null });

      await expect(service.getProfile('u1')).rejects.toThrow(NotFoundException);
    });
  });

  // ── updateMyProfile ────────────────────────────────────────
  describe('updateMyProfile', () => {
    it('should update profile and return result', async () => {
      mockPrisma.profile.upsert.mockResolvedValue({});
      // getProfile is called internally after update
      mockPrisma.user.findUnique.mockResolvedValue(
        fakeUser({ profile: { displayName: 'Updated', profileTags: [] } }),
      );

      const result = await service.updateMyProfile('u1', {
        displayName: 'Updated',
      });
      expect(result.name).toBe('Updated');
      expect(mockPrisma.profile.upsert).toHaveBeenCalled();
    });

    it('should update user role when provided', async () => {
      mockPrisma.profile.upsert.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue(fakeUser());

      await service.updateMyProfile('u1', {
        displayName: 'Test',
        role: 'EXPERT',
      });

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u1' },
          data: { role: 'EXPERT' },
        }),
      );
    });

    it('should sync tags when provided', async () => {
      mockPrisma.profile.upsert.mockResolvedValue({});
      mockPrisma.tag.upsert.mockResolvedValue({ id: 'tag1', name: 'AI' });
      mockPrisma.profileTag.create.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue(fakeUser());

      await service.updateMyProfile('u1', {
        displayName: 'Test',
        tags: ['AI', 'ML'],
      });

      expect(mockPrisma.profileTag.deleteMany).toHaveBeenCalledWith({
        where: { profileUserId: 'u1' },
      });
      expect(mockPrisma.tag.upsert).toHaveBeenCalledTimes(2);
    });
  });

  // ── uploadAvatar ───────────────────────────────────────────
  describe('uploadAvatar', () => {
    it('should save avatar via StorageService and update profile', async () => {
      mockPrisma.profile.upsert.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue(
        fakeUser({ profile: { avatarUrl: '/uploads/avatars/u1/test.jpg', profileTags: [] } }),
      );

      const mockFile = {
        originalname: 'photo.jpg',
        buffer: Buffer.from('fake-img'),
        mimetype: 'image/jpeg',
        size: 8,
      } as Express.Multer.File;

      const result = await service.uploadAvatar('u1', mockFile);
      expect(result.avatar).toContain('/uploads/avatars/u1/');
      expect(mockStorage.upload).toHaveBeenCalledWith(
        'u1', 'avatar-photo.jpg', expect.any(Buffer), 'image/jpeg', 'avatars',
      );
      expect(mockPrisma.profile.upsert).toHaveBeenCalled();
    });
  });
});
