import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { PrismaService } from '../../common/prisma/prisma.service';

const mockPrisma: any = {
  application: {
    findUnique: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  enterpriseNeed: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  researchProject: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  hubItem: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
};

const buildProfile = (displayName: string) => ({
  displayName,
  avatarUrl: '',
  profileTags: [],
});

describe('ApplicationsService', () => {
  let service: ApplicationsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(ApplicationsService);
  });

  describe('create', () => {
    it('creates a submitted application when no duplicate exists', async () => {
      mockPrisma.application.findUnique.mockResolvedValue(null);
      mockPrisma.application.create.mockResolvedValue({ id: 'app-1' });

      const result = await service.create(
        {
          targetType: 'enterprise_need' as any,
          targetId: 'need-1',
          message: 'I can help with this project.',
        },
        'user-1',
      );

      expect(result).toEqual({ id: 'app-1' });
      expect(mockPrisma.application.create).toHaveBeenCalledWith({
        data: {
          targetType: 'enterprise_need',
          targetId: 'need-1',
          message: 'I can help with this project.',
          applicantUserId: 'user-1',
          status: 'submitted',
        },
      });
    });

    it('rejects duplicate applications from the same user to the same target', async () => {
      mockPrisma.application.findUnique.mockResolvedValue({ id: 'existing-app' });

      await expect(
        service.create(
          {
            targetType: 'enterprise_need' as any,
            targetId: 'need-1',
          },
          'user-1',
        ),
      ).rejects.toThrow(ConflictException);

      expect(mockPrisma.application.create).not.toHaveBeenCalled();
    });
  });

  describe('listMine / listOutbox', () => {
    it('returns enriched outbox items with target and owner summaries', async () => {
      mockPrisma.application.findMany.mockResolvedValue([
        {
          id: 'app-1',
          applicantUserId: 'learner-1',
          targetType: 'hub_project',
          targetId: 'hub-1',
          message: 'Happy to contribute.',
          status: 'submitted',
          createdAt: new Date('2026-03-15T08:00:00.000Z'),
        },
      ]);
      mockPrisma.enterpriseNeed.findMany.mockResolvedValue([]);
      mockPrisma.researchProject.findMany.mockResolvedValue([]);
      mockPrisma.hubItem.findMany.mockResolvedValue([
        {
          id: 'hub-1',
          title: 'Open Benchmark Project',
          summary: 'Build a benchmark set.',
          type: 'project',
          reviewStatus: 'published',
          authorUserId: 'expert-1',
          createdAt: new Date('2026-03-14T08:00:00.000Z'),
          hubItemTags: [],
          likesCount: 2,
          viewsCount: 18,
          author: {
            id: 'expert-1',
            email: 'expert@example.com',
            role: 'EXPERT',
            profile: buildProfile('Owner Expert'),
          },
        },
      ]);

      const result = await service.listMine('learner-1');

      expect(mockPrisma.application.findMany).toHaveBeenCalledWith({
        where: { applicantUserId: 'learner-1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual([
        expect.objectContaining({
          id: 'app-1',
          targetContentTitle: 'Open Benchmark Project',
          target: expect.objectContaining({
            id: 'hub-1',
            targetType: 'PROJECT',
            title: 'Open Benchmark Project',
            ownerId: 'expert-1',
          }),
          owner: expect.objectContaining({
            id: 'expert-1',
            name: 'Owner Expert',
          }),
        }),
      ]);
    });
  });

  describe('listForTargets', () => {
    it('groups target filters by type before querying applications', async () => {
      mockPrisma.application.findMany.mockResolvedValue([]);

      const result = await service.listForTargets([
        { targetType: 'hub_project' as any, targetId: 'hub-1' },
        { targetType: 'hub_project' as any, targetId: 'hub-2' },
        { targetType: 'research_project' as any, targetId: 'project-1' },
      ]);

      expect(result).toEqual([]);
      expect(mockPrisma.application.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            {
              targetType: 'hub_project',
              targetId: { in: ['hub-1', 'hub-2'] },
            },
            {
              targetType: 'research_project',
              targetId: { in: ['project-1'] },
            },
          ],
        },
        include: {
          applicant: {
            include: {
              profile: {
                include: {
                  profileTags: {
                    include: {
                      tag: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('listInbox', () => {
    it('returns an empty inbox when the user owns no applicable targets', async () => {
      mockPrisma.enterpriseNeed.findMany.mockResolvedValue([]);
      mockPrisma.researchProject.findMany.mockResolvedValue([]);
      mockPrisma.hubItem.findMany.mockResolvedValue([]);

      const result = await service.listInbox('expert-1');

      expect(result).toEqual([]);
      expect(mockPrisma.application.findMany).not.toHaveBeenCalled();
    });

    it('returns inbound applications with applicant and target summaries', async () => {
      mockPrisma.enterpriseNeed.findMany.mockResolvedValue([]);
      mockPrisma.researchProject.findMany
        .mockResolvedValueOnce([{ id: 'project-1' }])
        .mockResolvedValueOnce([
          {
            id: 'project-1',
            title: 'Vision Collaboration',
            summary: 'Work on a multi-modal benchmark.',
            neededSupport: 'Evaluation design',
            tags: ['vision'],
            reviewStatus: 'published',
            expertUserId: 'expert-1',
            createdAt: new Date('2026-03-10T08:00:00.000Z'),
            expert: {
              id: 'expert-1',
              email: 'expert@example.com',
              role: 'EXPERT',
              profile: buildProfile('Owner Expert'),
            },
          },
        ]);
      mockPrisma.hubItem.findMany.mockResolvedValue([]);
      mockPrisma.application.findMany.mockResolvedValue([
        {
          id: 'app-2',
          applicantUserId: 'learner-2',
          targetType: 'research_project',
          targetId: 'project-1',
          message: 'I can run experiments.',
          status: 'submitted',
          createdAt: new Date('2026-03-15T09:00:00.000Z'),
          applicant: {
            id: 'learner-2',
            email: 'learner@example.com',
            role: 'LEARNER',
            profile: buildProfile('Learner Candidate'),
          },
        },
      ]);

      const result = await service.listInbox('expert-1');

      expect(mockPrisma.application.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            {
              targetType: 'research_project',
              targetId: { in: ['project-1'] },
            },
          ],
        },
        include: {
          applicant: {
            include: {
              profile: {
                include: {
                  profileTags: {
                    include: {
                      tag: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual([
        expect.objectContaining({
          id: 'app-2',
          applicant: expect.objectContaining({
            id: 'learner-2',
            name: 'Learner Candidate',
          }),
          targetContentTitle: 'Vision Collaboration',
          target: expect.objectContaining({
            targetType: 'RESEARCH_PROJECT',
            title: 'Vision Collaboration',
            ownerId: 'expert-1',
          }),
        }),
      ]);
    });
  });

  describe('listAudit', () => {
    it('returns audit rows with applicant and owner context', async () => {
      mockPrisma.application.findMany.mockResolvedValue([
        {
          id: 'app-3',
          applicantUserId: 'learner-3',
          targetType: 'enterprise_need',
          targetId: 'need-1',
          message: 'I can help with implementation.',
          status: 'accepted',
          createdAt: new Date('2026-03-15T10:00:00.000Z'),
          applicant: {
            id: 'learner-3',
            email: 'learner3@example.com',
            role: 'LEARNER',
            profile: buildProfile('Learner Auditor'),
          },
        },
      ]);
      mockPrisma.enterpriseNeed.findMany.mockResolvedValue([
        {
          id: 'need-1',
          title: 'Enterprise Need',
          background: 'Need an evaluation pipeline.',
          goal: 'Ship a production baseline.',
          requiredRoles: ['research'],
          reviewStatus: 'published',
          visibility: 'public_all',
          enterpriseUserId: 'enterprise-1',
          createdAt: new Date('2026-03-11T08:00:00.000Z'),
          enterprise: {
            id: 'enterprise-1',
            email: 'enterprise@example.com',
            role: 'ENTERPRISE_LEADER',
            profile: buildProfile('Enterprise Owner'),
          },
        },
      ]);
      mockPrisma.researchProject.findMany.mockResolvedValue([]);
      mockPrisma.hubItem.findMany.mockResolvedValue([]);

      const result = await service.listAudit();

      expect(result).toEqual([
        expect.objectContaining({
          id: 'app-3',
          applicant: expect.objectContaining({
            id: 'learner-3',
            name: 'Learner Auditor',
          }),
          owner: expect.objectContaining({
            id: 'enterprise-1',
            name: 'Enterprise Owner',
          }),
          target: expect.objectContaining({
            targetType: 'ENTERPRISE_NEED',
            title: 'Enterprise Need',
          }),
        }),
      ]);
    });
  });

  describe('updateStatus', () => {
    it('throws when the application does not exist', async () => {
      mockPrisma.application.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStatus('missing-app', 'accepted' as any, 'owner-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates status when the enterprise need owner performs the action', async () => {
      mockPrisma.application.findUnique.mockResolvedValue({
        id: 'app-1',
        targetType: 'enterprise_need',
        targetId: 'need-1',
      });
      mockPrisma.enterpriseNeed.findUnique.mockResolvedValue({
        id: 'need-1',
        enterpriseUserId: 'owner-1',
      });
      mockPrisma.application.update.mockResolvedValue({
        id: 'app-1',
        status: 'accepted',
      });

      const result = await service.updateStatus('app-1', 'accepted' as any, 'owner-1');

      expect(result).toEqual({ id: 'app-1', status: 'accepted' });
      expect(mockPrisma.application.update).toHaveBeenCalledWith({
        where: { id: 'app-1' },
        data: { status: 'accepted' },
      });
    });

    it('updates status when the research project owner performs the action', async () => {
      mockPrisma.application.findUnique.mockResolvedValue({
        id: 'app-2',
        targetType: 'research_project',
        targetId: 'project-1',
      });
      mockPrisma.researchProject.findUnique.mockResolvedValue({
        id: 'project-1',
        expertUserId: 'expert-1',
      });
      mockPrisma.application.update.mockResolvedValue({
        id: 'app-2',
        status: 'rejected',
      });

      const result = await service.updateStatus('app-2', 'rejected' as any, 'expert-1');

      expect(result).toEqual({ id: 'app-2', status: 'rejected' });
    });

    it('updates status when the hub project author performs the action', async () => {
      mockPrisma.application.findUnique.mockResolvedValue({
        id: 'app-3',
        targetType: 'hub_project',
        targetId: 'hub-1',
      });
      mockPrisma.hubItem.findUnique.mockResolvedValue({
        id: 'hub-1',
        authorUserId: 'author-1',
      });
      mockPrisma.application.update.mockResolvedValue({
        id: 'app-3',
        status: 'accepted',
      });

      const result = await service.updateStatus('app-3', 'accepted' as any, 'author-1');

      expect(result).toEqual({ id: 'app-3', status: 'accepted' });
    });

    it('rejects status updates by non-owners', async () => {
      mockPrisma.application.findUnique.mockResolvedValue({
        id: 'app-1',
        targetType: 'enterprise_need',
        targetId: 'need-1',
      });
      mockPrisma.enterpriseNeed.findUnique.mockResolvedValue({
        id: 'need-1',
        enterpriseUserId: 'someone-else',
      });

      await expect(
        service.updateStatus('app-1', 'accepted' as any, 'owner-1'),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.application.update).not.toHaveBeenCalled();
    });
  });
});
