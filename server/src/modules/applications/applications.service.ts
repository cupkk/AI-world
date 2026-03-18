import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
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
  contentDomain: string;
  title: string;
  status?: string;
  ownerId: string;
};

type ApplicationAuditFlag =
  | 'STALE_SUBMITTED'
  | 'OWNER_MISSING'
  | 'TARGET_UNAVAILABLE'
  | 'TARGET_NOT_PUBLISHED'
  | 'APPLICANT_SUSPENDED'
  | 'OWNER_SUSPENDED';

type ApplicationAuditGovernanceAction =
  | 'MARK_REVIEWED'
  | 'REJECT_APPLICATION'
  | 'REJECT_TARGET_CONTENT'
  | 'SUSPEND_APPLICANT'
  | 'SUSPEND_OWNER';

type ApplicationAuditGovernanceState = 'OPEN' | 'REVIEWED';

type ApplicationAuditLogSummary = {
  action: ApplicationAuditGovernanceAction;
  actorId: string;
  actorName?: string;
  createdAt: string;
  reason?: string;
};

const APPLICATION_AUDIT_ACTION_TO_LOG_ACTION: Record<
  ApplicationAuditGovernanceAction,
  string
> = {
  MARK_REVIEWED: 'application_audit_mark_reviewed',
  REJECT_APPLICATION: 'application_audit_reject_application',
  REJECT_TARGET_CONTENT: 'application_audit_reject_target_content',
  SUSPEND_APPLICANT: 'application_audit_suspend_applicant',
  SUSPEND_OWNER: 'application_audit_suspend_owner',
};

const DEFAULT_TARGET_GOVERNANCE_REASON =
  'Rejected during application audit governance.';

