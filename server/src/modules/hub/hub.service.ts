import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { QueryHubDto } from './hub.dto';
import { Prisma } from '@prisma/client';
import { normalizeContentTypeValue } from '../../common/contracts';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import {
  serializeApplication,
  serializeHubItem,
  serializeUser,
} from '../../common/serializers/serialize';

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

  private async findItemOrThrow(id: string) {
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

  private assertCanView(item: { reviewStatus: string; authorUserId?: string | null }, viewer?: Pick<CurrentUserPayload, 'id' | 'role'>) {
    const isAdmin = viewer?.role === 'ADMIN';
    const isAuthor = !!viewer?.id && viewer.id === item.authorUserId;

    if (item.reviewStatus !== 'published' && !isAdmin && !isAuthor) {
      throw new NotFoundException('Hub item not found');
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

  async getById(id: string, viewer?: Pick<CurrentUserPayload, 'id' | 'role'>) {
    const item = await this.findItemOrThrow(id);
    this.assertCanView(item, viewer);
    this.bumpViews(id);
    return item;
  }

  async getDetail(id: string, viewer?: Pick<CurrentUserPayload, 'id' | 'role'>) {
    const item = await this.getById(id, viewer);
    const content = serializeHubItem(item);
    const author = item.author
      ? serializeUser(item.author, { maskEmail: true })
      : undefined;

    const tagIds = item.hubItemTags
      .map((hubItemTag) => hubItemTag.tagId)
      .filter((tagId): tagId is string => typeof tagId === 'string' && tagId.length > 0);

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

    const relatedContents = relatedItems.map(serializeHubItem);

    let viewerApplication = null as Record<string, unknown> | null;
    const canApply =
      viewer?.id &&
      viewer.id !== content.authorId &&
      (content.type === 'PROJECT' || content.type === 'CONTEST');

    if (canApply) {
      const application = await this.prisma.application.findUnique({
        where: {
          applicantUserId_targetType_targetId: {
            applicantUserId: viewer.id,
            targetType: 'hub_project',
            targetId: item.id,
          },
        },
      });

      if (application) {
        viewerApplication = {
          ...serializeApplication(application),
          target: {
            id: content.id,
            targetType: 'PROJECT',
            contentType: content.type,
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
