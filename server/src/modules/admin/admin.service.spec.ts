import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { PrismaService } from '../../common/prisma/prisma.service';

const mockPrisma: any = {
  hubItem: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
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
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  invite: {
    create: jest.fn(),
  },
  application: {
    findMany: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  report: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
};

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(AdminService);
  });

  describe('detectReviewType', () => {
    it('detects hub items before other entity types', async () => {
      mockPrisma.hubItem.findUnique.mockResolvedValue({ id: 'id-1' });

      const result = await service.detectReviewType('id-1');

      expect(result).toBe('hub_item');
      expect(mockPrisma.enterpriseNeed.findUnique).not.toHaveBeenCalled();
    });

    it('throws when the entity does not exist', async () => {
      mockPrisma.hubItem.findUnique.mockResolvedValue(null);
      mockPrisma.enterpriseNeed.findUnique.mockResolvedValue(null);
      mockPrisma.researchProject.findUnique.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.detectReviewType('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getReviewQueue', () => {
    it('returns pending user identity reviews', async () => {
      mockPrisma.hubItem.findMany.mockResolvedValue([]);
      mockPrisma.enterpriseNeed.findMany.mockResolvedValue([]);
      mockPrisma.researchProject.findMany.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: 'user-1',
          email: 'learner@example.com',
          createdAt: new Date('2026-03-13T00:00:00Z'),
          profile: {
            displayName: 'Learner One',
          },
        },
      ]);

      const result = await service.getReviewQueue('user_identity');

      expect(result).toEqual([
        expect.objectContaining({
          id: 'user-1',
          title: 'Learner One',
          type: 'USER_IDENTITY',
          status: 'PENDING_REVIEW',
        }),
      ]);
    });
  });

  describe('getDashboard', () => {
    it('aggregates pending reviews and reports with attached user summaries', async () => {
      mockPrisma.hubItem.findMany.mockResolvedValue([
        {
          id: 'hub-1',
          title: 'Pending Hub Item',
          summary: 'Needs admin approval',
          type: 'paper',
          reviewStatus: 'pending_review',
          authorUserId: 'author-1',
          createdAt: new Date('2026-03-13T00:00:00Z'),
          hubItemTags: [{ tag: { name: 'AI' } }],
          likesCount: 3,
          viewsCount: 8,
          author: {
            id: 'author-1',
            email: 'author@example.com',
            role: 'learner',
            profile: {
              displayName: 'Author One',
              avatarUrl: '',
              emailVisibility: 'hidden',
              profileTags: [],
            },
          },
        },
      ]);
      mockPrisma.enterpriseNeed.findMany.mockResolvedValue([]);
      mockPrisma.researchProject.findMany.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.report.findMany.mockResolvedValue([
        {
          id: 'report-1',
          targetType: 'user',
          targetId: 'target-1',
          reason: 'Spam',
          status: 'pending',
          reporterId: 'reporter-1',
          createdAt: new Date('2026-03-13T01:00:00Z'),
          reporter: {
            id: 'reporter-1',
            email: 'reporter@example.com',
            role: 'expert',
            profile: {
              displayName: 'Reporter One',
              avatarUrl: '',
              emailVisibility: 'hidden',
              profileTags: [],
            },
          },
        },
      ]);

      const result = await service.getDashboard();

      expect(result.stats).toEqual({
        pendingReviewCount: 1,
        pendingReportCount: 1,
      });
      expect(result.reviewItems).toEqual([
        expect.objectContaining({
          id: 'hub-1',
          title: 'Pending Hub Item',
          author: expect.objectContaining({
            id: 'author-1',
            name: 'Author One',
            role: 'LEARNER',
          }),
        }),
      ]);
      expect(result.reports).toEqual([
        expect.objectContaining({
          id: 'report-1',
          reporterId: 'reporter-1',
          reporterName: 'Reporter One',
          reporter: expect.objectContaining({
            id: 'reporter-1',
            name: 'Reporter One',
            role: 'EXPERT',
          }),
        }),
      ]);
    });
  });

  describe('listHubItems', () => {
    it('returns admin hub items with attached author summaries and status stats', async () => {
      mockPrisma.hubItem.findMany.mockResolvedValue([
        {
          id: 'hub-published',
          title: 'Published Hub Item',
          summary: 'Already live',
          type: 'paper',
          reviewStatus: 'published',
          authorUserId: 'author-1',
          createdAt: new Date('2026-03-13T00:00:00Z'),
          hubItemTags: [{ tag: { name: 'AI' } }],
          likesCount: 3,
          viewsCount: 8,
          author: {
            id: 'author-1',
            email: 'author@example.com',
            role: 'learner',
            profile: {
              displayName: 'Author One',
              avatarUrl: '',
              emailVisibility: 'hidden',
              profileTags: [],
            },
          },
        },
        {
          id: 'hub-draft',
          title: 'Draft Hub Item',
          summary: 'Still editing',
          type: 'project',
          reviewStatus: 'draft',
          authorUserId: 'author-2',
          createdAt: new Date('2026-03-13T01:00:00Z'),
          hubItemTags: [],
          likesCount: 0,
          viewsCount: 1,
          author: {
            id: 'author-2',
            email: 'expert@example.com',
            role: 'expert',
            profile: {
              displayName: 'Expert Two',
              avatarUrl: '',
              emailVisibility: 'hidden',
              profileTags: [],
            },
          },
        },
        {
          id: 'hub-pending',
          title: 'Pending Hub Item',
          summary: 'Needs approval',
          type: 'tool',
          reviewStatus: 'pending_review',
          authorUserId: 'author-3',
          createdAt: new Date('2026-03-13T02:00:00Z'),
          hubItemTags: [],
          likesCount: 1,
          viewsCount: 4,
          author: {
            id: 'author-3',
            email: 'enterprise@example.com',
            role: 'enterprise_leader',
            profile: {
              displayName: 'Enterprise Three',
              avatarUrl: '',
              emailVisibility: 'hidden',
              profileTags: [],
            },
          },
        },
        {
          id: 'hub-rejected',
          title: 'Rejected Hub Item',
          summary: 'Needs revision',
          type: 'contest',
          reviewStatus: 'rejected',
          rejectReason: 'Needs more detail',
          authorUserId: 'author-4',
          createdAt: new Date('2026-03-13T03:00:00Z'),
          hubItemTags: [],
          likesCount: 0,
          viewsCount: 0,
          author: {
            id: 'author-4',
            email: 'reviewer@example.com',
            role: 'learner',
            profile: {
              displayName: 'Learner Four',
              avatarUrl: '',
              emailVisibility: 'hidden',
              profileTags: [],
            },
          },
        },
      ]);

      const result = await service.listHubItems();

      expect(result.stats).toEqual({
        publishedCount: 1,
        pendingReviewCount: 1,
        draftCount: 1,
        rejectedCount: 1,
      });
      expect(result.items).toEqual([
        expect.objectContaining({
          id: 'hub-published',
          status: 'PUBLISHED',
          author: expect.objectContaining({
            id: 'author-1',
            name: 'Author One',
            role: 'LEARNER',
          }),
        }),
        expect.objectContaining({
          id: 'hub-draft',
          status: 'DRAFT',
          author: expect.objectContaining({
            id: 'author-2',
            name: 'Expert Two',
            role: 'EXPERT',
          }),
        }),
        expect.objectContaining({
          id: 'hub-pending',
          status: 'PENDING_REVIEW',
        }),
        expect.objectContaining({
          id: 'hub-rejected',
          status: 'REJECTED',
          rejectReason: 'Needs more detail',
        }),
      ]);
    });

    it('applies search, type, and status filters while keeping stats scoped to the non-status query', async () => {
      mockPrisma.hubItem.findMany
        .mockResolvedValueOnce([
          { reviewStatus: 'published' },
          { reviewStatus: 'draft' },
        ])
        .mockResolvedValueOnce([
          {
            id: 'hub-paper',
            title: 'AI Policy Brief',
            summary: 'Filtered result',
            type: 'paper',
            reviewStatus: 'published',
            authorUserId: 'author-1',
            createdAt: new Date('2026-03-13T00:00:00Z'),
            hubItemTags: [{ tag: { name: 'Policy' } }],
            likesCount: 1,
            viewsCount: 2,
            author: {
              id: 'author-1',
              email: 'author@example.com',
              role: 'learner',
              profile: {
                displayName: 'Author One',
                avatarUrl: '',
                emailVisibility: 'hidden',
                profileTags: [],
              },
            },
          },
        ]);

      const result = await service.listHubItems({
        q: 'policy',
        type: 'paper',
        status: 'PUBLISHED',
      });

      expect(mockPrisma.hubItem.findMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
            type: 'paper',
            OR: expect.any(Array),
          }),
          select: { reviewStatus: true },
        }),
      );
      expect(mockPrisma.hubItem.findMany).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
            type: 'paper',
            reviewStatus: 'published',
            OR: expect.any(Array),
          }),
        }),
      );
      expect(result.stats).toEqual({
        publishedCount: 1,
        pendingReviewCount: 0,
        draftCount: 1,
        rejectedCount: 0,
      });
      expect(result.items).toEqual([
        expect.objectContaining({
          id: 'hub-paper',
          status: 'PUBLISHED',
        }),
      ]);
    });
  });

  describe('listAuditLogs', () => {
    it('returns enriched application governance audit logs', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'log-1',
          action: 'application_audit_suspend_owner',
          targetType: 'application',
          targetId: 'app-1',
          actorId: 'admin-1',
          createdAt: new Date('2026-03-17T10:00:00Z'),
          metadata: { reason: 'Owner account is suspended.' },
          actor: {
            id: 'admin-1',
            email: 'admin@example.com',
            role: 'admin',
            profile: {
              displayName: 'Admin One',
              avatarUrl: '',
              emailVisibility: 'hidden',
              profileTags: [],
            },
          },
        },
      ]);
      mockPrisma.application.findMany.mockResolvedValue([
        {
          id: 'app-1',
          targetType: 'research_project',
          targetId: 'project-1',
          status: 'submitted',
          applicantUserId: 'learner-1',
          applicant: {
            id: 'learner-1',
            email: 'learner@example.com',
            role: 'learner',
            profile: {
              displayName: 'Learner One',
              avatarUrl: '',
              emailVisibility: 'hidden',
              profileTags: [],
            },
          },
        },
      ]);
      mockPrisma.enterpriseNeed.findMany.mockResolvedValue([]);
      mockPrisma.researchProject.findMany.mockResolvedValue([
        {
          id: 'project-1',
          title: 'Research Sprint',
          summary: 'A focused sprint',
          neededSupport: 'Evaluation support',
          tags: ['AI'],
          reviewStatus: 'published',
          expertUserId: 'expert-1',
          createdAt: new Date('2026-03-16T00:00:00Z'),
          expert: {
            id: 'expert-1',
            email: 'expert@example.com',
            role: 'expert',
            profile: {
              displayName: 'Expert One',
              avatarUrl: '',
              emailVisibility: 'hidden',
              profileTags: [],
            },
          },
        },
      ]);
      mockPrisma.hubItem.findMany.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.report.findMany.mockResolvedValue([]);

      const result = await service.listAuditLogs();

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {},
        include: {
          actor: {
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
        take: 100,
      });
      expect(result).toEqual([
        expect.objectContaining({
          id: 'log-1',
          action: 'application_audit_suspend_owner',
          targetType: 'APPLICATION',
          actor: expect.objectContaining({
            id: 'admin-1',
            name: 'Admin One',
          }),
          reason: 'Owner account is suspended.',
          target: expect.objectContaining({
            id: 'project-1',
            targetType: 'RESEARCH_PROJECT',
            title: 'Research Sprint',
          }),
          application: expect.objectContaining({
            id: 'app-1',
            status: 'SUBMITTED',
            applicant: expect.objectContaining({
              id: 'learner-1',
              name: 'Learner One',
            }),
            owner: expect.objectContaining({
              id: 'expert-1',
              name: 'Expert One',
            }),
          }),
        }),
      ]);
    });

    it('applies action, target type, and query filters', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'log-user-1',
          action: 'update_user_status',
          targetType: 'user',
          targetId: 'user-2',
          actorId: 'admin-1',
          createdAt: new Date('2026-03-17T11:00:00Z'),
          metadata: { status: 'suspended' },
          actor: {
            id: 'admin-1',
            email: 'admin@example.com',
            role: 'admin',
            profile: {
              displayName: 'Admin One',
              avatarUrl: '',
              emailVisibility: 'hidden',
              profileTags: [],
            },
          },
        },
      ]);
      mockPrisma.application.findMany.mockResolvedValue([]);
      mockPrisma.hubItem.findMany.mockResolvedValue([]);
      mockPrisma.enterpriseNeed.findMany.mockResolvedValue([]);
      mockPrisma.researchProject.findMany.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: 'user-2',
          email: 'suspended@example.com',
          role: 'learner',
          status: 'suspended',
          profile: {
            displayName: 'Suspended User',
            avatarUrl: '',
            emailVisibility: 'hidden',
            profileTags: [],
          },
        },
      ]);
      mockPrisma.report.findMany.mockResolvedValue([]);

      const result = await service.listAuditLogs({
        action: 'update_user_status',
        targetType: 'USER',
        q: 'suspended',
        limit: 10,
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            action: 'update_user_status',
            targetType: 'user',
          },
          take: 200,
        }),
      );
      expect(result).toEqual([
        expect.objectContaining({
          id: 'log-user-1',
          target: expect.objectContaining({
            id: 'user-2',
            targetType: 'USER',
            title: 'Suspended User',
            status: 'SUSPENDED',
          }),
        }),
      ]);
    });
  });

  describe('approve', () => {
    it('approves a hub item and writes an audit log', async () => {
      mockPrisma.hubItem.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await service.approve('hub-1', 'hub_item', 'admin-1');

      expect(result).toEqual({ success: true });
      expect(mockPrisma.hubItem.update).toHaveBeenCalledWith({
        where: { id: 'hub-1' },
        data: { reviewStatus: 'published', publishedAt: expect.any(Date) },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          actorId: 'admin-1',
          action: 'approve',
          targetType: 'hub_item',
          targetId: 'hub-1',
        },
      });
    });

    it('throws for an unknown review type', async () => {
      await expect(
        service.approve('id-1', 'unknown_type', 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('reject', () => {
    it('rejects a user identity review and records the reason', async () => {
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await service.reject(
        'user-1',
        'user_identity',
        'identity mismatch',
        'admin-1',
      );

      expect(result).toEqual({ success: true });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { status: 'suspended' },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          actorId: 'admin-1',
          action: 'reject',
          targetType: 'user_identity',
          targetId: 'user-1',
          metadata: { reason: 'identity mismatch' },
        },
      });
    });
  });

  describe('generateInviteCodes', () => {
    it('creates the requested number of invite codes and logs the action', async () => {
      jest
        .spyOn(service as any, 'generateCode')
        .mockReturnValueOnce('CODE0001')
        .mockReturnValueOnce('CODE0002');
      mockPrisma.invite.create.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await service.generateInviteCodes(2, 'admin-1', 7);

      expect(result.codes).toEqual(['CODE0001', 'CODE0002']);
      expect(mockPrisma.invite.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          actorId: 'admin-1',
          action: 'generate_invite_codes',
          targetType: 'invite',
          metadata: {
            count: 2,
            codes: ['CODE0001', 'CODE0002'],
          },
        },
      });
    });
  });

  describe('updateUserStatus', () => {
    it('updates the user status and records an audit log', async () => {
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await service.updateUserStatus(
        'user-1',
        'suspended',
        'admin-1',
      );

      expect(result).toEqual({ success: true });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { status: 'suspended' },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          actorId: 'admin-1',
          action: 'update_user_status',
          targetType: 'user',
          targetId: 'user-1',
          metadata: { status: 'suspended' },
        },
      });
    });
  });

  describe('updateReportStatus', () => {
    it('updates a report and writes an audit record', async () => {
      mockPrisma.report.update.mockResolvedValue({ id: 'report-1', status: 'resolved' });
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await service.updateReportStatus(
        'report-1',
        'resolved',
        'admin-1',
        'handled',
      );

      expect(result).toEqual({ id: 'report-1', status: 'resolved' });
      expect(mockPrisma.report.update).toHaveBeenCalledWith({
        where: { id: 'report-1' },
        data: { status: 'resolved' },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          actorId: 'admin-1',
          action: 'report_resolved',
          targetType: 'report',
          targetId: 'report-1',
          metadata: { notes: 'handled' },
        },
      });
    });
  });

  describe('listPendingReports', () => {
    it('serializes report rows for admin dashboard consumers', async () => {
      mockPrisma.report.findMany.mockResolvedValue([
        {
          id: 'report-1',
          targetType: 'user',
          targetId: 'target-1',
          reason: 'Spam',
          status: 'pending',
          reporterId: 'reporter-1',
          createdAt: new Date('2026-03-13T02:00:00Z'),
          reporter: {
            id: 'reporter-1',
            email: 'reporter@example.com',
            role: 'enterprise_leader',
            profile: {
              displayName: 'Reporter',
              avatarUrl: '',
              emailVisibility: 'hidden',
              profileTags: [],
            },
          },
        },
      ]);

      const result = await service.listPendingReports();

      expect(result).toEqual([
        expect.objectContaining({
          id: 'report-1',
          status: 'PENDING',
          reporterName: 'Reporter',
          reporter: expect.objectContaining({
            id: 'reporter-1',
            role: 'ENTERPRISE_LEADER',
          }),
        }),
      ]);
    });
  });

  describe('updateHubItem', () => {
    it('updates title and description and records an audit log', async () => {
      mockPrisma.hubItem.findFirst.mockResolvedValue({
        id: 'hub-1',
        publishedAt: new Date('2026-03-13T00:00:00Z'),
      });
      mockPrisma.hubItem.update.mockResolvedValue({
        id: 'hub-1',
        title: 'Updated title',
        summary: 'Updated summary',
        type: 'paper',
        reviewStatus: 'published',
        authorUserId: 'author-1',
        createdAt: new Date('2026-03-13T00:00:00Z'),
        hubItemTags: [],
        likesCount: 0,
        viewsCount: 0,
        author: {
          id: 'author-1',
          email: 'author@example.com',
          role: 'learner',
          profile: {
            displayName: 'Author One',
            avatarUrl: '',
            emailVisibility: 'hidden',
            profileTags: [],
          },
        },
      });
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await service.updateHubItem(
        'hub-1',
        {
          title: 'Updated title',
          description: 'Updated summary',
        },
        'admin-1',
      );

      expect(mockPrisma.hubItem.findFirst).toHaveBeenCalledWith({
        where: { id: 'hub-1', deletedAt: null },
      });
      expect(mockPrisma.hubItem.update).toHaveBeenCalledWith({
        where: { id: 'hub-1' },
        data: {
          title: 'Updated title',
          summary: 'Updated summary',
        },
        include: {
          hubItemTags: {
            include: {
              tag: true,
            },
          },
          author: {
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
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          actorId: 'admin-1',
          action: 'update_hub_item',
          targetType: 'hub_item',
          targetId: 'hub-1',
          metadata: {
            title: 'Updated title',
            description: 'Updated summary',
            status: null,
          },
        },
      });
      expect(result).toEqual(
        expect.objectContaining({
          id: 'hub-1',
          title: 'Updated title',
          description: 'Updated summary',
          author: expect.objectContaining({
            id: 'author-1',
            name: 'Author One',
          }),
        }),
      );
    });

    it('moves published content back to draft', async () => {
      mockPrisma.hubItem.findFirst.mockResolvedValue({
        id: 'hub-2',
        publishedAt: new Date('2026-03-13T00:00:00Z'),
      });
      mockPrisma.hubItem.update.mockResolvedValue({
        id: 'hub-2',
        title: 'Published item',
        summary: 'Now hidden',
        type: 'paper',
        reviewStatus: 'draft',
        authorUserId: 'author-1',
        createdAt: new Date('2026-03-13T00:00:00Z'),
        hubItemTags: [],
        likesCount: 0,
        viewsCount: 0,
        author: {
          id: 'author-1',
          email: 'author@example.com',
          role: 'learner',
          profile: {
            displayName: 'Author One',
            avatarUrl: '',
            emailVisibility: 'hidden',
            profileTags: [],
          },
        },
      });
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await service.updateHubItem(
        'hub-2',
        { status: 'draft' },
        'admin-1',
      );

      expect(mockPrisma.hubItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            reviewStatus: 'draft',
            publishedAt: null,
          },
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          id: 'hub-2',
          status: 'DRAFT',
        }),
      );
    });

    it('throws when the hub item does not exist', async () => {
      mockPrisma.hubItem.findFirst.mockResolvedValue(null);

      await expect(
        service.updateHubItem('missing', { title: 'Nope' }, 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws when there are no update fields', async () => {
      mockPrisma.hubItem.findFirst.mockResolvedValue({
        id: 'hub-3',
        publishedAt: null,
      });

      await expect(
        service.updateHubItem('hub-3', {}, 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('content management mutations', () => {
    it('approves hub content and returns refreshed stats', async () => {
      mockPrisma.hubItem.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});
      mockPrisma.hubItem.findMany.mockResolvedValue([
        {
          id: 'hub-1',
          title: 'Approved Hub Item',
          summary: 'Now published',
          type: 'paper',
          reviewStatus: 'published',
          authorUserId: 'author-1',
          createdAt: new Date('2026-03-14T00:00:00Z'),
          hubItemTags: [],
          likesCount: 2,
          viewsCount: 5,
          author: {
            id: 'author-1',
            email: 'author@example.com',
            role: 'learner',
            profile: {
              displayName: 'Author One',
              avatarUrl: '',
              emailVisibility: 'hidden',
              profileTags: [],
            },
          },
        },
      ]);

      const result = await service.approveContentManagementItem(
        'hub-1',
        'admin-1',
      );

      expect(result).toEqual({
        item: expect.objectContaining({
          id: 'hub-1',
          status: 'PUBLISHED',
        }),
        stats: {
          publishedCount: 1,
          pendingReviewCount: 0,
          draftCount: 0,
          rejectedCount: 0,
        },
      });
    });

    it('rejects hub content and returns the refreshed rejected item', async () => {
      mockPrisma.hubItem.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});
      mockPrisma.hubItem.findMany.mockResolvedValue([
        {
          id: 'hub-2',
          title: 'Rejected Hub Item',
          summary: 'Needs work',
          type: 'tool',
          reviewStatus: 'rejected',
          rejectReason: 'Needs more detail',
          authorUserId: 'author-2',
          createdAt: new Date('2026-03-14T01:00:00Z'),
          hubItemTags: [],
          likesCount: 0,
          viewsCount: 1,
          author: {
            id: 'author-2',
            email: 'expert@example.com',
            role: 'expert',
            profile: {
              displayName: 'Expert Two',
              avatarUrl: '',
              emailVisibility: 'hidden',
              profileTags: [],
            },
          },
        },
      ]);

      const result = await service.rejectContentManagementItem(
        'hub-2',
        'Needs more detail',
        'admin-1',
      );

      expect(result).toEqual({
        item: expect.objectContaining({
          id: 'hub-2',
          status: 'REJECTED',
          rejectReason: 'Needs more detail',
        }),
        stats: {
          publishedCount: 0,
          pendingReviewCount: 0,
          draftCount: 0,
          rejectedCount: 1,
        },
      });
    });

    it('batch updates selected hub items and returns refreshed stats once', async () => {
      mockPrisma.hubItem.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});
      mockPrisma.hubItem.findMany
        .mockResolvedValueOnce([
          { reviewStatus: 'published' },
          { reviewStatus: 'published' },
        ])
        .mockResolvedValueOnce([
          {
            id: 'hub-1',
            title: 'Approved One',
            summary: 'Published',
            type: 'paper',
            reviewStatus: 'published',
            authorUserId: 'author-1',
            createdAt: new Date('2026-03-14T00:00:00Z'),
            hubItemTags: [],
            likesCount: 0,
            viewsCount: 0,
            author: {
              id: 'author-1',
              email: 'author@example.com',
              role: 'learner',
              profile: {
                displayName: 'Author One',
                avatarUrl: '',
                emailVisibility: 'hidden',
                profileTags: [],
              },
            },
          },
          {
            id: 'hub-2',
            title: 'Approved Two',
            summary: 'Published',
            type: 'tool',
            reviewStatus: 'published',
            authorUserId: 'author-2',
            createdAt: new Date('2026-03-14T01:00:00Z'),
            hubItemTags: [],
            likesCount: 0,
            viewsCount: 0,
            author: {
              id: 'author-2',
              email: 'expert@example.com',
              role: 'expert',
              profile: {
                displayName: 'Expert Two',
                avatarUrl: '',
                emailVisibility: 'hidden',
                profileTags: [],
              },
            },
          },
        ]);

      const result = await service.batchUpdateContentManagementItems(
        ['hub-1', 'hub-2'],
        'approve',
        'admin-1',
      );

      expect(mockPrisma.hubItem.update).toHaveBeenCalledTimes(2);
      expect(result.updatedIds).toEqual(['hub-1', 'hub-2']);
      expect(result.items).toEqual([
        expect.objectContaining({ id: 'hub-1', status: 'PUBLISHED' }),
        expect.objectContaining({ id: 'hub-2', status: 'PUBLISHED' }),
      ]);
      expect(result.stats).toEqual({
        publishedCount: 2,
        pendingReviewCount: 0,
        draftCount: 0,
        rejectedCount: 0,
      });
    });
  });
});