const APPLICATION_AUDIT_LOG_ACTION_TO_ACTION = Object.fromEntries(
  Object.entries(APPLICATION_AUDIT_ACTION_TO_LOG_ACTION).map(
    ([action, logAction]) => [logAction, action as ApplicationAuditGovernanceAction],
  ),
) as Record<string, ApplicationAuditGovernanceAction>;

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

    if (existing?.status === 'rejected') {
      return this.prisma.application.update({
        where: { id: existing.id },
        data: {
          message: data.message,
          status: 'submitted',
        },
      });
    }

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

    const serialized = await this.serializeApplicationsWithTargets(applications);
    const governanceTimelineByApplicationId =
      await this.buildGovernanceTimelineMap(applications);
    return serialized.map((application) => {
      const flags = this.buildAuditFlags(application);
      const governanceTimeline =
        governanceTimelineByApplicationId.get(application.id) ?? [];
      const latestGovernanceAction = governanceTimeline[0];
      return {
        ...application,
        ageInDays: this.calculateAgeInDays(application.createdAt),
        auditFlags: flags,
        governanceState: latestGovernanceAction ? 'REVIEWED' : 'OPEN',
        latestGovernanceAction,
        governanceTimeline,
      };
    });
  }

  async applyAuditAction(
    ids: string[],
    action: ApplicationAuditGovernanceAction,
    adminId: string,
    reason?: string,
  ) {
    const applicationIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
    if (applicationIds.length === 0) {
      throw new BadRequestException('No application ids provided');
    }

    const applications = await this.prisma.application.findMany({
      where: { id: { in: applicationIds } },
      include: {
        applicant: {
          include: this.userInclude,
        },
      },
    });

    if (applications.length !== applicationIds.length) {
      throw new NotFoundException('One or more applications were not found');
    }

    const targetSummaryMap = await this.buildTargetSummaryMap(applications);
    const normalizedReason = reason?.trim();
    const actionReason =
      normalizedReason ||
      (action === 'REJECT_TARGET_CONTENT'
        ? DEFAULT_TARGET_GOVERNANCE_REASON
        : undefined);
    const processedTargetGovernanceKeys = new Set<string>();

    for (const application of applications) {
      const targetSummary = targetSummaryMap.get(this.targetKey(application));

      if (action === 'REJECT_APPLICATION' && application.status !== 'rejected') {
        await this.prisma.application.update({
          where: { id: application.id },
          data: { status: 'rejected' },
        });
      }

      if (action === 'SUSPEND_APPLICANT') {
        await this.prisma.user.update({
          where: { id: application.applicantUserId },
          data: { status: 'suspended' },
        });
      }

      if (action === 'SUSPEND_OWNER') {
        if (!targetSummary?.ownerId) {
          throw new BadRequestException(
            `Application ${application.id} has no target owner to suspend`,
          );
        }

        await this.prisma.user.update({
          where: { id: targetSummary.ownerId },
          data: { status: 'suspended' },
        });
      }

      if (action === 'REJECT_TARGET_CONTENT') {
        await this.rejectAuditTargetContent(
          application,
          targetSummary,
          adminId,
          actionReason ?? DEFAULT_TARGET_GOVERNANCE_REASON,
          processedTargetGovernanceKeys,
        );
      }

      await this.prisma.auditLog.create({
        data: {
          actorId: adminId,
          action: APPLICATION_AUDIT_ACTION_TO_LOG_ACTION[action],
          targetType: 'application',
          targetId: application.id,
          metadata: {
            reason: actionReason ?? null,
            applicantUserId: application.applicantUserId,
            ownerUserId: targetSummary?.ownerId ?? null,
            applicationAction: action,
            governedTargetId: targetSummary?.id ?? application.targetId,
            governedTargetType:
              targetSummary?.targetType ??
              this.normalizeAuditTargetType(application.targetType),
          },
        },
      });
    }

    return {
      updatedIds: applicationIds,
    };
  }

  async updateStatus(id: string, status: ApplicationStatus, userId: string) {
    const app = await this.prisma.application.findUnique({ where: { id } });
    if (!app) throw new NotFoundException();

    const applicant = await this.prisma.user.findUnique({
      where: { id: app.applicantUserId },
      select: { status: true },
    });
    if (!applicant || applicant.status !== 'active') {
      throw new BadRequestException(
        'Applications can only be updated for active applicants',
      );
    }

    const targetOwnerState = await this.resolveTargetOwnerState(
      app.targetType,
      app.targetId,
    );
    if (!targetOwnerState || targetOwnerState.ownerId !== userId) {
      throw new ForbiddenException(
        'Only the target owner can update application status',
      );
    }
    if (targetOwnerState.reviewStatus !== 'published') {
      throw new BadRequestException(
        'Applications can only be updated for published targets',
      );
    }

    return this.prisma.application.update({
      where: { id },
      data: { status },
    });
  }

  private async resolveTargetOwnerState(
    targetType: ApplicationTargetType,
    targetId: string,
  ): Promise<{ ownerId: string; reviewStatus: string } | null> {
    switch (targetType) {
      case 'enterprise_need': {
        const need = await this.prisma.enterpriseNeed.findUnique({
          where: { id: targetId },
        });
        return need
          ? {
              ownerId: need.enterpriseUserId,
              reviewStatus: need.reviewStatus ?? 'published',
            }
          : null;
      }
      case 'research_project': {
        const project = await this.prisma.researchProject.findUnique({
          where: { id: targetId },
        });
        return project
          ? {
              ownerId: project.expertUserId,
              reviewStatus: project.reviewStatus ?? 'published',
            }
          : null;
      }
      case 'hub_project': {
        const item = await this.prisma.hubItem.findUnique({
          where: { id: targetId },
        });
        return item
          ? {
              ownerId: item.authorUserId ?? '',
              reviewStatus: item.reviewStatus ?? 'published',
            }
          : null;
      }
      default:
        return null;
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
        contentDomain: serializedNeed.contentDomain,
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
        contentDomain: serializedProject.contentDomain,
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
        contentDomain: serializedItem.contentDomain,
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
        contentDomain: target?.contentDomain ?? 'HUB_ITEM',
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

  private buildAuditFlags(application: {
    status: string;
    createdAt: string;
    applicant?: { status?: string };
    owner?: { status?: string } | unknown;
    target: { title?: string; ownerId?: string; status?: string };
  }): ApplicationAuditFlag[] {
    const flags: ApplicationAuditFlag[] = [];

    if (application.status === 'SUBMITTED' && this.calculateAgeInDays(application.createdAt) >= 7) {
      flags.push('STALE_SUBMITTED');
    }

    if (!application.owner || !application.target.ownerId) {
      flags.push('OWNER_MISSING');
    }

    if (application.target.title === 'Unavailable target') {
      flags.push('TARGET_UNAVAILABLE');
    }

    if (
      application.target.status &&
      application.target.status !== 'PUBLISHED'
    ) {
      flags.push('TARGET_NOT_PUBLISHED');
    }

    if (application.applicant?.status === 'suspended') {
      flags.push('APPLICANT_SUSPENDED');
    }

    if (
      typeof application.owner === 'object' &&
      application.owner &&
      'status' in application.owner &&
      application.owner.status === 'suspended'
    ) {
      flags.push('OWNER_SUSPENDED');
    }

    return flags;
  }

  private async buildGovernanceTimelineMap(
    applications: ApplicationWithApplicant[],
  ) {
    if (applications.length === 0) {
      return new Map<string, ApplicationAuditLogSummary[]>();
    }

    const applicationIds = applications.map((application) => application.id);
    const logs = await this.prisma.auditLog.findMany({
      where: {
        targetType: 'application',
        targetId: { in: applicationIds },
        action: {
          in: Object.values(APPLICATION_AUDIT_ACTION_TO_LOG_ACTION),
        },
      },
      include: {
        actor: {
          include: this.userInclude,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const timelineByApplicationId = new Map<
      string,
      ApplicationAuditLogSummary[]
    >();

    for (const log of logs) {
      if (!log.targetId) {
        continue;
      }

      const normalizedAction =
        APPLICATION_AUDIT_LOG_ACTION_TO_ACTION[log.action];
      if (!normalizedAction) {
        continue;
      }

      const metadata =
        log.metadata && typeof log.metadata === 'object'
          ? (log.metadata as Record<string, unknown>)
          : undefined;

      const actorName = log.actor
        ? serializeUser(log.actor, { maskEmail: true }).name
        : undefined;
      const timeline = timelineByApplicationId.get(log.targetId) ?? [];

      if (timeline.length >= 5) {
        continue;
      }

      timeline.push({
        action: normalizedAction,
        actorId: log.actorId,
        actorName,
        createdAt: log.createdAt.toISOString(),
        reason:
          typeof metadata?.reason === 'string' ? metadata.reason : undefined,
      });
      timelineByApplicationId.set(log.targetId, timeline);
    }

    return timelineByApplicationId;
  }

  private async rejectAuditTargetContent(
    application: ApplicationWithApplicant,
    targetSummary:
      | (ApplicationTargetSummary & {
          owner?: ReturnType<typeof serializeUser>;
        })
      | undefined,
    adminId: string,
    reason: string,
    processedTargetGovernanceKeys: Set<string>,
  ) {
    if (!targetSummary) {
      throw new BadRequestException(
        `Application ${application.id} has no available target content to reject`,
      );
    }

    const targetGovernanceKey = this.targetKey(application);
    if (processedTargetGovernanceKeys.has(targetGovernanceKey)) {
      return;
    }

    switch (application.targetType) {
      case 'enterprise_need':
        await this.prisma.enterpriseNeed.update({
          where: { id: application.targetId },
          data: {
            reviewStatus: 'rejected',
            rejectReason: reason,
          },
        });
        break;
      case 'research_project':
        await this.prisma.researchProject.update({
          where: { id: application.targetId },
          data: {
            reviewStatus: 'rejected',
            rejectReason: reason,
          },
        });
        break;
      case 'hub_project':
        await this.prisma.hubItem.update({
          where: { id: application.targetId },
          data: {
            reviewStatus: 'rejected',
            rejectReason: reason,
          },
        });
        break;
      default:
        throw new BadRequestException(
          `Application ${application.id} has an unsupported target type`,
        );
    }

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'reject',
        targetType: this.toReviewTargetType(application.targetType),
        targetId: application.targetId,
        metadata: {
          reason,
          source: 'application_audit',
          sourceApplicationId: application.id,
        },
      },
    });

    processedTargetGovernanceKeys.add(targetGovernanceKey);
  }

  private calculateAgeInDays(createdAt: string) {
    const createdAtDate = new Date(createdAt);
    if (Number.isNaN(createdAtDate.getTime())) {
      return 0;
    }

    const elapsed = Date.now() - createdAtDate.getTime();
    return Math.max(0, Math.floor(elapsed / (1000 * 60 * 60 * 24)));
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

  private toReviewTargetType(targetType: ApplicationTargetType) {
    switch (targetType) {
      case 'enterprise_need':
        return 'enterprise_need';
      case 'research_project':
        return 'research_project';
      case 'hub_project':
        return 'hub_item';
      default:
        throw new BadRequestException('Unknown target type');
    }
  }

  private normalizeAuditTargetType(targetType: ApplicationTargetType) {
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
}
