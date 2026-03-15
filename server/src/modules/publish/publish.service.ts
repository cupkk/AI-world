import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreatePublishItemDto, UpdatePublishItemDto } from './publish.dto';

@Injectable()
export class PublishService {
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

  async createDraft(dto: CreatePublishItemDto, userId: string) {
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

    return this.getItemDetail(item.id);
  }

  async updateDraft(id: string, dto: UpdatePublishItemDto, userId: string) {
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

    return this.getItemDetail(id);
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
      throw new BadRequestException(
        'Only draft or rejected items can be submitted for review',
      );
    }

    await this.prisma.hubItem.update({
      where: { id },
      data: { reviewStatus: 'pending_review', rejectReason: null },
    });

    return this.getItemDetail(id);
  }

  async moveToDraft(id: string, userId: string) {
    const item = await this.prisma.hubItem.findUnique({
      where: { id, deletedAt: null },
    });

    if (!item) throw new NotFoundException('Hub item not found');
    if (item.authorUserId !== userId) {
      throw new ForbiddenException('You can only edit your own items');
    }
    if (item.reviewStatus === 'draft') {
      return this.getItemDetail(id);
    }
    if (item.reviewStatus !== 'rejected') {
      throw new BadRequestException(
        'Only rejected items can be moved back to draft',
      );
    }

    await this.prisma.hubItem.update({
      where: { id },
      data: { reviewStatus: 'draft', rejectReason: null },
    });

    return this.getItemDetail(id);
  }

  async listMine(userId: string) {
    return this.prisma.hubItem.findMany({
      where: { authorUserId: userId, deletedAt: null },
      include: {
        hubItemTags: { include: { tag: true } },
        author: {
          include: this.authorInclude,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
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

  private async getItemDetail(id: string) {
    const item = await this.prisma.hubItem.findUnique({
      where: { id, deletedAt: null },
      include: {
        hubItemTags: { include: { tag: true } },
        author: {
          include: this.authorInclude,
        },
      },
    });

    if (!item) throw new NotFoundException('Hub item not found');

    return {
      ...item,
      tags: item.hubItemTags.map((ht) => ht.tag.name),
      hubItemTags: undefined,
    };
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
