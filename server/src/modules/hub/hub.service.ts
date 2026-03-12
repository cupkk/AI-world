import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateHubItemDto, UpdateHubItemDto, QueryHubDto } from './hub.dto';
import { Prisma } from '@prisma/client';
import { serializeHubItem } from '../../common/serializers/serialize';

@Injectable()
export class HubService {
  constructor(private prisma: PrismaService) {}

  async list(query: QueryHubDto, userRole?: string) {
    const { type, q, tags, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.HubItemWhereInput = {
      deletedAt: null,
    };

    // Non-admin users only see published items
    if (userRole !== 'ADMIN') {
      where.reviewStatus = 'published';
    }

    if (type) where.type = type;

    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { summary: { contains: q, mode: 'insensitive' } },
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
          author: { select: { id: true, role: true } },
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

  async getById(id: string) {
    const item = await this.prisma.hubItem.findUnique({
      where: { id, deletedAt: null },
      include: {
        hubItemTags: { include: { tag: true } },
        author: {
          select: { id: true, role: true },
          },
      },
    });

    if (!item) throw new NotFoundException('Hub item not found');

    // Increment view count (fire-and-forget)
    this.prisma.hubItem.update({
      where: { id },
      data: { viewsCount: { increment: 1 } },
    }).catch(() => { /* best-effort */ });

    return {
      ...item,
      tags: item.hubItemTags.map((ht) => ht.tag.name),
      hubItemTags: undefined,
    };
  }

  async create(dto: CreateHubItemDto, userId: string) {
    const { tags, ...data } = dto;

    const item = await this.prisma.hubItem.create({
      data: {
        ...data,
        authorUserId: userId,
        reviewStatus: 'draft',
      },
    });

    if (tags?.length) {
      await this.syncTags(item.id, tags);
    }

    return this.getById(item.id);
  }

  async update(id: string, dto: UpdateHubItemDto, userId: string) {
    const item = await this.prisma.hubItem.findUnique({
      where: { id, deletedAt: null },
    });

    if (!item) throw new NotFoundException('Hub item not found');
    if (item.authorUserId !== userId) {
      throw new ForbiddenException('You can only edit your own items');
    }
    if (item.reviewStatus !== 'draft' && item.reviewStatus !== 'rejected') {
      throw new BadRequestException('Only draft or rejected items can be edited');
    }

    const { tags, ...data } = dto;

    await this.prisma.hubItem.update({
      where: { id },
      data,
    });

    if (tags !== undefined) {
      await this.syncTags(id, tags);
    }

    return this.getById(id);
  }

  async submitForReview(id: string, userId: string) {
    const item = await this.prisma.hubItem.findUnique({
      where: { id, deletedAt: null },
    });

    if (!item) throw new NotFoundException('Hub item not found');
    if (item.authorUserId !== userId) {
      throw new ForbiddenException('You can only submit your own items');
    }
    if (item.reviewStatus !== 'draft' && item.reviewStatus !== 'rejected') {
      throw new BadRequestException('Only draft or rejected items can be submitted for review');
    }

    await this.prisma.hubItem.update({
      where: { id },
      data: { reviewStatus: 'pending_review', rejectReason: null },
    });

    return this.getById(id);
  }

  /**
   * List all items authored by a specific user (all statuses)
   */
  async listByAuthor(userId: string) {
    const items = await this.prisma.hubItem.findMany({
      where: { authorUserId: userId, deletedAt: null },
      include: {
        hubItemTags: { include: { tag: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return items;
  }

  async softDelete(id: string, userId: string, userRole: string) {
    const item = await this.prisma.hubItem.findUnique({
      where: { id, deletedAt: null },
    });

    if (!item) throw new NotFoundException('Hub item not found');
    if (item.authorUserId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('You can only delete your own items');
    }

    return this.prisma.hubItem.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Toggle like on a hub item (simple increment/decrement without per-user tracking)
   * Returns the new likes count.
   */
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

  private async syncTags(hubItemId: string, tagNames: string[]) {
    await this.prisma.hubItemTag.deleteMany({ where: { hubItemId } });

    for (const name of tagNames) {
      const tag = await this.prisma.tag.upsert({
        where: { name },
        update: {},
        create: { name },
      });

      await this.prisma.hubItemTag.create({
        data: { hubItemId, tagId: tag.id },
      });
    }
  }
}
