import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ApplicationTargetType, ApplicationStatus } from '@prisma/client';
import {
  serializeApplication,
  serializeEnterpriseNeed,
  serializeHubItem,
  serializeResearchProject,
  serializeUser,
} from '../../common/serializers/serialize';

type ApplicationWithApplicant = {
  id: string;
  targetType: ApplicationTargetType;
  targetId: string;
  message?: string | null;
  status: ApplicationStatus;
  createdAt: Date | string;
  applicantUserId: string;
  applicant?: any;
};

type ApplicationTargetQuery = {
  targetType: ApplicationTargetType;
  targetId: string;
};

type ApplicationTargetSummary = {
  id: string;
  targetType: 'ENTERPRISE_NEED' | 'RESEARCH_PROJECT' | 'PROJECT';
  contentType: string;
  title: string;
  status?: string;
  ownerId: string;
};

@Injectable()
export class ApplicationsService {
  constructor(private prisma: PrismaService) {}

  private readonly userInclude = {
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

  async create(data: {
    targetType: ApplicationTargetType;
    targetId: string;
    message?: string;
  }, userId: string) {
    // Check for duplicate application
    const existing = await this.prisma.application.findUnique({
      where: {
        applicantUserId_targetType_targetId: {
          applicantUserId: userId,
          targetType: data.targetType,
          targetId: data.targetId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('You have already applied');
    }

    return this.prisma.application.create({
      data: {
        ...data,
        applicantUserId: userId,
        status: 'submitted',
      },
    });
  }

  async listMine(userId: string) {
    return this.listOutbox(userId);
  }

  async listOutbox(userId: string) {
    const applications = await this.prisma.application.findMany({
      where: { applicantUserId: userId },
      orderBy: { createdAt: 'desc' },
    });

    return this.serializeApplicationsWithTargets(applications);
  }

  async listInbox(userId: string) {
    const ownedTargets = await this.buildOwnedTargets(userId);
    return this.listForTargets(ownedTargets);
  }

  async listForTargets(targets: ApplicationTargetQuery[]) {
    const targetFilters = this.groupTargetFilters(targets);
    if (targetFilters.length === 0) {
      return [];
    }

    const applications = await this.prisma.application.findMany({
      where: {
        OR: targetFilters,
      },
      include: {
        applicant: {
          include: this.userInclude,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return this.serializeApplicationsWithTargets(applications);
  }

  async listAudit() {
    const applications = await this.prisma.application.findMany({
      include: {
        applicant: {
          include: this.userInclude,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return this.serializeApplicationsWithTargets(applications);
  }

  async updateStatus(id: string, status: ApplicationStatus, userId: string) {
    const app = await this.prisma.application.findUnique({ where: { id } });
    if (!app) throw new NotFoundException();

    // Verify ownership of target
    const isOwner = await this.verifyTargetOwner(app.targetType, app.targetId, userId);
    if (!isOwner) throw new ForbiddenException('Only the target owner can update application status');

    return this.prisma.application.update({
      where: { id },
      data: { status },
    });
  }

  private async verifyTargetOwner(
    targetType: ApplicationTargetType,
    targetId: string,
    userId: string,
  ): Promise<boolean> {
    switch (targetType) {
      case 'enterprise_need': {
        const need = await this.prisma.enterpriseNeed.findUnique({ where: { id: targetId } });
        return need?.enterpriseUserId === userId;
      }
      case 'research_project': {
        const project = await this.prisma.researchProject.findUnique({ where: { id: targetId } });
        return project?.expertUserId === userId;
      }
      case 'hub_project': {
        const item = await this.prisma.hubItem.findUnique({ where: { id: targetId } });
        return item?.authorUserId === userId;
      }
      default:
        return false;
    }
  }

  private async buildOwnedTargets(userId: string) {
    const [needs, projects, hubItems] = await Promise.all([
      this.prisma.enterpriseNeed.findMany({
        where: {
          enterpriseUserId: userId,
          deletedAt: null,
        },
        select: { id: true },
      }),
      this.prisma.researchProject.findMany({
        where: {
          expertUserId: userId,
          deletedAt: null,
        },
        select: { id: true },
      }),
      this.prisma.hubItem.findMany({
        where: {
          authorUserId: userId,
          deletedAt: null,
        },
        select: { id: true },
      }),
    ]);

    return [
      ...needs.map((item) => ({
        targetType: 'enterprise_need' as const,
        targetId: item.id,
      })),
      ...projects.map((item) => ({
        targetType: 'research_project' as const,
        targetId: item.id,
      })),
      ...hubItems.map((item) => ({
        targetType: 'hub_project' as const,
        targetId: item.id,
      })),
    ];
  }

  private groupTargetFilters(targets: ApplicationTargetQuery[]) {
    const idsByType = new Map<ApplicationTargetType, string[]>();

    for (const target of targets) {
      const ids = idsByType.get(target.targetType) ?? [];
      ids.push(target.targetId);
      idsByType.set(target.targetType, ids);
    }

    return Array.from(idsByType.entries()).map(([targetType, targetIds]) => ({
      targetType,
      targetId: { in: targetIds },
    }));
  }

  private async serializeApplicationsWithTargets(
    applications: ApplicationWithApplicant[],
  ) {
    const targetMap = await this.buildTargetSummaryMap(applications);
    return applications.map((application) =>
      this.serializeApplicationReadItem(application, targetMap.get(this.targetKey(application))),
    );
  }

  private async buildTargetSummaryMap(applications: ApplicationWithApplicant[]) {
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
      }
    }

    const [needs, researchProjects, hubItems] = await Promise.all([
      enterpriseNeedIds.size > 0
        ? this.prisma.enterpriseNeed.findMany({
            where: {
              id: { in: Array.from(enterpriseNeedIds) },
              deletedAt: null,
            },
            include: {
              enterprise: {
                include: this.userInclude,
              },
            },
          })
        : [],
      researchProjectIds.size > 0
        ? this.prisma.researchProject.findMany({
            where: {
              id: { in: Array.from(researchProjectIds) },
              deletedAt: null,
            },
            include: {
              expert: {
                include: this.userInclude,
              },
            },
          })
        : [],
      hubProjectIds.size > 0
        ? this.prisma.hubItem.findMany({
            where: {
              id: { in: Array.from(hubProjectIds) },
              deletedAt: null,
            },
            include: {
              hubItemTags: {
                include: {
                  tag: true,
                },
              },
              author: {
                include: this.userInclude,
              },
            },
          })
        : [],
    ]);

    const targetMap = new Map<string, ApplicationTargetSummary & { owner?: ReturnType<typeof serializeUser> }>();

    for (const need of needs) {
      const serializedNeed = serializeEnterpriseNeed(need);
      targetMap.set(this.targetKey('enterprise_need', need.id), {
        id: serializedNeed.id,
        targetType: 'ENTERPRISE_NEED',
        contentType: serializedNeed.type,
        title: serializedNeed.title,
        status: serializedNeed.status,
        ownerId: need.enterpriseUserId ?? '',
        owner: need.enterprise ? serializeUser(need.enterprise, { maskEmail: true }) : undefined,
      });
    }

    for (const project of researchProjects) {
      const serializedProject = serializeResearchProject(project);
      targetMap.set(this.targetKey('research_project', project.id), {
        id: serializedProject.id,
        targetType: 'RESEARCH_PROJECT',
        contentType: serializedProject.type,
        title: serializedProject.title,
        status: serializedProject.status,
        ownerId: project.expertUserId ?? '',
        owner: project.expert ? serializeUser(project.expert, { maskEmail: true }) : undefined,
      });
    }

    for (const item of hubItems) {
      const serializedItem = serializeHubItem(item);
      targetMap.set(this.targetKey('hub_project', item.id), {
        id: serializedItem.id,
        targetType: 'PROJECT',
        contentType: serializedItem.type,
        title: serializedItem.title,
        status: serializedItem.status,
        ownerId: item.authorUserId ?? '',
        owner: item.author ? serializeUser(item.author, { maskEmail: true }) : undefined,
      });
    }

    return targetMap;
  }

  private serializeApplicationReadItem(
    application: ApplicationWithApplicant,
    target?: ApplicationTargetSummary & { owner?: ReturnType<typeof serializeUser> },
  ) {
    return {
      ...serializeApplication(application),
      target: {
        id: target?.id ?? application.targetId,
        targetType: target?.targetType ?? 'PROJECT',
        contentType: target?.contentType ?? 'PROJECT',
        title: target?.title ?? 'Unavailable target',
        status: target?.status,
        ownerId: target?.ownerId ?? '',
      },
      targetContentTitle: target?.title ?? 'Unavailable target',
      ...(application.applicant
        ? { applicant: serializeUser(application.applicant, { maskEmail: true }) }
        : {}),
      ...(target?.owner ? { owner: target.owner } : {}),
    };
  }

  private targetKey(
    targetTypeOrApplication: ApplicationTargetType | ApplicationWithApplicant,
    targetId?: string,
  ) {
    if (typeof targetTypeOrApplication === 'object') {
      return `${targetTypeOrApplication.targetType}:${targetTypeOrApplication.targetId}`;
    }
    return `${targetTypeOrApplication}:${targetId ?? ''}`;
  }
}
