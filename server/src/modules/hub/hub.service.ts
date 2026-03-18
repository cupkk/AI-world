import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { QueryHubDto } from './hub.dto';
import { Prisma } from '@prisma/client';
import { normalizeContentTypeValue } from '../../common/contracts';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import {
  serializeApplication,
  serializeEnterpriseNeed,
  serializeHubItem,
  serializeResearchProject,
  serializeUser,
} from '../../common/serializers/serialize';

type HubDetailViewer = Pick<CurrentUserPayload, 'id' | 'role'>;
type ContentDetailSectionKind =
  | 'SUMMARY'
  | 'BACKGROUND'
  | 'GOAL'
  | 'DELIVERABLES'
  | 'NEEDED_SUPPORT';

@Injectable()
export class HubService {
  constructor(private prisma: PrismaService) {}

  private readonly authorInclude = {
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

  private async findHubItem(id: string) {
    const item = await this.prisma.hubItem.findUnique({
      where: { id, deletedAt: null },
      include: {
        hubItemTags: { include: { tag: true } },
        author: {
          include: this.authorInclude,
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Hub item not found');
    }

    return item;
  }

  private assertCanViewHubItem(
    item: { reviewStatus: string; authorUserId?: string | null },
    viewer?: HubDetailViewer,
  ) {
    const isAdmin = viewer?.role === 'ADMIN';
    const isAuthor = !!viewer?.id && viewer.id === item.authorUserId;

    if (item.reviewStatus !== 'published' && !isAdmin && !isAuthor) {
      throw new NotFoundException('Hub item not found');
    }
  }

  private assertCanViewEnterpriseNeed(
    need: {
      reviewStatus: string;
      enterpriseUserId?: string | null;
      visibility?: string | null;
    },
    viewer?: HubDetailViewer,
  ) {
    const isAdmin = viewer?.role === 'ADMIN';
    const isAuthor = !!viewer?.id && viewer.id === need.enterpriseUserId;

    if (need.reviewStatus !== 'published' && !isAdmin && !isAuthor) {
      throw new NotFoundException('Content not found');
    }

    const role = viewer?.role;
    const canSeeRestrictedNeed =
      isAdmin ||
      isAuthor ||
      role === 'EXPERT' ||
      role === 'LEARNER';

    if (
      need.visibility === 'experts_and_learners' &&
      !canSeeRestrictedNeed
    ) {
      throw new NotFoundException('Content not found');
    }
  }

  private assertCanViewResearchProject(
    project: { reviewStatus: string; expertUserId?: string | null },
    viewer?: HubDetailViewer,
  ) {
    const isAdmin = viewer?.role === 'ADMIN';
    const isAuthor = !!viewer?.id && viewer.id === project.expertUserId;

    if (project.reviewStatus !== 'published' && !isAdmin && !isAuthor) {
      throw new NotFoundException('Content not found');
    }
  }

  private bumpViews(id: string) {
    this.prisma.hubItem
      .update({
        where: { id },
        data: { viewsCount: { increment: 1 } },
      })
      .catch(() => {
        // best-effort only
      });
  }

  private buildDetailSections(
    sections: Array<{
      kind: ContentDetailSectionKind;
      content?: string | null;
    }>,
  ) {
    return sections
      .map((section) => ({
        kind: section.kind,
        content: section.content?.trim() ?? '',
      }))
      .filter((section) => section.content.length > 0);
  }

  private async buildHubRelatedContents(item: any) {
    const tagIds = item.hubItemTags
      .map((hubItemTag: { tagId?: string | null }) => hubItemTag.tagId)
      .filter(
        (tagId: string | null | undefined): tagId is string =>
          typeof tagId === 'string' && tagId.length > 0,
      );

    const relatedItems = await this.prisma.hubItem.findMany({
      where: {
        deletedAt: null,
        reviewStatus: 'published',
        id: { not: item.id },
        OR: [
          { type: item.type },
          ...(tagIds.length > 0
            ? [
                {
                  hubItemTags: {
                    some: {
                      tagId: { in: tagIds },
                    },
                  },
                },
              ]
            : []),
        ],
      },
      include: {
        hubItemTags: { include: { tag: true } },
        author: {
          include: this.authorInclude,
        },
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 4,
    });

    return relatedItems.map(serializeHubItem);
  }

  private async buildEnterpriseNeedRelatedContents(
    need: any,
    viewer?: HubDetailViewer,
  ) {
    const where: Prisma.EnterpriseNeedWhereInput = {
      deletedAt: null,
      reviewStatus: 'published',
      id: { not: need.id },
    };

    const canSeeRestrictedNeed =
      viewer?.role === 'ADMIN' ||
      viewer?.role === 'EXPERT' ||
      viewer?.role === 'LEARNER';

    if (!canSeeRestrictedNeed) {
      where.visibility = 'public_all';
    }

    const relatedNeeds = await this.prisma.enterpriseNeed.findMany({
      where,
      include: {
        enterprise: {
          include: this.authorInclude,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 4,
    });

    return relatedNeeds.map(serializeEnterpriseNeed);
  }

  private async buildResearchProjectRelatedContents(project: any) {
    const relatedProjects = await this.prisma.researchProject.findMany({
      where: {
        deletedAt: null,
        reviewStatus: 'published',
        id: { not: project.id },
      },
      include: {
        expert: {
          include: this.authorInclude,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 4,
    });

    return relatedProjects.map(serializeResearchProject);
  }

  private async resolveDetailContext(id: string, viewer?: HubDetailViewer) {
    const hubItem = await this.prisma.hubItem.findUnique({
      where: { id, deletedAt: null },
      include: {
        hubItemTags: { include: { tag: true } },
        author: {
          include: this.authorInclude,
        },
      },
    });

    if (hubItem) {
      this.assertCanViewHubItem(hubItem, viewer);
      this.bumpViews(hubItem.id);

      return {
        content: serializeHubItem(hubItem),
        author: hubItem.author
          ? serializeUser(hubItem.author, { maskEmail: true })
          : undefined,
        relatedContents: await this.buildHubRelatedContents(hubItem),
        detailSections: this.buildDetailSections([
          {
            kind: 'SUMMARY',
            content: hubItem.summary ?? hubItem.contentRich ?? '',
          },
        ]),
        applicationTargetType:
          hubItem.type === 'project' || hubItem.type === 'contest'
            ? ('PROJECT' as const)
            : null,
        backendApplicationTargetType:
          hubItem.type === 'project' || hubItem.type === 'contest'
            ? ('hub_project' as const)
            : null,
      };
    }

    const enterpriseNeed = await this.prisma.enterpriseNeed.findUnique({
      where: { id, deletedAt: null },
      include: {
        enterprise: {
          include: this.authorInclude,
        },
      },
    });

    if (enterpriseNeed) {
      this.assertCanViewEnterpriseNeed(enterpriseNeed, viewer);

      return {
        content: serializeEnterpriseNeed(enterpriseNeed),
        author: enterpriseNeed.enterprise
          ? serializeUser(enterpriseNeed.enterprise, { maskEmail: true })
          : undefined,
        relatedContents: await this.buildEnterpriseNeedRelatedContents(
          enterpriseNeed,
          viewer,
        ),
        detailSections: this.buildDetailSections([
          { kind: 'BACKGROUND', content: enterpriseNeed.background },
          { kind: 'GOAL', content: enterpriseNeed.goal },
          { kind: 'DELIVERABLES', content: enterpriseNeed.deliverables },
        ]),
        applicationTargetType: 'ENTERPRISE_NEED' as const,
        backendApplicationTargetType: 'enterprise_need' as const,
      };
    }

    const researchProject = await this.prisma.researchProject.findUnique({
      where: { id, deletedAt: null },
      include: {
        expert: {
          include: this.authorInclude,
        },
      },
    });

    if (researchProject) {
      this.assertCanViewResearchProject(researchProject, viewer);

      return {
        content: serializeResearchProject(researchProject),
        author: researchProject.expert
          ? serializeUser(researchProject.expert, { maskEmail: true })
          : undefined,
        relatedContents: await this.buildResearchProjectRelatedContents(
          researchProject,
        ),
        detailSections: this.buildDetailSections([
          { kind: 'SUMMARY', content: researchProject.summary },
          {
            kind: 'NEEDED_SUPPORT',
            content: researchProject.neededSupport,
          },
        ]),
        applicationTargetType: 'RESEARCH_PROJECT' as const,
        backendApplicationTargetType: 'research_project' as const,
      };
    }

    throw new NotFoundException('Content not found');
  }

  async list(query: QueryHubDto, userRole?: string) {
    const { type, q, tags, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.HubItemWhereInput = {
      deletedAt: null,
    };

    if (userRole !== 'ADMIN') {
      where.reviewStatus = 'published';
    }

    if (type) {
      where.type = normalizeContentTypeValue(type).toLowerCase() as any;
    }

    if (q?.trim()) {
      const keyword = q.trim();
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

    if (tags) {
      const tagNames = tags.split(',').map((t) => t.trim());
      where.hubItemTags = {
        some: {
          tag: { name: { in: tagNames } },
        },
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.hubItem.findMany({
        where,
        include: {
          hubItemTags: { include: { tag: true } },
          author: {
            include: this.authorInclude,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.hubItem.count({ where }),
    ]);

    return {
      items: items.map(serializeHubItem),
      total,
      page,
      limit,
    };
  }

  async getById(id: string, viewer?: HubDetailViewer) {
    const item = await this.findHubItem(id);
    this.assertCanViewHubItem(item, viewer);
    this.bumpViews(id);
    return item;
  }

  async getDetail(id: string, viewer?: HubDetailViewer) {
    const detailContext = await this.resolveDetailContext(id, viewer);
    const { content, author, relatedContents, detailSections } = detailContext;
    let viewerApplication = null as Record<string, unknown> | null;
    const canApply =
      viewer?.id &&
      viewer.id !== content.authorId &&
      detailContext.applicationTargetType &&
      detailContext.backendApplicationTargetType;

    if (canApply) {
      const application = await this.prisma.application.findUnique({
        where: {
          applicantUserId_targetType_targetId: {
            applicantUserId: viewer.id,
            targetType: detailContext.backendApplicationTargetType!,
            targetId: content.id,
          },
        },
      });

      if (application) {
        viewerApplication = {
          ...serializeApplication(application),
          target: {
            id: content.id,
            targetType: detailContext.applicationTargetType!,
            contentType: content.type,
            contentDomain: content.contentDomain,
            title: content.title,
            status: content.status,
            ownerId: content.authorId,
          },
          targetContentTitle: content.title,
          ...(author ? { owner: author } : {}),
        };
      }
    }

    return {
      content,
      author,
      relatedContents,
      viewerApplication,
      detailSections,
      applicationTargetType: detailContext.applicationTargetType,
    };
  }

  async toggleLike(id: string, _userId: string) {
    const item = await this.prisma.hubItem.findUnique({
      where: { id, deletedAt: null },
    });
    if (!item) throw new NotFoundException('Hub item not found');

    const updated = await this.prisma.hubItem.update({
      where: { id },
      data: { likesCount: { increment: 1 } },
      select: { likesCount: true },
    });
    return { likes: updated.likesCount };
  }
}
