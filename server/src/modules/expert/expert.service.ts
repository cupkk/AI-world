import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  serializeHubItem,
  serializeEnterpriseNeed,
  serializeResearchProject,
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
    const [myHubItems, myResearchProjects, collaborationItems, enterpriseConnections] =
      await Promise.all([
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
        this.prisma.researchProject.findMany({
          where: {
            expertUserId: userId,
            deletedAt: null,
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.enterpriseNeed.findMany({
          where: {
            deletedAt: null,
            reviewStatus: 'published',
          },
          include: {
            enterprise: {
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

    const serializedMyContents = [
      ...myHubItems.map((item) => serializeHubItem(item)),
      ...myResearchProjects.map((item) => serializeResearchProject(item)),
    ].sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );

    const applicationTargets = [
      ...myHubItems
        .filter((item) => item.type === 'project' || item.type === 'contest')
        .map((item) => ({
          targetType: 'hub_project' as const,
          targetId: item.id,
        })),
      ...myResearchProjects.map((item) => ({
        targetType: 'research_project' as const,
        targetId: item.id,
      })),
    ];

    const serializedInboundApplications =
      applicationTargets.length > 0
        ? await this.applicationsService.listForTargets(
            applicationTargets,
          )
        : [];

    return {
      stats: {
        totalContentCount: serializedMyContents.length,
        totalViews: myHubItems.reduce((sum, item) => sum + (item.viewsCount ?? 0), 0),
        totalLikes: myHubItems.reduce((sum, item) => sum + (item.likesCount ?? 0), 0),
        pendingApplicantCount: serializedInboundApplications.filter(
          (app) => app.status === 'SUBMITTED',
        ).length,
      },
      myContents: serializedMyContents,
      collaborationOpportunities: collaborationItems.map((item) => ({
        ...serializeEnterpriseNeed(item),
        author: item.enterprise
          ? serializeUser(item.enterprise, { maskEmail: true })
          : undefined,
      })),
      inboundApplications: serializedInboundApplications,
      enterpriseConnections: enterpriseConnections.map((enterprise) =>
        serializeUser(enterprise, { maskEmail: true }),
      ),
    };
  }

  async create(data: { title: string; summary?: string; neededSupport?: string; tags?: string[] }, userId: string) {
    const created = await this.prisma.researchProject.create({
      data: {
        title: data.title,
        summary: data.summary,
        neededSupport: data.neededSupport,
        tags: data.tags as any,
        expertUserId: userId,
        reviewStatus: 'draft',
      },
    });

    return serializeResearchProject(created);
  }

  async submit(id: string, userId: string) {
    const project = await this.prisma.researchProject.findUnique({ where: { id, deletedAt: null } });
    if (!project) throw new NotFoundException();
    if (project.expertUserId !== userId) throw new ForbiddenException();
    if (project.reviewStatus !== 'draft') throw new BadRequestException('Only drafts can be submitted');

    const updated = await this.prisma.researchProject.update({
      where: { id },
      data: { reviewStatus: 'pending_review' },
    });

    return serializeResearchProject(updated);
  }

  async listMine(userId: string) {
    const projects = await this.prisma.researchProject.findMany({
      where: { expertUserId: userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    return projects.map((project) => serializeResearchProject(project));
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
