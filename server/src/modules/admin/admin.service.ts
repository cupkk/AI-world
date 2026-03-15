import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  normalizeContentStatusValue,
  normalizeContentTypeValue,
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

    const serializedReports = reports.map((report) =>
      this.serializeDashboardReport(report),
    );

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

    return reports.map((report) => this.serializeDashboardReport(report));
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

  private serializeDashboardReport(report: any): AdminDashboardReport {
    const reporter = report.reporter
      ? this.serializeReviewAuthor(report.reporter)
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
    };
  }
}
