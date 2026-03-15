import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EnterpriseService } from './enterprise.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ApplicationsService } from '../applications/applications.service';

const mockPrisma: any = {
  enterpriseProfile: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  user: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  conversationMember: {
    count: jest.fn(),
  },
  hubItem: {
    findMany: jest.fn(),
  },
  enterpriseNeed: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  application: {
    findMany: jest.fn(),
  },
};

const mockApplicationsService = {
  listForTargets: jest.fn(),
};

describe('EnterpriseService', () => {
  let service: EnterpriseService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockApplicationsService.listForTargets.mockReset();
    mockApplicationsService.listForTargets.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnterpriseService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ApplicationsService, useValue: mockApplicationsService },
      ],
    }).compile();

    service = module.get(EnterpriseService);
  });

  describe('getMyProfile', () => {
    it('returns the persisted profile when it exists', async () => {
      mockPrisma.enterpriseProfile.findUnique.mockResolvedValue({
        userId: 'enterprise-1',
        aiStrategyText: 'Strategy',
      });

      const result = await service.getMyProfile('enterprise-1');

      expect(result).toEqual({
        userId: 'enterprise-1',
        aiStrategyText: 'Strategy',
      });
    });

    it('returns an empty profile shape when no record exists', async () => {
      mockPrisma.enterpriseProfile.findUnique.mockResolvedValue(null);

      const result = await service.getMyProfile('enterprise-1');

      expect(result).toEqual({
        userId: 'enterprise-1',
        aiStrategyText: null,
        casesText: null,
        achievementsText: null,
      });
    });
  });

  describe('getDashboard', () => {
    it('returns aggregated dashboard data for the enterprise workspace', async () => {
      mockPrisma.enterpriseProfile.findUnique.mockResolvedValue({
        userId: 'enterprise-1',
        aiStrategyText: 'Private AI copilots',
        casesText: 'Rolling out internal automation',
        achievementsText: 'Applied AI engineers',
      });
      mockPrisma.user.count.mockResolvedValue(6);
      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: 'expert-1',
          email: 'expert-1@example.com',
          role: 'EXPERT',
          status: 'active',
          profile: {
            displayName: 'Expert One',
            avatarUrl: 'https://cdn.test/expert-1.png',
            headline: 'LLM Architect',
            profileTags: [{ tag: { name: 'LLM' } }],
          },
        },
      ]);
      mockPrisma.hubItem.findMany.mockResolvedValue([
        {
          id: 'hub-1',
          title: 'Enterprise AI Assistant Rollout',
          summary: 'Deploy a secure assistant',
          type: 'project',
          reviewStatus: 'pending_review',
          authorUserId: 'enterprise-1',
          createdAt: new Date('2026-03-13T10:00:00.000Z'),
          likesCount: 2,
          viewsCount: 15,
          hubItemTags: [{ tag: { name: 'assistant' } }],
          author: { id: 'enterprise-1', role: 'ENTERPRISE_LEADER' },
        },
      ]);
      mockPrisma.conversationMember.count.mockResolvedValue(3);
      mockApplicationsService.listForTargets.mockResolvedValue([
        {
          id: 'app-1',
          applicantId: 'learner-1',
          targetType: 'PROJECT',
          targetId: 'hub-1',
          message: 'I can help with evaluation',
          status: 'SUBMITTED',
          createdAt: new Date('2026-03-13T12:00:00.000Z').toISOString(),
          applicant: {
            id: 'learner-1',
            name: 'Learner One',
            email: 'learner@example.com',
            role: 'LEARNER',
          },
          target: {
            id: 'hub-1',
            targetType: 'PROJECT',
            contentType: 'PROJECT',
            title: 'Enterprise AI Assistant Rollout',
            status: 'PENDING_REVIEW',
            ownerId: 'enterprise-1',
          },
          targetContentTitle: 'Enterprise AI Assistant Rollout',
        },
      ]);

      const result = await service.getDashboard('enterprise-1');

      expect(result).toEqual({
        profile: {
          aiStrategy: 'Private AI copilots',
          whatImDoing: 'Rolling out internal automation',
          whatImLookingFor: 'Applied AI engineers',
        },
        stats: {
          recommendedExpertsCount: 6,
          activeConversationsCount: 3,
          postedNeedsCount: 1,
          pendingInboundApplicationsCount: 1,
        },
        recommendedExperts: [
          expect.objectContaining({
            id: 'expert-1',
            name: 'Expert One',
            role: 'EXPERT',
          }),
        ],
        myContents: [
          expect.objectContaining({
            id: 'hub-1',
            title: 'Enterprise AI Assistant Rollout',
            status: 'PENDING_REVIEW',
          }),
        ],
        inboundApplications: [
          expect.objectContaining({
            id: 'app-1',
            applicantId: 'learner-1',
            status: 'SUBMITTED',
            targetContentTitle: 'Enterprise AI Assistant Rollout',
            applicant: expect.objectContaining({
              id: 'learner-1',
              name: 'Learner One',
            }),
          }),
        ],
      });
      expect(mockApplicationsService.listForTargets).toHaveBeenCalledWith([
        { targetType: 'hub_project', targetId: 'hub-1' },
      ]);
    });

    it('skips inbound application lookup when the enterprise has no authored content', async () => {
      mockPrisma.enterpriseProfile.findUnique.mockResolvedValue(null);
      mockPrisma.user.count.mockResolvedValue(0);
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.hubItem.findMany.mockResolvedValue([]);
      mockPrisma.conversationMember.count.mockResolvedValue(0);

      const result = await service.getDashboard('enterprise-1');

      expect(result.stats).toEqual({
        recommendedExpertsCount: 0,
        activeConversationsCount: 0,
        postedNeedsCount: 0,
        pendingInboundApplicationsCount: 0,
      });
      expect(result.inboundApplications).toEqual([]);
      expect(mockApplicationsService.listForTargets).not.toHaveBeenCalled();
    });
  });

  describe('createNeed', () => {
    it('creates a draft enterprise need', async () => {
      mockPrisma.enterpriseNeed.create.mockResolvedValue({ id: 'need-1' });

      const dto = {
        title: 'AI quality platform upgrade',
        background: 'Need delivery support',
        goal: 'Improve internal tooling',
        requiredRoles: ['EXPERT', 'LEARNER'],
        visibility: 'public_all',
      };

      const result = await service.createNeed(dto as any, 'enterprise-1');

      expect(result).toEqual({ id: 'need-1' });
      expect(mockPrisma.enterpriseNeed.create).toHaveBeenCalledWith({
        data: {
          ...dto,
          requiredRoles: ['EXPERT', 'LEARNER'],
          enterpriseUserId: 'enterprise-1',
          reviewStatus: 'draft',
        },
      });
    });

    it('blocks recruitment-style content', async () => {
      await expect(
        service.createNeed(
          {
            title: 'Hiring AI engineer',
            background: 'Full-time job opening',
            goal: 'Recruit a team member',
          } as any,
          'enterprise-1',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.enterpriseNeed.create).not.toHaveBeenCalled();
    });
  });

  describe('submitNeed', () => {
    it('submits a draft owned by the current user', async () => {
      mockPrisma.enterpriseNeed.findUnique.mockResolvedValue({
        id: 'need-1',
        enterpriseUserId: 'enterprise-1',
        reviewStatus: 'draft',
      });
      mockPrisma.enterpriseNeed.update.mockResolvedValue({
        id: 'need-1',
        reviewStatus: 'pending_review',
      });

      const result = await service.submitNeed('need-1', 'enterprise-1');

      expect(result.reviewStatus).toBe('pending_review');
      expect(mockPrisma.enterpriseNeed.update).toHaveBeenCalledWith({
        where: { id: 'need-1' },
        data: { reviewStatus: 'pending_review' },
      });
    });

    it('throws when the need does not exist', async () => {
      mockPrisma.enterpriseNeed.findUnique.mockResolvedValue(null);

      await expect(service.submitNeed('missing', 'enterprise-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws when the user is not the owner', async () => {
      mockPrisma.enterpriseNeed.findUnique.mockResolvedValue({
        id: 'need-1',
        enterpriseUserId: 'enterprise-2',
        reviewStatus: 'draft',
      });

      await expect(service.submitNeed('need-1', 'enterprise-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws when the need is not a draft', async () => {
      mockPrisma.enterpriseNeed.findUnique.mockResolvedValue({
        id: 'need-1',
        enterpriseUserId: 'enterprise-1',
        reviewStatus: 'published',
      });

      await expect(service.submitNeed('need-1', 'enterprise-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('listNeeds', () => {
    it('applies enterprise visibility filtering at query level', async () => {
      mockPrisma.enterpriseNeed.findMany.mockResolvedValue([{ id: 'need-1' }]);
      mockPrisma.enterpriseNeed.count.mockResolvedValue(1);

      const result = await service.listNeeds(
        { q: 'strategy', page: 2, limit: 5 } as any,
        'ENTERPRISE_LEADER',
      );

      expect(result).toEqual({
        items: [{ id: 'need-1' }],
        total: 1,
        page: 2,
        limit: 5,
      });
      expect(mockPrisma.enterpriseNeed.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
            reviewStatus: 'published',
            visibility: 'public_all',
            OR: [
              { title: { contains: 'strategy', mode: 'insensitive' } },
              { background: { contains: 'strategy', mode: 'insensitive' } },
            ],
          }),
          skip: 5,
          take: 5,
        }),
      );
    });

    it('does not apply enterprise-only visibility filtering for experts', async () => {
      mockPrisma.enterpriseNeed.findMany.mockResolvedValue([]);
      mockPrisma.enterpriseNeed.count.mockResolvedValue(0);

      await service.listNeeds({ page: 1, limit: 20 } as any, 'EXPERT');

      const query = mockPrisma.enterpriseNeed.findMany.mock.calls[0][0];
      expect(query.where.visibility).toBeUndefined();
    });
  });

  describe('getNeed', () => {
    it('returns a published need when visible to the current role', async () => {
      mockPrisma.enterpriseNeed.findUnique.mockResolvedValue({
        id: 'need-1',
        visibility: 'public_all',
      });

      const result = await service.getNeed('need-1', 'ENTERPRISE_LEADER');
      expect(result.id).toBe('need-1');
    });

    it('throws when an enterprise user accesses restricted visibility', async () => {
      mockPrisma.enterpriseNeed.findUnique.mockResolvedValue({
        id: 'need-1',
        visibility: 'experts_and_learners',
      });

      await expect(service.getNeed('need-1', 'ENTERPRISE_LEADER')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getNeedApplications', () => {
    it('returns applications for the owner', async () => {
      mockPrisma.enterpriseNeed.findUnique.mockResolvedValue({
        id: 'need-1',
        enterpriseUserId: 'enterprise-1',
      });
      mockApplicationsService.listForTargets.mockResolvedValue([{ id: 'app-1' }]);

      const result = await service.getNeedApplications('need-1', 'enterprise-1');

      expect(result).toEqual([{ id: 'app-1' }]);
      expect(mockApplicationsService.listForTargets).toHaveBeenCalledWith([
        { targetType: 'enterprise_need', targetId: 'need-1' },
      ]);
    });

    it('throws when a different user requests the applications', async () => {
      mockPrisma.enterpriseNeed.findUnique.mockResolvedValue({
        id: 'need-1',
        enterpriseUserId: 'enterprise-2',
      });

      await expect(
        service.getNeedApplications('need-1', 'enterprise-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
