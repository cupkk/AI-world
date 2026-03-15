import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ExpertService } from './expert.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ApplicationsService } from '../applications/applications.service';

const mockPrisma: any = {
  hubItem: {
    findMany: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
  researchProject: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  application: {
    findMany: jest.fn(),
  },
};

const mockApplicationsService = {
  listForTargets: jest.fn(),
};

describe('ExpertService', () => {
  let service: ExpertService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockApplicationsService.listForTargets.mockReset();
    mockApplicationsService.listForTargets.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpertService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ApplicationsService, useValue: mockApplicationsService },
      ],
    }).compile();

    service = module.get(ExpertService);
  });

  describe('getDashboard', () => {
    it('returns aggregated dashboard data for the expert workspace', async () => {
      mockPrisma.hubItem.findMany
        .mockResolvedValueOnce([
          {
            id: 'hub-1',
            title: 'Applied AI Paper',
            summary: 'Research update',
            type: 'paper',
            reviewStatus: 'published',
            authorUserId: 'expert-1',
            createdAt: new Date('2026-03-13T10:00:00.000Z'),
            likesCount: 12,
            viewsCount: 120,
            hubItemTags: [{ tag: { name: 'AI' } }],
            author: { id: 'expert-1', role: 'EXPERT' },
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'hub-2',
            title: 'Enterprise collaboration project',
            summary: 'Need an expert partner',
            type: 'project',
            reviewStatus: 'published',
            authorUserId: 'enterprise-1',
            createdAt: new Date('2026-03-13T11:00:00.000Z'),
            likesCount: 0,
            viewsCount: 8,
            hubItemTags: [{ tag: { name: 'Collaboration' } }],
            author: {
              id: 'enterprise-1',
              email: 'enterprise@example.com',
              role: 'ENTERPRISE_LEADER',
              status: 'active',
              profile: {
                displayName: 'Enterprise One',
                headline: 'Innovation Lead',
                profileTags: [],
              },
            },
          },
        ]);
      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: 'enterprise-2',
          email: 'enterprise-2@example.com',
          role: 'ENTERPRISE_LEADER',
          status: 'active',
          profile: {
            displayName: 'Enterprise Two',
            headline: 'VP Strategy',
            org: 'AI Works',
            profileTags: [],
          },
        },
      ]);
      mockApplicationsService.listForTargets.mockResolvedValue([
        {
          id: 'app-1',
          applicantId: 'learner-1',
          targetType: 'PROJECT',
          targetId: 'hub-1',
          message: 'Happy to assist',
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
            contentType: 'PAPER',
            title: 'Applied AI Paper',
            status: 'PUBLISHED',
            ownerId: 'expert-1',
          },
          targetContentTitle: 'Applied AI Paper',
        },
      ]);

      const result = await service.getDashboard('expert-1');

      expect(result).toEqual({
        stats: {
          totalContentCount: 1,
          totalViews: 120,
          totalLikes: 12,
          pendingApplicantCount: 1,
        },
        myContents: [
          expect.objectContaining({
            id: 'hub-1',
            title: 'Applied AI Paper',
            status: 'PUBLISHED',
          }),
        ],
        collaborationOpportunities: [
          expect.objectContaining({
            id: 'hub-2',
            title: 'Enterprise collaboration project',
            author: expect.objectContaining({
              id: 'enterprise-1',
              name: 'Enterprise One',
            }),
          }),
        ],
        inboundApplications: [
          expect.objectContaining({
            id: 'app-1',
            applicantId: 'learner-1',
            targetContentTitle: 'Applied AI Paper',
            applicant: expect.objectContaining({
              id: 'learner-1',
              name: 'Learner One',
            }),
          }),
        ],
        enterpriseConnections: [
          expect.objectContaining({
            id: 'enterprise-2',
            name: 'Enterprise Two',
          }),
        ],
      });
      expect(mockApplicationsService.listForTargets).toHaveBeenCalledWith([
        { targetType: 'hub_project', targetId: 'hub-1' },
      ]);
    });

    it('skips inbound application lookup when the expert has no authored content', async () => {
      mockPrisma.hubItem.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await service.getDashboard('expert-1');

      expect(result.stats).toEqual({
        totalContentCount: 0,
        totalViews: 0,
        totalLikes: 0,
        pendingApplicantCount: 0,
      });
      expect(result.inboundApplications).toEqual([]);
      expect(mockApplicationsService.listForTargets).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('creates a draft research project for the current expert', async () => {
      mockPrisma.researchProject.create.mockResolvedValue({ id: 'project-1' });

      const result = await service.create(
        {
          title: 'Applied AI research',
          summary: 'A project summary',
          neededSupport: 'Need data labeling support',
          tags: ['AI', 'NLP'],
        },
        'expert-1',
      );

      expect(result).toEqual({ id: 'project-1' });
      expect(mockPrisma.researchProject.create).toHaveBeenCalledWith({
        data: {
          title: 'Applied AI research',
          summary: 'A project summary',
          neededSupport: 'Need data labeling support',
          tags: ['AI', 'NLP'],
          expertUserId: 'expert-1',
          reviewStatus: 'draft',
        },
      });
    });
  });

  describe('submit', () => {
    it('submits a draft owned by the current expert', async () => {
      mockPrisma.researchProject.findUnique.mockResolvedValue({
        id: 'project-1',
        expertUserId: 'expert-1',
        reviewStatus: 'draft',
      });
      mockPrisma.researchProject.update.mockResolvedValue({
        id: 'project-1',
        reviewStatus: 'pending_review',
      });

      const result = await service.submit('project-1', 'expert-1');

      expect(result).toEqual({
        id: 'project-1',
        reviewStatus: 'pending_review',
      });
    });

    it('throws when the project does not exist', async () => {
      mockPrisma.researchProject.findUnique.mockResolvedValue(null);

      await expect(service.submit('missing', 'expert-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws when a different expert tries to submit the project', async () => {
      mockPrisma.researchProject.findUnique.mockResolvedValue({
        id: 'project-1',
        expertUserId: 'expert-2',
        reviewStatus: 'draft',
      });

      await expect(service.submit('project-1', 'expert-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws when the project is not in draft status', async () => {
      mockPrisma.researchProject.findUnique.mockResolvedValue({
        id: 'project-1',
        expertUserId: 'expert-1',
        reviewStatus: 'published',
      });

      await expect(service.submit('project-1', 'expert-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('listMine', () => {
    it('returns the current expert projects ordered by creation time', async () => {
      mockPrisma.researchProject.findMany.mockResolvedValue([{ id: 'project-1' }]);

      const result = await service.listMine('expert-1');

      expect(result).toEqual([{ id: 'project-1' }]);
      expect(mockPrisma.researchProject.findMany).toHaveBeenCalledWith({
        where: { expertUserId: 'expert-1', deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getApplications', () => {
    it('returns project applications for the project owner', async () => {
      mockPrisma.researchProject.findUnique.mockResolvedValue({
        id: 'project-1',
        expertUserId: 'expert-1',
      });
      mockApplicationsService.listForTargets.mockResolvedValue([{ id: 'app-1' }]);

      const result = await service.getApplications('project-1', 'expert-1');

      expect(result).toEqual([{ id: 'app-1' }]);
      expect(mockApplicationsService.listForTargets).toHaveBeenCalledWith([
        { targetType: 'research_project', targetId: 'project-1' },
      ]);
    });

    it('throws when the project is missing', async () => {
      mockPrisma.researchProject.findUnique.mockResolvedValue(null);

      await expect(service.getApplications('missing', 'expert-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws when a different user requests project applications', async () => {
      mockPrisma.researchProject.findUnique.mockResolvedValue({
        id: 'project-1',
        expertUserId: 'expert-2',
      });

      await expect(
        service.getApplications('project-1', 'expert-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
