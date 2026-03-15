import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  serializeHubItem,
  serializeUser,
} from '../../common/serializers/serialize';
import { ApplicationsService } from '../applications/applications.service';

@Injectable()
export class ExpertService {
  constructor(
    private prisma: PrismaService,
    private applicationsService: ApplicationsService,
  ) {}

  async getDashboard(userId: string) {
    const [myContents, collaborationItems, enterpriseConnections] = await Promise.all([
      this.prisma.hubItem.findMany({
        where: {
          authorUserId: userId,
          deletedAt: null,
        },
        include: {
          hubItemTags: { include: { tag: true } },
          author: {
            select: { id: true, role: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.hubItem.findMany({
        where: {
          deletedAt: null,
          reviewStatus: 'published',
          type: 'project',
          authorUserId: { not: userId },
        },
        include: {
          hubItemTags: { include: { tag: true } },
          author: {
            include: {
              profile: {
                include: {
                  profileTags: { include: { tag: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
      this.prisma.user.findMany({
        where: {
          role: 'ENTERPRISE_LEADER',
          status: 'active',
          deletedAt: null,
        },
        include: {
          profile: {
            include: {
              profileTags: { include: { tag: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
    ]);

    const serializedInboundApplications =
      myContents.length > 0
        ? await this.applicationsService.listForTargets(
            myContents.map((item) => ({
              targetType: 'hub_project',
              targetId: item.id,
            })),
          )
        : [];

    return {
      stats: {
        totalContentCount: myContents.length,
        totalViews: myContents.reduce((sum, item) => sum + (item.viewsCount ?? 0), 0),
        totalLikes: myContents.reduce((sum, item) => sum + (item.likesCount ?? 0), 0),
        pendingApplicantCount: serializedInboundApplications.filter(
          (app) => app.status === 'SUBMITTED',
        ).length,
      },
      myContents: myContents.map((item) => serializeHubItem(item)),
      collaborationOpportunities: collaborationItems.map((item) => ({
        ...serializeHubItem(item),
        author: item.author ? serializeUser(item.author, { maskEmail: true }) : undefined,
      })),
      inboundApplications: serializedInboundApplications,
      enterpriseConnections: enterpriseConnections.map((enterprise) =>
        serializeUser(enterprise, { maskEmail: true }),
      ),
    };
  }

  async create(data: { title: string; summary?: string; neededSupport?: string; tags?: string[] }, userId: string) {
    return this.prisma.researchProject.create({
      data: {
        title: data.title,
        summary: data.summary,
        neededSupport: data.neededSupport,
        tags: data.tags as any,
        expertUserId: userId,
        reviewStatus: 'draft',
      },
    });
  }

  async submit(id: string, userId: string) {
    const project = await this.prisma.researchProject.findUnique({ where: { id, deletedAt: null } });
    if (!project) throw new NotFoundException();
    if (project.expertUserId !== userId) throw new ForbiddenException();
    if (project.reviewStatus !== 'draft') throw new BadRequestException('Only drafts can be submitted');

    return this.prisma.researchProject.update({
      where: { id },
      data: { reviewStatus: 'pending_review' },
    });
  }

  async listMine(userId: string) {
    return this.prisma.researchProject.findMany({
      where: { expertUserId: userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getApplications(id: string, userId: string) {
    const project = await this.prisma.researchProject.findUnique({ where: { id } });
    if (!project) throw new NotFoundException();
    if (project.expertUserId !== userId) throw new ForbiddenException();

    return this.applicationsService.listForTargets([
      { targetType: 'research_project', targetId: id },
    ]);
  }
}
