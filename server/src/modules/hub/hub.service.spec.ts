import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { HubService } from './hub.service';
import { PrismaService } from '../../common/prisma/prisma.service';

const mockPrisma = {
  hubItem: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  enterpriseNeed: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  researchProject: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  application: {
    findUnique: jest.fn(),
  },
};

describe('HubService', () => {
  let service: HubService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HubService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(HubService);
  });

  describe('list', () => {
    it('should filter by published for non-admin', async () => {
      mockPrisma.hubItem.findMany.mockResolvedValue([]);
      mockPrisma.hubItem.count.mockResolvedValue(0);

      const result = await service.list({ page: 1, limit: 10 }, 'LEARNER');
      expect(result.total).toBe(0);

      const whereArg = mockPrisma.hubItem.findMany.mock.calls[0][0].where;
      expect(whereArg.reviewStatus).toBe('published');
    });

    it('should not filter by published for admin', async () => {
      mockPrisma.hubItem.findMany.mockResolvedValue([]);
      mockPrisma.hubItem.count.mockResolvedValue(0);

      await service.list({ page: 1, limit: 10 }, 'ADMIN');

      const whereArg = mockPrisma.hubItem.findMany.mock.calls[0][0].where;
      expect(whereArg.reviewStatus).toBeUndefined();
    });

    it('should normalize type and search across tags and author profile', async () => {
      mockPrisma.hubItem.findMany.mockResolvedValue([]);
      mockPrisma.hubItem.count.mockResolvedValue(0);

      await service.list(
        { page: 1, limit: 10, type: 'PROJECT', q: 'policy' },
        'LEARNER',
      );

      const whereArg = mockPrisma.hubItem.findMany.mock.calls[0][0].where;
      expect(whereArg.type).toBe('project');
      expect(whereArg.OR).toEqual(
        expect.arrayContaining([
          { title: { contains: 'policy', mode: 'insensitive' } },
          { summary: { contains: 'policy', mode: 'insensitive' } },
          {
            hubItemTags: {
              some: {
                tag: {
                  name: { contains: 'policy', mode: 'insensitive' },
                },
              },
            },
          },
          {
            author: {
              is: {
                email: { contains: 'policy', mode: 'insensitive' },
              },
            },
          },
          {
            author: {
              is: {
                profile: {
                  is: {
                    displayName: {
                      contains: 'policy',
                      mode: 'insensitive',
                    },
                  },
                },
              },
            },
          },
        ]),
      );
    });

    it('should serialize author summary in hub items', async () => {
      mockPrisma.hubItem.findMany.mockResolvedValue([
        {
          id: 'hub-1',
          title: 'Policy Radar',
          summary: 'Daily policy signals',
          type: 'policy',
          reviewStatus: 'published',
          authorUserId: 'author-1',
          createdAt: new Date('2026-03-14T10:00:00.000Z'),
          hubItemTags: [{ tag: { name: 'Policy' } }],
          likesCount: 3,
          viewsCount: 7,
          coverUrl: null,
          rejectReason: null,
          author: {
            id: 'author-1',
            email: 'author@example.com',
            role: 'LEARNER',
            profile: {
              displayName: 'Author One',
              avatarUrl: 'https://cdn.test/avatar.png',
              headline: 'Policy analyst',
              profileTags: [],
            },
          },
        },
      ]);
      mockPrisma.hubItem.count.mockResolvedValue(1);

      const result = await service.list({ page: 1, limit: 10 }, 'LEARNER');

      expect(result.items[0]).toMatchObject({
        id: 'hub-1',
        author: {
          id: 'author-1',
          name: 'Author One',
          role: 'LEARNER',
          avatar: 'https://cdn.test/avatar.png',
        },
      });
    });
  });

  describe('getById', () => {
    it('should throw NotFoundException for missing item', async () => {
      mockPrisma.hubItem.findUnique.mockResolvedValue(null);
      await expect(service.getById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should hide draft items from anonymous viewers', async () => {
      mockPrisma.hubItem.findUnique.mockResolvedValue({
        id: 'hub-draft',
        reviewStatus: 'draft',
        authorUserId: 'author-1',
        hubItemTags: [],
        author: null,
      });

      await expect(service.getById('hub-draft')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getDetail', () => {
    it('should aggregate content, author, related items, and viewer application', async () => {
      mockPrisma.hubItem.findUnique.mockResolvedValue({
        id: 'hub-1',
        title: 'Policy Sprint',
        summary: 'A practical policy workflow.',
        type: 'project',
        reviewStatus: 'published',
        authorUserId: 'author-1',
        createdAt: new Date('2026-03-14T10:00:00.000Z'),
        publishedAt: new Date('2026-03-14T10:00:00.000Z'),
        likesCount: 4,
        viewsCount: 9,
        coverUrl: null,
        rejectReason: null,
        hubItemTags: [
          {
            tagId: 'tag-1',
            tag: { name: 'Policy' },
          },
        ],
        author: {
          id: 'author-1',
          email: 'lead@example.com',
          role: 'EXPERT',
          profile: {
            displayName: 'Research Lead',
            avatarUrl: '',
            headline: 'Policy expert',
            emailVisibility: 'public',
            profileTags: [],
          },
        },
      });
      mockPrisma.hubItem.findMany.mockResolvedValue([
        {
          id: 'hub-2',
          title: 'Adjacent Paper',
          summary: 'Related paper notes.',
          type: 'paper',
          reviewStatus: 'published',
          authorUserId: 'author-2',
          createdAt: new Date('2026-03-13T10:00:00.000Z'),
          publishedAt: new Date('2026-03-13T10:00:00.000Z'),
          likesCount: 1,
          viewsCount: 3,
          coverUrl: null,
          rejectReason: null,
          hubItemTags: [
            {
              tagId: 'tag-1',
              tag: { name: 'Policy' },
            },
          ],
          author: {
            id: 'author-2',
            email: 'paper@example.com',
            role: 'LEARNER',
            profile: {
              displayName: 'Paper Curator',
              avatarUrl: '',
              headline: 'Curator',
              emailVisibility: 'public',
              profileTags: [],
            },
          },
        },
      ]);
      mockPrisma.application.findUnique.mockResolvedValue({
        id: 'app-1',
        applicantUserId: 'viewer-1',
        targetType: 'hub_project',
        targetId: 'hub-1',
        message: 'Interested in helping.',
        status: 'submitted',
        createdAt: new Date('2026-03-15T10:00:00.000Z'),
      });
      mockPrisma.hubItem.update.mockResolvedValue({ id: 'hub-1' });

      const result = await service.getDetail('hub-1', {
        id: 'viewer-1',
        role: 'LEARNER',
      });

      expect(result).toMatchObject({
        content: {
          id: 'hub-1',
          title: 'Policy Sprint',
          type: 'PROJECT',
        },
        applicationTargetType: 'PROJECT',
        detailSections: [
          {
            kind: 'SUMMARY',
            content: 'A practical policy workflow.',
          },
        ],
        author: {
          id: 'author-1',
          name: 'Research Lead',
        },
        relatedContents: [
          {
            id: 'hub-2',
            title: 'Adjacent Paper',
          },
        ],
        viewerApplication: {
          id: 'app-1',
          target: {
            id: 'hub-1',
            targetType: 'PROJECT',
          },
          owner: {
            id: 'author-1',
          },
        },
      });

      expect(mockPrisma.hubItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            reviewStatus: 'published',
            id: { not: 'hub-1' },
          }),
          take: 4,
        }),
      );
      expect(mockPrisma.application.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            applicantUserId_targetType_targetId: {
              applicantUserId: 'viewer-1',
              targetType: 'hub_project',
              targetId: 'hub-1',
            },
          },
        }),
      );
    });

    it('should aggregate enterprise need detail semantics and application target type', async () => {
      mockPrisma.hubItem.findUnique.mockResolvedValue(null);
      mockPrisma.enterpriseNeed.findUnique.mockResolvedValue({
        id: 'need-1',
        title: 'Production Evaluation Need',
        background: 'Need a shared evaluation baseline.',
        goal: 'Ship a measurable workflow.',
        deliverables: 'Benchmark rubric and weekly report.',
        requiredRoles: ['EXPERT', 'LEARNER'],
        visibility: 'public_all',
        reviewStatus: 'published',
        rejectReason: null,
        createdAt: new Date('2026-03-14T10:00:00.000Z'),
        enterpriseUserId: 'enterprise-1',
        enterprise: {
          id: 'enterprise-1',
          email: 'enterprise@example.com',
          role: 'ENTERPRISE_LEADER',
          profile: {
            displayName: 'Enterprise One',
            avatarUrl: '',
            headline: 'AI Lead',
            emailVisibility: 'public',
            profileTags: [],
          },
        },
      });
      mockPrisma.enterpriseNeed.findMany.mockResolvedValue([
        {
          id: 'need-2',
          title: 'Adjacent Need',
          background: 'Need adjacent support.',
          goal: null,
          deliverables: null,
          requiredRoles: ['EXPERT'],
          visibility: 'public_all',
          reviewStatus: 'published',
          rejectReason: null,
          createdAt: new Date('2026-03-13T10:00:00.000Z'),
          enterpriseUserId: 'enterprise-2',
          enterprise: {
            id: 'enterprise-2',
            email: 'enterprise-two@example.com',
            role: 'ENTERPRISE_LEADER',
            profile: {
              displayName: 'Enterprise Two',
              avatarUrl: '',
              headline: 'Ops Lead',
              emailVisibility: 'public',
              profileTags: [],
            },
          },
        },
      ]);
      mockPrisma.application.findUnique.mockResolvedValue({
        id: 'app-need-1',
        applicantUserId: 'viewer-1',
        targetType: 'enterprise_need',
        targetId: 'need-1',
        message: 'I can help with the evaluation pipeline.',
        status: 'submitted',
        createdAt: new Date('2026-03-15T10:00:00.000Z'),
      });

      const result = await service.getDetail('need-1', {
        id: 'viewer-1',
        role: 'LEARNER',
      });

      expect(result).toMatchObject({
        content: {
          id: 'need-1',
          contentDomain: 'ENTERPRISE_NEED',
          type: 'PROJECT',
        },
        applicationTargetType: 'ENTERPRISE_NEED',
        detailSections: [
          {
            kind: 'BACKGROUND',
            content: 'Need a shared evaluation baseline.',
          },
          {
            kind: 'GOAL',
            content: 'Ship a measurable workflow.',
          },
          {
            kind: 'DELIVERABLES',
            content: 'Benchmark rubric and weekly report.',
          },
        ],
        viewerApplication: {
          id: 'app-need-1',
          target: {
            id: 'need-1',
            targetType: 'ENTERPRISE_NEED',
            contentDomain: 'ENTERPRISE_NEED',
          },
        },
        relatedContents: [
          {
            id: 'need-2',
            contentDomain: 'ENTERPRISE_NEED',
          },
        ],
      });

      expect(mockPrisma.application.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            applicantUserId_targetType_targetId: {
              applicantUserId: 'viewer-1',
              targetType: 'enterprise_need',
              targetId: 'need-1',
            },
          },
        }),
      );
    });

    it('should aggregate research project details with needed support sections', async () => {
      mockPrisma.hubItem.findUnique.mockResolvedValue(null);
      mockPrisma.enterpriseNeed.findUnique.mockResolvedValue(null);
      mockPrisma.researchProject.findUnique.mockResolvedValue({
        id: 'project-1',
        title: 'Research Eval Sprint',
        summary: 'Exploring evaluation ops.',
        neededSupport: 'Need help on QA and prompt review.',
        tags: ['Evaluation'],
        reviewStatus: 'published',
        rejectReason: null,
        createdAt: new Date('2026-03-14T10:00:00.000Z'),
        expertUserId: 'expert-1',
        expert: {
          id: 'expert-1',
          email: 'expert@example.com',
          role: 'EXPERT',
          profile: {
            displayName: 'Expert One',
            avatarUrl: '',
            headline: 'Research Lead',
            emailVisibility: 'public',
            profileTags: [],
          },
        },
      });
      mockPrisma.researchProject.findMany.mockResolvedValue([
        {
          id: 'project-2',
          title: 'Related Research Project',
          summary: 'More research.',
          neededSupport: null,
          tags: ['Evaluation'],
          reviewStatus: 'published',
          rejectReason: null,
          createdAt: new Date('2026-03-13T10:00:00.000Z'),
          expertUserId: 'expert-2',
          expert: {
            id: 'expert-2',
            email: 'expert-two@example.com',
            role: 'EXPERT',
            profile: {
              displayName: 'Expert Two',
              avatarUrl: '',
              headline: 'Scientist',
              emailVisibility: 'public',
              profileTags: [],
            },
          },
        },
      ]);
      mockPrisma.application.findUnique.mockResolvedValue({
        id: 'app-project-1',
        applicantUserId: 'viewer-1',
        targetType: 'research_project',
        targetId: 'project-1',
        message: 'I can help.',
        status: 'submitted',
        createdAt: new Date('2026-03-15T10:00:00.000Z'),
      });

      const result = await service.getDetail('project-1', {
        id: 'viewer-1',
        role: 'LEARNER',
      });

      expect(result).toMatchObject({
        content: {
          id: 'project-1',
          contentDomain: 'RESEARCH_PROJECT',
        },
        applicationTargetType: 'RESEARCH_PROJECT',
        detailSections: [
          {
            kind: 'SUMMARY',
            content: 'Exploring evaluation ops.',
          },
          {
            kind: 'NEEDED_SUPPORT',
            content: 'Need help on QA and prompt review.',
          },
        ],
        relatedContents: [
          {
            id: 'project-2',
            contentDomain: 'RESEARCH_PROJECT',
          },
        ],
      });
    });
  });

  describe('toggleLike', () => {
    it('should increment likes count', async () => {
      mockPrisma.hubItem.findUnique.mockResolvedValue({
        id: 'h1',
        deletedAt: null,
      });
      mockPrisma.hubItem.update.mockResolvedValue({ likesCount: 5 });

      const result = await service.toggleLike('h1', 'u1');
      expect(result).toEqual({ likes: 5 });
    });

    it('should throw NotFoundException for missing item', async () => {
      mockPrisma.hubItem.findUnique.mockResolvedValue(null);
      await expect(service.toggleLike('nonexistent', 'u1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
