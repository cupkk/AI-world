import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApplicationTargetType, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  normalizeContentStatusValue,
  normalizeContentTypeValue,
  normalizeRoleValue,
} from '../../common/contracts';
import {
  serializeHubItem,
  serializeEnterpriseNeed,
  serializeResearchProject,
  SerializedContent,
  SerializedUser,
  serializeUser,
} from '../../common/serializers/serialize';

export interface AdminDashboardReviewItem extends SerializedContent {
  author?: SerializedUser;
}

export interface AdminDashboardReport {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  status: string;
  reporterId: string;
  reporterName: string;
  createdAt: string;
  reporter?: SerializedUser;
  targetUserId?: string;
  targetUserName?: string;
  targetConversationId?: string;
  targetMessagePreview?: string;
  targetParticipantNames?: string[];
}

export interface AdminDashboardData {
  stats: {
    pendingReviewCount: number;
    pendingReportCount: number;
  };
  reviewItems: AdminDashboardReviewItem[];
  reports: AdminDashboardReport[];
}

export interface AdminHubManagementItem extends SerializedContent {
  author?: SerializedUser;
}

export interface AdminHubManagementData {
  stats: {
    publishedCount: number;
    pendingReviewCount: number;
    draftCount: number;
    rejectedCount: number;
  };
  items: AdminHubManagementItem[];
}

export interface AdminHubManagementMutationResult {
  item: AdminHubManagementItem;
  stats: AdminHubManagementData['stats'];
}

export interface AdminHubManagementBatchResult {
  items: AdminHubManagementItem[];
  updatedIds: string[];
  stats: AdminHubManagementData['stats'];
}

export interface AdminHubManagementQuery {
  q?: string;
  status?: string;
  type?: string;
}

export interface AdminUserManagementItem extends SerializedUser {
  createdAt: string;
  lastLoginAt?: string;
  inviteIssuedCount: number;
  inviteUsedCount: number;
  contentCount: number;
  knowledgeBaseCount: number;
  applicationCount: number;
}

export interface AdminUserManagementData {
  stats: {
    totalCount: number;
    activeCount: number;
    pendingCount: number;
    suspendedCount: number;
    adminCount: number;
    expertCount: number;
    learnerCount: number;
    enterpriseCount: number;
  };
  items: AdminUserManagementItem[];
}

export interface AdminUsersQuery {
  q?: string;
  status?: string;
  role?: string;
}

export interface AdminAuditLogTarget {
  id?: string;
  targetType: string;
  title: string;
  status?: string;
  contentType?: string;
  contentDomain?: string;
}

export interface AdminAuditLogApplication {
  id: string;
  status: string;
  applicant?: SerializedUser;
  owner?: SerializedUser;
  target?: AdminAuditLogTarget;
}

export interface AdminAuditLogItem {
  id: string;
  action: string;
  targetType?: string;
  targetId?: string;
  createdAt: string;
  actorId: string;
  actor?: SerializedUser;
  reason?: string;
  metadata?: Record<string, unknown>;
  target?: AdminAuditLogTarget;
  application?: AdminAuditLogApplication;
}

export interface AdminAuditLogQuery {
  q?: string;
  action?: string;
  targetType?: string;
  limit?: number;
}

type AuditLogApplicationRecord = {
  id: string;
  targetType: ApplicationTargetType;
  targetId: string;
  status: string;
  applicantUserId: string;
  applicant?: any;
};

