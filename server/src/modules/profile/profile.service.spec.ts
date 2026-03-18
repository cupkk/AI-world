import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
  hubItem: {
    findMany: jest.fn(),
  },
  enterpriseNeed: {
    findMany: jest.fn(),
  },
  researchProject: {
    findMany: jest.fn(),
  },
  profile: {
    upsert: jest.fn(),
  },
  profileTag: {
    deleteMany: jest.fn(),
    create: jest.fn(),
  },
  tag: {
    upsert: jest.fn(),
  },
};

const mockStorage = {
  upload: jest.fn(),
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

  describe('getProfilePage', () => {
    it('should return the public profile, published contents, and summary stats', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'owner@example.com',
        role: 'EXPERT',
        profile: {
          displayName: 'Research Lead',
          avatarUrl: '',
          headline: 'Policy expert',
          emailVisibility: 'public',
          whatImDoing: 'Building evaluation workflows.',
          whatICanProvide: 'Research design and reviews.',
          whatImLookingFor: 'Implementation partners.',
          profileTags: [
            {
              tag: { name: 'Policy' },
            },
          ],
        },
      });
      mockPrisma.hubItem.findMany.mockResolvedValue([
        {
          id: 'hub-1',
          title: 'Policy Sprint',
          summary: 'A practical policy workflow.',
          type: 'project',
          reviewStatus: 'published',
          authorUserId: 'user-1',
          createdAt: new Date('2026-03-14T10:00:00.000Z'),
          publishedAt: new Date('2026-03-14T10:00:00.000Z'),
          likesCount: 4,
          viewsCount: 9,
          coverUrl: null,
          hubItemTags: [{ tag: { name: 'Policy' } }],
        },
        {
          id: 'hub-2',
          title: 'Tool Notes',
          summary: 'A useful tooling digest.',
          type: 'tool',
          reviewStatus: 'published',
          authorUserId: 'user-1',
          createdAt: new Date('2026-03-13T10:00:00.000Z'),
          publishedAt: new Date('2026-03-13T10:00:00.000Z'),
          likesCount: 2,
          viewsCount: 5,
          coverUrl: null,
          hubItemTags: [{ tag: { name: 'Tooling' } }],
        },
      ]);
      mockPrisma.enterpriseNeed.findMany.mockResolvedValue([]);
      mockPrisma.researchProject.findMany.mockResolvedValue([
        {
          id: 'research-1',
          title: 'Evaluation Research Track',
          summary: 'A deeper evaluation research collaboration.',
          tags: ['Evaluation', 'Research'],
          reviewStatus: 'published',
          expertUserId: 'user-1',
          createdAt: new Date('2026-03-15T10:00:00.000Z'),
        },
      ]);

      const result = await service.getProfilePage('user-1', 'viewer-1');

      expect(result).toMatchObject({
        user: {
          id: 'user-1',
          name: 'Research Lead',
        },
        summary: {
          publishedContentCount: 3,
          totalViews: 14,
          totalLikes: 6,
          featuredTypes: ['PROJECT', 'TOOL'],
          domainCounts: {
            hubItems: 2,
            enterpriseNeeds: 0,
            researchProjects: 1,
          },
        },
      });
      expect(result.contents).toHaveLength(3);
      expect(result.contents[0]).toMatchObject({
        id: 'research-1',
        title: 'Evaluation Research Track',
        contentDomain: 'RESEARCH_PROJECT',
      });
      expect(result.contents[1]).toMatchObject({
        id: 'hub-1',
        title: 'Policy Sprint',
      });
    });

    it('should throw when the target profile does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.enterpriseNeed.findMany.mockResolvedValue([]);
      mockPrisma.researchProject.findMany.mockResolvedValue([]);

      await expect(service.getProfilePage('missing-user')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
