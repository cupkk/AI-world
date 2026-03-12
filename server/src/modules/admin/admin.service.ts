import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  serializeHubItem,
  serializeEnterpriseNeed,
  serializeResearchProject,
  SerializedContent,
} from '../../common/serializers/serialize';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

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
    return this.prisma.report.findMany({
      where: { status: 'pending' },
      include: { reporter: true },
      orderBy: { createdAt: 'desc' },
    });
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
}