type AuditLogApplicationTargetSummary = AdminAuditLogTarget & {
  ownerId?: string;
  owner?: SerializedUser;
};

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private readonly reviewUserInclude = {
    profile: {
      include: {
        profileTags: {
          include: {
            tag: true,
          },
        },
      },
    },
  } as const;

  constructor(private prisma: PrismaService) {}

  /**
   * Auto-detect what type of entity an ID belongs to
   */
  async detectReviewType(id: string): Promise<string> {
    const hub = await this.prisma.hubItem.findUnique({ where: { id }, select: { id: true } });
    if (hub) return 'hub_item';

    const need = await this.prisma.enterpriseNeed.findUnique({ where: { id }, select: { id: true } });
    if (need) return 'enterprise_need';

    const project = await this.prisma.researchProject.findUnique({ where: { id }, select: { id: true } });
    if (project) return 'research_project';

    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (user) return 'user_identity';

    throw new NotFoundException(`Entity not found: ${id}`);
  }

  async getReviewQueue(type?: string): Promise<SerializedContent[]> {
    const results: SerializedContent[] = [];

    // Hub items pending review
    if (!type || type === 'hub_item') {
      const hubItems = await this.prisma.hubItem.findMany({
        where: { reviewStatus: 'pending_review', deletedAt: null },
        include: { author: { select: { id: true, email: true, role: true } } },
        orderBy: { createdAt: 'asc' },
      });
      results.push(...hubItems.map((h) => serializeHubItem(h)));
    }

    // Enterprise needs
    if (!type || type === 'enterprise_need') {
      const needs = await this.prisma.enterpriseNeed.findMany({
        where: { reviewStatus: 'pending_review', deletedAt: null },
        include: { enterprise: { select: { id: true, email: true } } },
        orderBy: { createdAt: 'asc' },
      });
      results.push(...needs.map((n) => serializeEnterpriseNeed(n)));
    }

    // Research projects
    if (!type || type === 'research_project') {
      const projects = await this.prisma.researchProject.findMany({
        where: { reviewStatus: 'pending_review', deletedAt: null },
        include: { expert: { select: { id: true, email: true } } },
        orderBy: { createdAt: 'asc' },
      });
      results.push(...projects.map((p) => serializeResearchProject(p)));
    }

    // Users pending identity review
    if (!type || type === 'user_identity') {
      const users = await this.prisma.user.findMany({
        where: { status: 'pending_identity_review', deletedAt: null },
        include: { profile: true },
        orderBy: { createdAt: 'asc' },
      });
      results.push(...users.map((u) => ({
        id: u.id,
        title: (u as any).profile?.displayName ?? u.email,
        description: 'Identity review',
        type: 'USER_IDENTITY',
        contentDomain: 'HUB_ITEM',
        status: 'PENDING_REVIEW',
        authorId: u.id,
        createdAt: u.createdAt?.toISOString?.() ?? String(u.createdAt ?? ''),
        tags: [] as string[],
        likes: 0,
        views: 0,
      })));
    }

    return results;
  }

  async getDashboard(): Promise<AdminDashboardData> {
    const [hubItems, needs, projects, users, reports] = await Promise.all([
      this.prisma.hubItem.findMany({
        where: { reviewStatus: 'pending_review', deletedAt: null },
        include: {
          author: {
            include: this.reviewUserInclude,
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.enterpriseNeed.findMany({
        where: { reviewStatus: 'pending_review', deletedAt: null },
        include: {
          enterprise: {
            include: this.reviewUserInclude,
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.researchProject.findMany({
        where: { reviewStatus: 'pending_review', deletedAt: null },
        include: {
          expert: {
            include: this.reviewUserInclude,
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.user.findMany({
        where: { status: 'pending_identity_review', deletedAt: null },
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
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.report.findMany({
        where: { status: 'pending' },
        include: {
          reporter: {
            include: this.reviewUserInclude,
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const reviewItems: AdminDashboardReviewItem[] = [
      ...hubItems.map((item) => ({
        ...serializeHubItem(item),
        author: item.author ? this.serializeReviewAuthor(item.author) : undefined,
      })),
      ...needs.map((item) => ({
        ...serializeEnterpriseNeed(item),
        author: item.enterprise
          ? this.serializeReviewAuthor(item.enterprise)
          : undefined,
      })),
      ...projects.map((item) => ({
        ...serializeResearchProject(item),
        author: item.expert ? this.serializeReviewAuthor(item.expert) : undefined,
      })),
      ...users.map((user) => ({
        id: user.id,
        title: user.profile?.displayName ?? user.email,
        description: 'Identity review',
        type: 'USER_IDENTITY',
        contentDomain: 'HUB_ITEM',
        status: 'PENDING_REVIEW',
        authorId: user.id,
        createdAt: user.createdAt?.toISOString?.() ?? String(user.createdAt ?? ''),
        tags: [] as string[],
        likes: 0,
        views: 0,
        author: this.serializeReviewAuthor(user),
      })),
    ].sort(
      (left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
    );

    const serializedReports = await this.serializeDashboardReports(reports);

    return {
      stats: {
        pendingReviewCount: reviewItems.length,
        pendingReportCount: serializedReports.length,
      },
      reviewItems,
      reports: serializedReports,
    };
  }

  async listHubItems(
    query: AdminHubManagementQuery = {},
  ): Promise<AdminHubManagementData> {
    const baseWhere = this.buildContentManagementWhere(query, false);
    const filteredWhere = this.buildContentManagementWhere(query, true);

    const [statRows, hubItems] = await Promise.all([
      this.prisma.hubItem.findMany({
        where: baseWhere,
        select: {
          reviewStatus: true,
        },
      }),
      this.prisma.hubItem.findMany({
      where: filteredWhere,
      include: {
        hubItemTags: {
          include: {
            tag: true,
          },
        },
        author: {
          include: this.reviewUserInclude,
        },
      },
      orderBy: { createdAt: 'desc' },
      }),
    ]);

    const items = hubItems.map((item) => ({
      ...serializeHubItem(item),
      author: item.author ? this.serializeReviewAuthor(item.author) : undefined,
    }));

    return {
      stats: {
        publishedCount: statRows.filter(
          (item) => item.reviewStatus === 'published',
        ).length,
        pendingReviewCount: statRows.filter(
          (item) => item.reviewStatus === 'pending_review',
        ).length,
        draftCount: statRows.filter((item) => item.reviewStatus === 'draft')
          .length,
        rejectedCount: statRows.filter(
          (item) => item.reviewStatus === 'rejected',
        ).length,
      },
      items,
    };
  }

  async getContentManagement(
    query: AdminHubManagementQuery = {},
  ): Promise<AdminHubManagementData> {
    return this.listHubItems(query);
  }

  async listUsers(
    query: AdminUsersQuery = {},
  ): Promise<AdminUserManagementData> {
    const baseWhere = this.buildUserManagementWhere(query, false);
    const filteredWhere = this.buildUserManagementWhere(query, true);

    const [statRows, users] = await Promise.all([
      this.prisma.user.findMany({
        where: baseWhere,
        select: {
          role: true,
          status: true,
        },
      }),
      this.prisma.user.findMany({
        where: filteredWhere,
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
          boundInvite: {
            select: {
              id: true,
            },
          },
          _count: {
            select: {
              applications: true,
              authoredHubItems: true,
              enterpriseNeeds: true,
              issuedInvites: true,
              kbFiles: true,
              researchProjects: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const items = users.map((user) => ({
      ...serializeUser(user),
      createdAt:
        user.createdAt?.toISOString?.() ?? String(user.createdAt ?? ''),
      lastLoginAt:
        user.lastLoginAt?.toISOString?.() ?? undefined,
      inviteIssuedCount: user._count.issuedInvites,
      inviteUsedCount: user.boundInvite ? 1 : 0,
      contentCount:
        user._count.authoredHubItems +
        user._count.enterpriseNeeds +
        user._count.researchProjects,
      knowledgeBaseCount: user._count.kbFiles,
      applicationCount: user._count.applications,
    }));

    return {
      stats: {
        totalCount: statRows.length,
        activeCount: statRows.filter((item) => item.status === 'active').length,
        pendingCount: statRows.filter(
          (item) => item.status === 'pending_identity_review',
        ).length,
        suspendedCount: statRows.filter(
          (item) => item.status === 'suspended',
        ).length,
        adminCount: statRows.filter((item) => item.role === 'ADMIN').length,
        expertCount: statRows.filter((item) => item.role === 'EXPERT').length,
        learnerCount: statRows.filter((item) => item.role === 'LEARNER').length,
        enterpriseCount: statRows.filter(
          (item) => item.role === 'ENTERPRISE_LEADER',
        ).length,
      },
      items,
    };
  }

  async listAuditLogs(
    query: AdminAuditLogQuery = {},
  ): Promise<AdminAuditLogItem[]> {
    const normalizedQuery = query.q?.trim().toLowerCase() ?? '';
    const normalizedTargetType = this.normalizeAdminAuditTargetType(
      query.targetType,
    );
    const normalizedLimit = this.normalizeAuditLogLimit(query.limit);
    const fetchLimit = normalizedQuery
      ? Math.max(normalizedLimit * 5, 200)
      : normalizedLimit;

    const where: Prisma.AuditLogWhereInput = {};
    if (query.action?.trim()) {
      where.action = query.action.trim();
    }
    if (normalizedTargetType) {
      where.targetType = normalizedTargetType.toLowerCase();
    }

    const logs = await this.prisma.auditLog.findMany({
      where,
      include: {
        actor: {
          include: this.reviewUserInclude,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: fetchLimit,
    });

    const serializedLogs = await this.serializeAuditLogs(logs);
    if (!normalizedQuery) {
      return serializedLogs.slice(0, normalizedLimit);
    }

    return serializedLogs
      .filter((item) => this.matchesAuditLogQuery(item, normalizedQuery))
      .slice(0, normalizedLimit);
  }

  async updateContentManagementItem(
    hubItemId: string,
    data: {
      title?: string;
      description?: string;
      status?: 'published' | 'draft';
    },
    adminId: string,
  ): Promise<AdminHubManagementMutationResult> {
    const item = await this.updateHubItem(hubItemId, data, adminId);
    return this.buildContentManagementMutation(hubItemId, item);
  }

  async approveContentManagementItem(
    hubItemId: string,
    adminId: string,
  ): Promise<AdminHubManagementMutationResult> {
    await this.approve(hubItemId, 'hub_item', adminId);
    return this.buildContentManagementMutation(hubItemId);
  }

  async rejectContentManagementItem(
    hubItemId: string,
    reason: string,
    adminId: string,
  ): Promise<AdminHubManagementMutationResult> {
    await this.reject(hubItemId, 'hub_item', reason, adminId);
    return this.buildContentManagementMutation(hubItemId);
  }

  async moveContentManagementItemToDraft(
    hubItemId: string,
    adminId: string,
  ): Promise<AdminHubManagementMutationResult> {
    return this.updateContentManagementItem(
      hubItemId,
      { status: 'draft' },
      adminId,
    );
  }

  async batchUpdateContentManagementItems(
    ids: string[],
    action: 'approve' | 'reject' | 'draft',
    adminId: string,
    reason?: string,
  ): Promise<AdminHubManagementBatchResult> {
    const updatedIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];

    if (updatedIds.length === 0) {
      throw new BadRequestException('No content ids provided');
    }

    for (const id of updatedIds) {
      if (action === 'approve') {
        await this.approve(id, 'hub_item', adminId);
        continue;
      }

      if (action === 'reject') {
        await this.reject(
          id,
          'hub_item',
          reason?.trim() || 'No reason provided',
          adminId,
        );
        continue;
      }

      await this.updateHubItem(id, { status: 'draft' }, adminId);
    }

    const snapshot = await this.listHubItems();

    return {
      items: snapshot.items.filter((item) => updatedIds.includes(item.id)),
      updatedIds,
      stats: snapshot.stats,
    };
  }

  async approve(id: string, reviewType: string, adminId: string) {
    switch (reviewType) {
      case 'hub_item':
        await this.prisma.hubItem.update({
          where: { id },
          data: { reviewStatus: 'published', publishedAt: new Date() },
        });
        break;
      case 'enterprise_need':
        await this.prisma.enterpriseNeed.update({
          where: { id },
          data: { reviewStatus: 'published' },
        });
        break;
      case 'research_project':
        await this.prisma.researchProject.update({
          where: { id },
          data: { reviewStatus: 'published' },
        });
        break;
      case 'user_identity':
        await this.prisma.user.update({
          where: { id },
          data: { status: 'active' },
        });
        break;
      default:
        throw new BadRequestException('Unknown review type');
    }

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'approve',
        targetType: reviewType,
        targetId: id,
      },
    });

    this.logger.log(`Admin ${adminId} approved ${reviewType}:${id}`);
    return { success: true };
  }

  async reject(id: string, reviewType: string, reason: string, adminId: string) {
    switch (reviewType) {
      case 'hub_item':
        await this.prisma.hubItem.update({
          where: { id },
          data: { reviewStatus: 'rejected', rejectReason: reason },
        });
        break;
      case 'enterprise_need':
        await this.prisma.enterpriseNeed.update({
          where: { id },
          data: { reviewStatus: 'rejected', rejectReason: reason },
        });
        break;
      case 'research_project':
        await this.prisma.researchProject.update({
          where: { id },
          data: { reviewStatus: 'rejected', rejectReason: reason },
        });
        break;
      case 'user_identity':
        await this.prisma.user.update({
          where: { id },
          data: { status: 'suspended' },
        });
        break;
      default:
        throw new BadRequestException('Unknown review type');
    }

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'reject',
        targetType: reviewType,
        targetId: id,
        metadata: { reason },
      },
    });

    this.logger.log(`Admin ${adminId} rejected ${reviewType}:${id}`);
    return { success: true };
  }

  async createHubItem(data: any, adminId: string) {
    const item = await this.prisma.hubItem.create({
      data: {
        ...data,
        adminUserId: adminId,
        reviewStatus: 'published',
        publishedAt: new Date(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'admin_create_hub_item',
        targetType: 'hub_item',
        targetId: item.id,
      },
    });

    return item;
  }

  async updateHubItem(
    hubItemId: string,
    data: {
      title?: string;
      description?: string;
      status?: 'published' | 'draft';
    },
    adminId: string,
  ) {
    const existing = await this.prisma.hubItem.findFirst({
      where: { id: hubItemId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Hub item not found');
    }

    const updateData: Record<string, unknown> = {};
    if (typeof data.title === 'string') {
      updateData.title = data.title;
    }
    if (typeof data.description === 'string') {
      updateData.summary = data.description;
    }
    if (data.status === 'published') {
      updateData.reviewStatus = 'published';
      updateData.publishedAt = existing.publishedAt ?? new Date();
    }
    if (data.status === 'draft') {
      updateData.reviewStatus = 'draft';
      updateData.publishedAt = null;
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('No update fields provided');
    }

    const item = await this.prisma.hubItem.update({
      where: { id: hubItemId },
      data: updateData,
      include: {
        hubItemTags: {
          include: {
            tag: true,
          },
        },
        author: {
          include: this.reviewUserInclude,
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'update_hub_item',
        targetType: 'hub_item',
        targetId: hubItemId,
        metadata: {
          title: data.title ?? null,
          description: data.description ?? null,
          status: data.status ?? null,
        },
      },
    });

    return {
      ...serializeHubItem(item),
      author: item.author ? this.serializeReviewAuthor(item.author) : undefined,
    };
  }

  async generateInviteCodes(count: number, adminId: string, expiresInDays?: number) {
    const codes: string[] = [];
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    for (let i = 0; i < count; i++) {
      const code = this.generateCode();
      await this.prisma.invite.create({
        data: {
          code,
          issuedByAdminId: adminId,
          expiresAt,
        },
      });
      codes.push(code);
    }

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'generate_invite_codes',
        targetType: 'invite',
        metadata: { count, codes },
      },
    });

    return { codes, expiresAt };
  }

  async updateUserStatus(userId: string, status: 'active' | 'suspended', adminId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: status as any },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'update_user_status',
        targetType: 'user',
        targetId: userId,
        metadata: { status },
      },
    });

    return { success: true };
  }

  // ---- Reports (admin) ----

  async listPendingReports() {
    const reports = await this.prisma.report.findMany({
      where: { status: 'pending' },
      include: {
        reporter: {
          include: this.reviewUserInclude,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return this.serializeDashboardReports(reports);
  }

  async updateReportStatus(
    reportId: string,
    status: 'resolved' | 'dismissed',
    adminId: string,
    notes?: string,
  ) {
    const report = await this.prisma.report.update({
      where: { id: reportId },
      data: { status: status as any },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: `report_${status}`,
        targetType: 'report',
        targetId: reportId,
        metadata: { notes: notes ?? null },
      },
    });

    return report;
  }

  private async serializeAuditLogs(logs: any[]): Promise<AdminAuditLogItem[]> {
    if (logs.length === 0) {
      return [];
    }

    const applicationIds = new Set<string>();
    const hubItemIds = new Set<string>();
    const enterpriseNeedIds = new Set<string>();
    const researchProjectIds = new Set<string>();
    const userIds = new Set<string>();
    const reportIds = new Set<string>();

    for (const log of logs) {
      const normalizedTargetType = this.normalizeAdminAuditTargetType(
        log.targetType,
      );
      const metadata = this.extractAuditLogMetadata(log.metadata);

      if (
        normalizedTargetType === 'APPLICATION' &&
        typeof log.targetId === 'string' &&
        log.targetId
      ) {
        applicationIds.add(log.targetId);
      }

      if (
        typeof metadata?.sourceApplicationId === 'string' &&
        metadata.sourceApplicationId
      ) {
        applicationIds.add(metadata.sourceApplicationId);
      }

      if (typeof log.targetId !== 'string' || !log.targetId) {
        continue;
      }

      switch (normalizedTargetType) {
        case 'HUB_ITEM':
          hubItemIds.add(log.targetId);
          break;
        case 'ENTERPRISE_NEED':
          enterpriseNeedIds.add(log.targetId);
          break;
        case 'RESEARCH_PROJECT':
          researchProjectIds.add(log.targetId);
          break;
        case 'USER':
        case 'USER_IDENTITY':
          userIds.add(log.targetId);
          break;
        case 'REPORT':
          reportIds.add(log.targetId);
          break;
        default:
          break;
      }
    }

    const [
      applications,
      hubItems,
      enterpriseNeeds,
      researchProjects,
      users,
      reports,
    ] = await Promise.all([
      applicationIds.size > 0
        ? this.prisma.application.findMany({
            where: { id: { in: Array.from(applicationIds) } },
            include: {
              applicant: {
                include: this.reviewUserInclude,
              },
            },
          })
        : Promise.resolve([]),
      hubItemIds.size > 0
        ? this.prisma.hubItem.findMany({
            where: { id: { in: Array.from(hubItemIds) } },
            include: {
              author: {
                include: this.reviewUserInclude,
              },
              hubItemTags: {
                include: {
                  tag: true,
                },
              },
            },
          })
        : Promise.resolve([]),
      enterpriseNeedIds.size > 0
        ? this.prisma.enterpriseNeed.findMany({
            where: { id: { in: Array.from(enterpriseNeedIds) } },
            include: {
              enterprise: {
                include: this.reviewUserInclude,
              },
            },
          })
        : Promise.resolve([]),
      researchProjectIds.size > 0
        ? this.prisma.researchProject.findMany({
            where: { id: { in: Array.from(researchProjectIds) } },
            include: {
              expert: {
                include: this.reviewUserInclude,
              },
            },
          })
        : Promise.resolve([]),
      userIds.size > 0
        ? this.prisma.user.findMany({
            where: { id: { in: Array.from(userIds) } },
            include: this.reviewUserInclude,
          })
        : Promise.resolve([]),
      reportIds.size > 0
        ? this.prisma.report.findMany({
            where: { id: { in: Array.from(reportIds) } },
            include: {
              reporter: {
                include: this.reviewUserInclude,
              },
            },
          })
        : Promise.resolve([]),
    ]);

    const applicationContextMap = await this.buildAuditLogApplicationContextMap(
      applications,
    );
    const hubTargetMap = new Map(
      hubItems.map((item) => [
        item.id,
        this.buildAuditLogTargetFromHubItem(item),
      ]),
    );
    const enterpriseNeedTargetMap = new Map(
      enterpriseNeeds.map((item) => [
        item.id,
        this.buildAuditLogTargetFromEnterpriseNeed(item),
      ]),
    );
    const researchProjectTargetMap = new Map(
      researchProjects.map((item) => [
        item.id,
        this.buildAuditLogTargetFromResearchProject(item),
      ]),
    );
    const userTargetMap = new Map(
      users.map((item) => [item.id, this.buildAuditLogTargetFromUser(item)]),
    );
    const reportTargetMap = new Map(
      reports.map((item) => [item.id, this.buildAuditLogTargetFromReport(item)]),
    );

    return logs.map((log) => {
      const normalizedTargetType = this.normalizeAdminAuditTargetType(
        log.targetType,
      );
      const metadata = this.extractAuditLogMetadata(log.metadata);
      const actor = log.actor
        ? this.serializeReviewAuthor(log.actor)
        : undefined;
      const sourceApplicationId =
        normalizedTargetType === 'APPLICATION'
          ? log.targetId ?? undefined
          : typeof metadata?.sourceApplicationId === 'string'
            ? metadata.sourceApplicationId
            : undefined;
      const application = sourceApplicationId
        ? applicationContextMap.get(sourceApplicationId)
        : undefined;
      let target: AdminAuditLogTarget | undefined;

      switch (normalizedTargetType) {
        case 'APPLICATION':
          target = application?.target;
          break;
        case 'HUB_ITEM':
          target =
            (typeof log.targetId === 'string' && log.targetId
              ? hubTargetMap.get(log.targetId)
              : undefined) ??
            this.buildFallbackAuditTarget(
              normalizedTargetType,
              log.targetId,
              metadata,
            );
          break;
        case 'ENTERPRISE_NEED':
          target =
            (typeof log.targetId === 'string' && log.targetId
              ? enterpriseNeedTargetMap.get(log.targetId)
              : undefined) ??
            this.buildFallbackAuditTarget(
              normalizedTargetType,
              log.targetId,
              metadata,
            );
          break;
        case 'RESEARCH_PROJECT':
          target =
            (typeof log.targetId === 'string' && log.targetId
              ? researchProjectTargetMap.get(log.targetId)
              : undefined) ??
            this.buildFallbackAuditTarget(
              normalizedTargetType,
              log.targetId,
              metadata,
            );
          break;
        case 'USER':
        case 'USER_IDENTITY':
          target =
            (typeof log.targetId === 'string' && log.targetId
              ? userTargetMap.get(log.targetId)
              : undefined) ??
            this.buildFallbackAuditTarget(
              normalizedTargetType,
              log.targetId,
              metadata,
            );
          break;
        case 'REPORT':
          target =
            (typeof log.targetId === 'string' && log.targetId
              ? reportTargetMap.get(log.targetId)
              : undefined) ??
            this.buildFallbackAuditTarget(
              normalizedTargetType,
              log.targetId,
              metadata,
            );
          break;
        case 'INVITE':
          target = this.buildFallbackAuditTarget(
            normalizedTargetType,
            log.targetId,
            metadata,
          );
          break;
        default:
          target = this.buildFallbackAuditTarget(
            normalizedTargetType,
            log.targetId,
            metadata,
          );
          break;
      }

      return {
        id: log.id,
        action: log.action,
        targetType: normalizedTargetType,
        targetId: log.targetId ?? undefined,
        createdAt:
          log.createdAt?.toISOString?.() ?? String(log.createdAt ?? ''),
        actorId: log.actorId,
        actor,
        reason:
          typeof metadata?.reason === 'string' ? metadata.reason : undefined,
        metadata,
        target,
        application,
      };
    });
  }

  private async buildAuditLogApplicationContextMap(
    applications: AuditLogApplicationRecord[],
  ) {
    if (applications.length === 0) {
      return new Map<string, AdminAuditLogApplication>();
    }

    const enterpriseNeedIds = new Set<string>();
    const researchProjectIds = new Set<string>();
    const hubProjectIds = new Set<string>();

    for (const application of applications) {
      switch (application.targetType) {
        case 'enterprise_need':
          enterpriseNeedIds.add(application.targetId);
          break;
        case 'research_project':
          researchProjectIds.add(application.targetId);
          break;
        case 'hub_project':
          hubProjectIds.add(application.targetId);
          break;
        default:
          break;
      }
    }

    const [needs, researchProjects, hubItems] = await Promise.all([
      enterpriseNeedIds.size > 0
        ? this.prisma.enterpriseNeed.findMany({
            where: { id: { in: Array.from(enterpriseNeedIds) } },
            include: {
              enterprise: {
                include: this.reviewUserInclude,
              },
            },
          })
        : Promise.resolve([]),
      researchProjectIds.size > 0
        ? this.prisma.researchProject.findMany({
            where: { id: { in: Array.from(researchProjectIds) } },
            include: {
              expert: {
                include: this.reviewUserInclude,
              },
            },
          })
        : Promise.resolve([]),
      hubProjectIds.size > 0
        ? this.prisma.hubItem.findMany({
            where: { id: { in: Array.from(hubProjectIds) } },
            include: {
              author: {
                include: this.reviewUserInclude,
              },
              hubItemTags: {
                include: {
                  tag: true,
                },
              },
            },
          })
        : Promise.resolve([]),
    ]);

    const targetMap = new Map<string, AuditLogApplicationTargetSummary>();

    for (const need of needs) {
      const serializedNeed = serializeEnterpriseNeed(need);
      targetMap.set(this.auditLogApplicationTargetKey('enterprise_need', need.id), {
        id: serializedNeed.id,
        targetType: 'ENTERPRISE_NEED',
        title: serializedNeed.title,
        status: serializedNeed.status,
        contentType: serializedNeed.type,
        contentDomain: serializedNeed.contentDomain,
        ownerId: need.enterpriseUserId,
        owner: need.enterprise
          ? this.serializeReviewAuthor(need.enterprise)
          : undefined,
      });
    }

    for (const project of researchProjects) {
      const serializedProject = serializeResearchProject(project);
      targetMap.set(
        this.auditLogApplicationTargetKey('research_project', project.id),
        {
          id: serializedProject.id,
          targetType: 'RESEARCH_PROJECT',
          title: serializedProject.title,
          status: serializedProject.status,
          contentType: serializedProject.type,
          contentDomain: serializedProject.contentDomain,
          ownerId: project.expertUserId,
          owner: project.expert
            ? this.serializeReviewAuthor(project.expert)
            : undefined,
        },
      );
    }

    for (const item of hubItems) {
      const serializedItem = serializeHubItem(item);
      targetMap.set(this.auditLogApplicationTargetKey('hub_project', item.id), {
        id: serializedItem.id,
        targetType: 'PROJECT',
        title: serializedItem.title,
        status: serializedItem.status,
        contentType: serializedItem.type,
        contentDomain: serializedItem.contentDomain,
        ownerId: item.authorUserId ?? undefined,
        owner: item.author ? this.serializeReviewAuthor(item.author) : undefined,
      });
    }

    const applicationMap = new Map<string, AdminAuditLogApplication>();

    for (const application of applications) {
      const target =
        targetMap.get(
          this.auditLogApplicationTargetKey(
            application.targetType,
            application.targetId,
          ),
        ) ??
        ({
          id: application.targetId,
          targetType: this.normalizeAuditApplicationTargetType(
            application.targetType,
          ),
          title: 'Unavailable target',
        } satisfies AdminAuditLogTarget);

      applicationMap.set(application.id, {
        id: application.id,
        status: String(application.status ?? 'submitted').toUpperCase(),
        applicant: application.applicant
          ? this.serializeReviewAuthor(application.applicant)
          : undefined,
        owner: target.owner,
        target: {
          id: target.id,
          targetType: target.targetType,
          title: target.title,
          status: target.status,
          contentType: target.contentType,
          contentDomain: target.contentDomain,
        },
      });
    }

    return applicationMap;
  }

  private buildAuditLogTargetFromHubItem(item: any): AdminAuditLogTarget {
    const serializedItem = serializeHubItem(item);
    return {
      id: serializedItem.id,
      targetType: 'HUB_ITEM',
      title: serializedItem.title,
      status: serializedItem.status,
      contentType: serializedItem.type,
      contentDomain: serializedItem.contentDomain,
    };
  }

  private buildAuditLogTargetFromEnterpriseNeed(
    item: any,
  ): AdminAuditLogTarget {
    const serializedItem = serializeEnterpriseNeed(item);
    return {
      id: serializedItem.id,
      targetType: 'ENTERPRISE_NEED',
      title: serializedItem.title,
      status: serializedItem.status,
      contentType: serializedItem.type,
      contentDomain: serializedItem.contentDomain,
    };
  }

  private buildAuditLogTargetFromResearchProject(
    item: any,
  ): AdminAuditLogTarget {
    const serializedItem = serializeResearchProject(item);
    return {
      id: serializedItem.id,
      targetType: 'RESEARCH_PROJECT',
      title: serializedItem.title,
      status: serializedItem.status,
      contentType: serializedItem.type,
      contentDomain: serializedItem.contentDomain,
    };
  }

  private buildAuditLogTargetFromUser(user: any): AdminAuditLogTarget {
    const serializedUser = this.serializeReviewAuthor(user);
    return {
      id: serializedUser.id,
      targetType: 'USER',
      title: serializedUser.name || serializedUser.email || serializedUser.id,
      status: user.status?.toUpperCase?.() ?? undefined,
    };
  }

  private buildAuditLogTargetFromReport(report: any): AdminAuditLogTarget {
    return {
      id: report.id,
      targetType: 'REPORT',
      title:
        typeof report.reason === 'string' && report.reason.trim()
          ? report.reason
          : `Report ${report.id}`,
      status: report.status?.toUpperCase?.() ?? undefined,
    };
  }

  private buildFallbackAuditTarget(
    targetType?: string,
    targetId?: string | null,
    metadata?: Record<string, unknown>,
  ): AdminAuditLogTarget | undefined {
    const normalizedTargetType = this.normalizeAdminAuditTargetType(targetType);
    if (!normalizedTargetType) {
      return undefined;
    }

    if (normalizedTargetType === 'INVITE') {
      const inviteCount =
        typeof metadata?.count === 'number'
          ? metadata.count
          : Array.isArray(metadata?.codes)
            ? metadata.codes.length
            : undefined;

      return {
        targetType: 'INVITE',
        title:
          typeof inviteCount === 'number'
            ? `Generated ${inviteCount} invite codes`
            : 'Invite codes',
      };
    }

    return {
      id: targetId ?? undefined,
      targetType: normalizedTargetType,
      title: targetId ? `${normalizedTargetType} ${targetId}` : normalizedTargetType,
    };
  }

  private extractAuditLogMetadata(
    metadata: unknown,
  ): Record<string, unknown> | undefined {
    if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
      return metadata as Record<string, unknown>;
    }
    return undefined;
  }

  private matchesAuditLogQuery(
    item: AdminAuditLogItem,
    normalizedQuery: string,
  ) {
    const metadataText = item.metadata ? JSON.stringify(item.metadata) : '';
    const haystack = [
      item.action,
      item.targetType,
      item.targetId,
      item.actor?.name,
      item.actor?.email,
      item.actor?.id,
      item.reason,
      item.target?.title,
      item.target?.targetType,
      item.target?.status,
      item.application?.id,
      item.application?.status,
      item.application?.applicant?.name,
      item.application?.applicant?.email,
      item.application?.applicant?.id,
      item.application?.owner?.name,
      item.application?.owner?.email,
      item.application?.owner?.id,
      metadataText,
    ]
      .filter((value): value is string => typeof value === 'string')
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  }

  private normalizeAuditLogLimit(limit?: number) {
    if (typeof limit !== 'number' || Number.isNaN(limit)) {
      return 100;
    }

    return Math.min(200, Math.max(1, Math.floor(limit)));
  }

  private normalizeAdminAuditTargetType(value: unknown) {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim().toUpperCase();
    if (!normalized) {
      return undefined;
    }

    switch (normalized) {
      case 'APPLICATION':
      case 'ENTERPRISE_NEED':
      case 'HUB_ITEM':
      case 'INVITE':
      case 'PROJECT':
      case 'REPORT':
      case 'RESEARCH_PROJECT':
      case 'USER':
      case 'USER_IDENTITY':
        return normalized;
      default:
        return normalized;
    }
  }

  private auditLogApplicationTargetKey(
    targetType: ApplicationTargetType,
    targetId: string,
  ) {
    return `${targetType}:${targetId}`;
  }

  private normalizeAuditApplicationTargetType(targetType: ApplicationTargetType) {
    switch (targetType) {
      case 'enterprise_need':
        return 'ENTERPRISE_NEED';
      case 'research_project':
        return 'RESEARCH_PROJECT';
      case 'hub_project':
        return 'PROJECT';
      default:
        return 'PROJECT';
    }
  }

  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  private serializeReviewAuthor(user: any): SerializedUser {
    return serializeUser(user, { maskEmail: true });
  }

  private async buildContentManagementMutation(
    hubItemId: string,
    fallbackItem?: AdminHubManagementItem,
  ): Promise<AdminHubManagementMutationResult> {
    const snapshot = await this.listHubItems();
    const item =
      snapshot.items.find((candidate) => candidate.id === hubItemId) ??
      fallbackItem;

    if (!item) {
      throw new NotFoundException('Hub item not found');
    }

    return {
      item,
      stats: snapshot.stats,
    };
  }

  private buildContentManagementWhere(
    query: AdminHubManagementQuery,
    includeStatusFilter: boolean,
  ): Prisma.HubItemWhereInput {
    const where: Prisma.HubItemWhereInput = {
      deletedAt: null,
    };

    if (query.type) {
      where.type = normalizeContentTypeValue(query.type).toLowerCase() as any;
    }

    if (includeStatusFilter && query.status) {
      where.reviewStatus = normalizeContentStatusValue(query.status)
        .toLowerCase() as any;
    }

    if (query.q?.trim()) {
      const keyword = query.q.trim();
      where.OR = [
        { title: { contains: keyword, mode: 'insensitive' } },
        { summary: { contains: keyword, mode: 'insensitive' } },
        {
          hubItemTags: {
            some: {
              tag: {
                name: { contains: keyword, mode: 'insensitive' },
              },
            },
          },
        },
        {
          author: {
            is: {
              email: { contains: keyword, mode: 'insensitive' },
            },
          },
        },
        {
          author: {
            is: {
              profile: {
                is: {
                  displayName: { contains: keyword, mode: 'insensitive' },
                },
              },
            },
          },
        },
      ];
    }

    return where;
  }

  private buildUserManagementWhere(
    query: AdminUsersQuery,
    includeFilters: boolean,
  ): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
    };

    if (includeFilters && query.role?.trim()) {
      where.role = normalizeRoleValue(query.role) as any;
    }

    if (includeFilters && query.status?.trim()) {
      const normalizedStatus = query.status.trim().toLowerCase();
      if (
        normalizedStatus === 'active' ||
        normalizedStatus === 'pending_identity_review' ||
        normalizedStatus === 'suspended'
      ) {
        where.status = normalizedStatus as any;
      }
    }

    if (query.q?.trim()) {
      const keyword = query.q.trim();
      where.OR = [
        { email: { contains: keyword, mode: 'insensitive' } },
        {
          profile: {
            is: {
              displayName: { contains: keyword, mode: 'insensitive' },
            },
          },
        },
        {
          profile: {
            is: {
              headline: { contains: keyword, mode: 'insensitive' },
            },
          },
        },
        {
          profile: {
            is: {
              org: { contains: keyword, mode: 'insensitive' },
            },
          },
        },
        {
          profile: {
            is: {
              contactEmail: { contains: keyword, mode: 'insensitive' },
            },
          },
        },
        {
          profile: {
            is: {
              phone: { contains: keyword, mode: 'insensitive' },
            },
          },
        },
      ];
    }

    return where;
  }

  private async serializeDashboardReports(reports: any[]) {
    const userTargetIds = Array.from(
      new Set(
        reports
          .filter((report) => report.targetType === 'user')
          .map((report) => report.targetId),
      ),
    );
    const messageTargetIds = Array.from(
      new Set(
        reports
          .filter((report) => report.targetType === 'message')
          .map((report) => report.targetId),
      ),
    );
    const conversationTargetIds = Array.from(
      new Set(
        reports
          .filter((report) => report.targetType === 'conversation')
          .map((report) => report.targetId),
      ),
    );

    const [targetUsers, targetMessages, targetConversations] = await Promise.all([
      userTargetIds.length > 0
        ? this.prisma.user.findMany({
            where: { id: { in: userTargetIds }, deletedAt: null },
            include: this.reviewUserInclude,
          })
        : Promise.resolve([]),
      messageTargetIds.length > 0
        ? this.prisma.message.findMany({
            where: { id: { in: messageTargetIds } },
            include: {
              sender: {
                include: this.reviewUserInclude,
              },
              conversation: {
                include: {
                  members: {
                    include: {
                      user: {
                        include: this.reviewUserInclude,
                      },
                    },
                  },
                },
              },
            },
          })
        : Promise.resolve([]),
      conversationTargetIds.length > 0
        ? this.prisma.conversation.findMany({
            where: { id: { in: conversationTargetIds } },
            include: {
              members: {
                include: {
                  user: {
                    include: this.reviewUserInclude,
                  },
                },
              },
              messages: {
                take: 1,
                orderBy: { createdAt: 'desc' },
              },
            },
          })
        : Promise.resolve([]),
    ]);

    const userMap = new Map(
      targetUsers.map((user) => [user.id, this.serializeReviewAuthor(user)]),
    );
    const messageMap = new Map(
      targetMessages.map((message) => [
        message.id,
        {
          userId: message.senderId,
          userName:
            this.serializeReviewAuthor(message.sender).name ||
            message.sender.email,
          conversationId: message.conversationId,
          preview: (message.bodyText ?? '').slice(0, 180),
          participantNames: message.conversation.members
            .map((member) => this.serializeReviewAuthor(member.user).name)
            .filter(Boolean),
        },
      ]),
    );
    const conversationMap = new Map(
      targetConversations.map((conversation) => [
        conversation.id,
        {
          preview: (conversation.messages[0]?.bodyText ?? '').slice(0, 180),
          participantNames: conversation.members
            .map((member) => this.serializeReviewAuthor(member.user).name)
            .filter(Boolean),
        },
      ]),
    );

    return reports.map((report) =>
      this.serializeDashboardReport(report, userMap, messageMap, conversationMap),
    );
  }

  private serializeDashboardReport(
    report: any,
    userMap: Map<string, SerializedUser>,
    messageMap: Map<
      string,
      {
        userId: string;
        userName: string;
        conversationId: string;
        preview: string;
        participantNames: string[];
      }
    >,
    conversationMap: Map<
      string,
      {
        preview: string;
        participantNames: string[];
      }
    >,
  ): AdminDashboardReport {
    const reporter = report.reporter
      ? this.serializeReviewAuthor(report.reporter)
      : undefined;
    const targetUser =
      report.targetType === 'user' ? userMap.get(report.targetId) : undefined;
    const targetMessage =
      report.targetType === 'message'
        ? messageMap.get(report.targetId)
        : undefined;
    const targetConversation =
      report.targetType === 'conversation'
        ? conversationMap.get(report.targetId)
        : undefined;

    return {
      id: report.id,
      targetType: report.targetType,
      targetId: report.targetId,
      reason: report.reason,
      status: report.status?.toUpperCase?.() ?? 'PENDING',
      reporterId: report.reporterId,
      reporterName: reporter?.name ?? report.reporter?.email ?? '',
      createdAt:
        report.createdAt?.toISOString?.() ?? String(report.createdAt ?? ''),
      reporter,
      targetUserId: targetUser?.id ?? targetMessage?.userId ?? undefined,
      targetUserName:
        targetUser?.name ?? targetMessage?.userName ?? undefined,
      targetConversationId:
        targetMessage?.conversationId ??
        (report.targetType === 'conversation' ? report.targetId : undefined),
      targetMessagePreview:
        targetMessage?.preview ?? targetConversation?.preview ?? undefined,
      targetParticipantNames:
        targetMessage?.participantNames ??
        targetConversation?.participantNames ??
        undefined,
    };
  }
}
