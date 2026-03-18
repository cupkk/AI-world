import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
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
  auditLog: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  enterpriseNeed: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  researchProject: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  hubItem: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
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
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'applicant-default',
      status: 'active',
    });

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

    it('re-submits a previously rejected application instead of failing as a duplicate', async () => {
      mockPrisma.application.findUnique.mockResolvedValue({
        id: 'existing-app',
        status: 'rejected',
      });
      mockPrisma.application.update.mockResolvedValue({
        id: 'existing-app',
        status: 'submitted',
        message: 'Updated context after feedback.',
      });

      const result = await service.create(
        {
          targetType: 'enterprise_need' as any,
          targetId: 'need-1',
          message: 'Updated context after feedback.',
        },
        'user-1',
      );

      expect(result).toEqual({
        id: 'existing-app',
        status: 'submitted',
        message: 'Updated context after feedback.',
      });
      expect(mockPrisma.application.update).toHaveBeenCalledWith({
        where: { id: 'existing-app' },
        data: {
          message: 'Updated context after feedback.',
          status: 'submitted',
        },
      });
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
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

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

    it('adds governance flags for stale pending rows and unavailable targets', async () => {
      const nowSpy = jest
        .spyOn(Date, 'now')
        .mockReturnValue(new Date('2026-03-16T10:00:00.000Z').getTime());

      mockPrisma.application.findMany.mockResolvedValue([
        {
          id: 'app-4',
          applicantUserId: 'learner-4',
          targetType: 'hub_project',
          targetId: 'missing-hub-1',
          message: 'Still waiting on a response.',
          status: 'submitted',
          createdAt: new Date('2026-03-01T10:00:00.000Z'),
          applicant: {
            id: 'learner-4',
            email: 'learner4@example.com',
            role: 'LEARNER',
            profile: buildProfile('Learner Pending'),
          },
        },
      ]);
      mockPrisma.enterpriseNeed.findMany.mockResolvedValue([]);
      mockPrisma.researchProject.findMany.mockResolvedValue([]);
      mockPrisma.hubItem.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      const result = await service.listAudit();

      expect(result).toEqual([
        expect.objectContaining({
          id: 'app-4',
          ageInDays: 15,
          auditFlags: expect.arrayContaining([
            'STALE_SUBMITTED',
            'OWNER_MISSING',
            'TARGET_UNAVAILABLE',
          ]),
          target: expect.objectContaining({
            title: 'Unavailable target',
          }),
        }),
      ]);

      nowSpy.mockRestore();
    });

    it('adds linked governance flags when user or content governance already changed', async () => {
      mockPrisma.application.findMany.mockResolvedValue([
        {
          id: 'app-4b',
          applicantUserId: 'learner-4b',
          targetType: 'enterprise_need',
          targetId: 'need-4b',
          message: 'Still available to help.',
          status: 'submitted',
          createdAt: new Date('2026-03-12T10:00:00.000Z'),
          applicant: {
            id: 'learner-4b',
            email: 'learner4b@example.com',
            role: 'LEARNER',
            status: 'suspended',
            profile: buildProfile('Learner Suspended'),
          },
        },
      ]);
      mockPrisma.enterpriseNeed.findMany.mockResolvedValue([
        {
          id: 'need-4b',
          title: 'Moderated Need',
          background: 'Need an implementation partner.',
          goal: 'Recover a stalled delivery.',
          requiredRoles: ['ml'],
          reviewStatus: 'rejected',
          visibility: 'public_all',
          enterpriseUserId: 'enterprise-4b',
          createdAt: new Date('2026-03-10T10:00:00.000Z'),
          enterprise: {
            id: 'enterprise-4b',
            email: 'enterprise4b@example.com',
            role: 'ENTERPRISE_LEADER',
            status: 'suspended',
            profile: buildProfile('Owner Suspended'),
          },
        },
      ]);
      mockPrisma.researchProject.findMany.mockResolvedValue([]);
      mockPrisma.hubItem.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      const result = await service.listAudit();

      expect(result).toEqual([
        expect.objectContaining({
          id: 'app-4b',
          auditFlags: expect.arrayContaining([
            'TARGET_NOT_PUBLISHED',
            'APPLICANT_SUSPENDED',
            'OWNER_SUSPENDED',
          ]),
          target: expect.objectContaining({
            title: 'Moderated Need',
            status: 'REJECTED',
          }),
        }),
      ]);
    });

    it('surfaces the latest governance action when an audit record was already handled', async () => {
      mockPrisma.application.findMany.mockResolvedValue([
        {
          id: 'app-5',
          applicantUserId: 'learner-5',
          targetType: 'research_project',
          targetId: 'project-2',
          message: 'Can contribute to evaluation.',
          status: 'submitted',
          createdAt: new Date('2026-03-10T10:00:00.000Z'),
          applicant: {
            id: 'learner-5',
            email: 'learner5@example.com',
            role: 'LEARNER',
            profile: buildProfile('Learner Reviewed'),
          },
        },
      ]);
      mockPrisma.enterpriseNeed.findMany.mockResolvedValue([]);
      mockPrisma.researchProject.findMany.mockResolvedValue([
        {
          id: 'project-2',
          title: 'Agent Eval',
          summary: 'Run evaluation work.',
          neededSupport: 'Prompt QA',
          tags: ['agents'],
          reviewStatus: 'published',
          expertUserId: 'expert-5',
          createdAt: new Date('2026-03-08T10:00:00.000Z'),
          expert: {
            id: 'expert-5',
            email: 'expert5@example.com',
            role: 'EXPERT',
            profile: buildProfile('Owner Reviewed'),
          },
        },
      ]);
      mockPrisma.hubItem.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'audit-1',
          actorId: 'admin-1',
          action: 'application_audit_mark_reviewed',
          targetType: 'application',
          targetId: 'app-5',
          metadata: { reason: 'Checked during weekly audit.' },
          createdAt: new Date('2026-03-16T10:00:00.000Z'),
          actor: {
            id: 'admin-1',
            email: 'admin@example.com',
            role: 'ADMIN',
            profile: buildProfile('Admin One'),
          },
        },
        {
          id: 'audit-2',
          actorId: 'admin-2',
          action: 'application_audit_reject_application',
          targetType: 'application',
          targetId: 'app-5',
          metadata: { reason: 'Rejected during earlier triage.' },
          createdAt: new Date('2026-03-15T10:00:00.000Z'),
          actor: {
            id: 'admin-2',
            email: 'admin-two@example.com',
            role: 'ADMIN',
            profile: buildProfile('Admin Two'),
          },
        },
      ]);

      const result = await service.listAudit();

      expect(result).toEqual([
        expect.objectContaining({
          id: 'app-5',
          governanceState: 'REVIEWED',
          latestGovernanceAction: expect.objectContaining({
            action: 'MARK_REVIEWED',
            actorId: 'admin-1',
            actorName: 'Admin One',
            reason: 'Checked during weekly audit.',
          }),
          governanceTimeline: [
            expect.objectContaining({
              action: 'MARK_REVIEWED',
              actorId: 'admin-1',
              actorName: 'Admin One',
            }),
            expect.objectContaining({
              action: 'REJECT_APPLICATION',
              actorId: 'admin-2',
              actorName: 'Admin Two',
            }),
          ],
        }),
      ]);
    });
  });

  describe('applyAuditAction', () => {
    it('can reject stale applications and log the governance action', async () => {
      mockPrisma.application.findMany.mockResolvedValue([
        {
          id: 'app-6',
          applicantUserId: 'learner-6',
          targetType: 'hub_project',
          targetId: 'hub-6',
          message: 'Still interested.',
          status: 'submitted',
          createdAt: new Date('2026-03-01T10:00:00.000Z'),
          applicant: {
            id: 'learner-6',
            email: 'learner6@example.com',
            role: 'LEARNER',
            profile: buildProfile('Learner Six'),
          },
        },
      ]);
      mockPrisma.enterpriseNeed.findMany.mockResolvedValue([]);
      mockPrisma.researchProject.findMany.mockResolvedValue([]);
      mockPrisma.hubItem.findMany.mockResolvedValue([
        {
          id: 'hub-6',
          title: 'Synthetic Data Project',
          summary: 'Need help on evaluation.',
          type: 'project',
          reviewStatus: 'published',
          authorUserId: 'expert-6',
          createdAt: new Date('2026-02-20T10:00:00.000Z'),
          hubItemTags: [],
          likesCount: 0,
          viewsCount: 0,
          author: {
            id: 'expert-6',
            email: 'expert6@example.com',
            role: 'EXPERT',
            profile: buildProfile('Owner Six'),
          },
        },
      ]);

      const result = await service.applyAuditAction(
        ['app-6'],
        'REJECT_APPLICATION',
        'admin-1',
        'Queue expired.',
      );

      expect(result).toEqual({ updatedIds: ['app-6'] });
      expect(mockPrisma.application.update).toHaveBeenCalledWith({
        where: { id: 'app-6' },
        data: { status: 'rejected' },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: 'admin-1',
          action: 'application_audit_reject_application',
          targetType: 'application',
          targetId: 'app-6',
        }),
      });
    });

    it('can reject linked target content from the audit view and log the linkage', async () => {
      mockPrisma.application.findMany.mockResolvedValue([
        {
          id: 'app-6b',
          applicantUserId: 'expert-6b',
          targetType: 'enterprise_need',
          targetId: 'need-6b',
          message: 'Can help scope the delivery team.',
          status: 'accepted',
          createdAt: new Date('2026-03-06T10:00:00.000Z'),
          applicant: {
            id: 'expert-6b',
            email: 'expert6b@example.com',
            role: 'EXPERT',
            profile: buildProfile('Expert Six B'),
          },
        },
      ]);
      mockPrisma.enterpriseNeed.findMany.mockResolvedValue([
        {
          id: 'need-6b',
          title: 'Ops Copilot Rollout',
          background: 'Need a governance reset.',
          goal: 'Stabilize delivery.',
          requiredRoles: ['ml'],
          reviewStatus: 'pending_review',
          enterpriseUserId: 'enterprise-6b',
          createdAt: new Date('2026-03-01T10:00:00.000Z'),
          enterprise: {
            id: 'enterprise-6b',
            email: 'enterprise6b@example.com',
            role: 'ENTERPRISE_LEADER',
            profile: buildProfile('Enterprise Six B'),
          },
        },
      ]);
      mockPrisma.researchProject.findMany.mockResolvedValue([]);
      mockPrisma.hubItem.findMany.mockResolvedValue([]);

      const result = await service.applyAuditAction(
        ['app-6b'],
        'REJECT_TARGET_CONTENT',
        'admin-6b',
        'Target no longer passes governance review.',
      );

      expect(result).toEqual({ updatedIds: ['app-6b'] });
      expect(mockPrisma.enterpriseNeed.update).toHaveBeenCalledWith({
        where: { id: 'need-6b' },
        data: {
          reviewStatus: 'rejected',
          rejectReason: 'Target no longer passes governance review.',
        },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenNthCalledWith(1, {
        data: {
          actorId: 'admin-6b',
          action: 'reject',
          targetType: 'enterprise_need',
          targetId: 'need-6b',
          metadata: {
            reason: 'Target no longer passes governance review.',
            source: 'application_audit',
            sourceApplicationId: 'app-6b',
          },
        },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenNthCalledWith(2, {
        data: {
          actorId: 'admin-6b',
          action: 'application_audit_reject_target_content',
          targetType: 'application',
          targetId: 'app-6b',
          metadata: {
            reason: 'Target no longer passes governance review.',
            applicantUserId: 'expert-6b',
            ownerUserId: 'enterprise-6b',
            applicationAction: 'REJECT_TARGET_CONTENT',
            governedTargetId: 'need-6b',
            governedTargetType: 'ENTERPRISE_NEED',
          },
        },
      });
    });

    it('can suspend the applicant from the audit view', async () => {
      mockPrisma.application.findMany.mockResolvedValue([
        {
          id: 'app-7',
          applicantUserId: 'learner-7',
          targetType: 'enterprise_need',
          targetId: 'need-7',
          message: 'Available this month.',
          status: 'submitted',
          createdAt: new Date('2026-03-05T10:00:00.000Z'),
          applicant: {
            id: 'learner-7',
            email: 'learner7@example.com',
            role: 'LEARNER',
            profile: buildProfile('Learner Seven'),
          },
        },
      ]);
      mockPrisma.enterpriseNeed.findMany.mockResolvedValue([
        {
          id: 'need-7',
          title: 'Enterprise Need Seven',
          background: 'Ops work',
          goal: 'Deliver pipeline',
          requiredRoles: ['ml'],
          reviewStatus: 'published',
          enterpriseUserId: 'enterprise-7',
          createdAt: new Date('2026-03-01T10:00:00.000Z'),
          enterprise: {
            id: 'enterprise-7',
            email: 'enterprise7@example.com',
            role: 'ENTERPRISE_LEADER',
            profile: buildProfile('Enterprise Seven'),
          },
        },
      ]);
      mockPrisma.researchProject.findMany.mockResolvedValue([]);
      mockPrisma.hubItem.findMany.mockResolvedValue([]);

      await service.applyAuditAction(
        ['app-7'],
        'SUSPEND_APPLICANT',
        'admin-2',
      );

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'learner-7' },
        data: { status: 'suspended' },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: 'admin-2',
          action: 'application_audit_suspend_applicant',
          targetId: 'app-7',
        }),
      });
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
        applicantUserId: 'learner-1',
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

    it('rejects owner-side application updates when the target is no longer published', async () => {
      mockPrisma.application.findUnique.mockResolvedValue({
        id: 'app-1b',
        applicantUserId: 'learner-1b',
        targetType: 'enterprise_need',
        targetId: 'need-1b',
      });
      mockPrisma.enterpriseNeed.findUnique.mockResolvedValue({
        id: 'need-1b',
        enterpriseUserId: 'owner-1',
        reviewStatus: 'rejected',
      });

      await expect(
        service.updateStatus('app-1b', 'accepted' as any, 'owner-1'),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.application.update).not.toHaveBeenCalled();
    });

    it('rejects owner-side application updates when the applicant account is suspended', async () => {
      mockPrisma.application.findUnique.mockResolvedValue({
        id: 'app-1c',
        applicantUserId: 'learner-1c',
        targetType: 'enterprise_need',
        targetId: 'need-1c',
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'learner-1c',
        status: 'suspended',
      });

      await expect(
        service.updateStatus('app-1c', 'accepted' as any, 'owner-1'),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.application.update).not.toHaveBeenCalled();
    });

    it('updates status when the research project owner performs the action', async () => {
      mockPrisma.application.findUnique.mockResolvedValue({
        id: 'app-2',
        applicantUserId: 'learner-2',
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
        applicantUserId: 'learner-3',
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
        applicantUserId: 'learner-1',
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
