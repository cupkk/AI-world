import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreatePublishItemDto, UpdatePublishItemDto } from './publish.dto';
import {
  SerializedContent,
  serializeEnterpriseNeed,
  serializeHubItem,
  serializeResearchProject,
} from '../../common/serializers/serialize';

type PublishContentKind = 'hub_item' | 'enterprise_need' | 'research_project';

type PublishContentRecord = {
  kind: PublishContentKind;
  authorId: string;
  reviewStatus: string;
};

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

  async createDraft(
    dto: CreatePublishItemDto,
    userId: string,
    userRole?: string,
  ): Promise<SerializedContent> {
    const kind = this.resolveCreateKind(dto.type, userRole);

    if (kind === 'enterprise_need') {
      const item = await this.prisma.enterpriseNeed.create({
        data: {
          title: dto.title,
          background: dto.background,
          goal: dto.goal,
          deliverables: dto.deliverables ?? dto.summary,
          requiredRoles: dto.tags as any,
          visibility: dto.visibility ?? 'public_all',
          enterpriseUserId: userId,
          reviewStatus: 'draft',
        },
      });

      return this.getItemDetail(item.id);
    }

    if (kind === 'research_project') {
      const item = await this.prisma.researchProject.create({
        data: {
          title: dto.title,
          summary: dto.summary,
          neededSupport: dto.neededSupport,
          tags: dto.tags as any,
          expertUserId: userId,
          reviewStatus: 'draft',
        },
      });

      return this.getItemDetail(item.id);
    }

    const { tags, ...data } = dto;

    const item = await this.prisma.hubItem.create({
      data: {
        title: data.title,
        summary: data.summary,
        type: data.type,
        contentRich: data.contentRich,
        coverUrl: data.coverUrl,
        sourceUrl: data.sourceUrl,
        authorUserId: userId,
        reviewStatus: 'draft',
      },
    });

    if (tags?.length) {
      await this.syncTags(item.id, tags);
    }

    return this.getItemDetail(item.id);
  }

  async getItemDetail(
    id: string,
    userId?: string,
    userRole?: string,
  ): Promise<SerializedContent> {
    const record = await this.findContentRecord(id);

    if (
      userId &&
      userRole !== 'ADMIN' &&
      record.authorId &&
      record.authorId !== userId
    ) {
      throw new NotFoundException('Content not found');
    }

    return this.getSerializedContentById(id);
  }

  async updateDraft(
    id: string,
    dto: UpdatePublishItemDto,
    userId: string,
  ): Promise<SerializedContent> {
    const item = await this.findContentRecord(id);

    if (item.authorId !== userId) {
      throw new ForbiddenException('You can only edit your own items');
    }
    if (
      item.reviewStatus !== 'draft' &&
      item.reviewStatus !== 'rejected' &&
      item.reviewStatus !== 'published'
    ) {
      throw new BadRequestException(
        'Only draft, rejected, or published items can be edited',
      );
    }

    if (item.kind === 'enterprise_need') {
      this.assertProjectOnlyType(dto.type);

      await this.prisma.enterpriseNeed.update({
        where: { id },
        data: {
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.background !== undefined ? { background: dto.background } : {}),
          ...(dto.goal !== undefined ? { goal: dto.goal } : {}),
          ...(dto.deliverables !== undefined
            ? { deliverables: dto.deliverables }
            : dto.summary !== undefined
              ? { deliverables: dto.summary }
              : {}),
          ...(dto.tags !== undefined ? { requiredRoles: dto.tags as any } : {}),
          ...(dto.visibility !== undefined ? { visibility: dto.visibility } : {}),
        },
      });

      return this.getItemDetail(id);
    }

    if (item.kind === 'research_project') {
      this.assertProjectOnlyType(dto.type);

      await this.prisma.researchProject.update({
        where: { id },
        data: {
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.summary !== undefined ? { summary: dto.summary } : {}),
          ...(dto.neededSupport !== undefined
            ? { neededSupport: dto.neededSupport }
            : {}),
          ...(dto.tags !== undefined ? { tags: dto.tags as any } : {}),
        },
      });

      return this.getItemDetail(id);
    }

    const { tags, ...data } = dto;

    await this.prisma.hubItem.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.summary !== undefined ? { summary: data.summary } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.contentRich !== undefined ? { contentRich: data.contentRich } : {}),
        ...(data.coverUrl !== undefined ? { coverUrl: data.coverUrl } : {}),
        ...(data.sourceUrl !== undefined ? { sourceUrl: data.sourceUrl } : {}),
      },
    });

    if (tags !== undefined) {
      await this.syncTags(id, tags);
    }

    return this.getItemDetail(id);
  }

  async submitForReview(id: string, userId: string): Promise<SerializedContent> {
    const item = await this.findContentRecord(id);

    if (item.authorId !== userId) {
      throw new ForbiddenException('You can only submit your own items');
    }
    if (item.reviewStatus !== 'draft' && item.reviewStatus !== 'rejected') {
      throw new BadRequestException(
        'Only draft or rejected items can be submitted for review',
      );
    }

    if (item.kind === 'enterprise_need') {
      await this.prisma.enterpriseNeed.update({
        where: { id },
        data: { reviewStatus: 'pending_review', rejectReason: null },
      });

      return this.getItemDetail(id);
    }

    if (item.kind === 'research_project') {
      await this.prisma.researchProject.update({
        where: { id },
        data: { reviewStatus: 'pending_review', rejectReason: null },
      });

      return this.getItemDetail(id);
    }

    await this.prisma.hubItem.update({
      where: { id },
      data: { reviewStatus: 'pending_review', rejectReason: null },
    });

    return this.getItemDetail(id);
  }

  async moveToDraft(id: string, userId: string): Promise<SerializedContent> {
    const item = await this.findContentRecord(id);

    if (item.authorId !== userId) {
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

    if (item.kind === 'enterprise_need') {
      await this.prisma.enterpriseNeed.update({
        where: { id },
        data: { reviewStatus: 'draft', rejectReason: null },
      });

      return this.getItemDetail(id);
    }

    if (item.kind === 'research_project') {
      await this.prisma.researchProject.update({
        where: { id },
        data: { reviewStatus: 'draft', rejectReason: null },
      });

      return this.getItemDetail(id);
    }

    await this.prisma.hubItem.update({
      where: { id },
      data: { reviewStatus: 'draft', rejectReason: null },
    });

    return this.getItemDetail(id);
  }

  async listMine(userId: string): Promise<SerializedContent[]> {
    const [hubItems, enterpriseNeeds, researchProjects] = await Promise.all([
      this.prisma.hubItem.findMany({
        where: {
          deletedAt: null,
          OR: [{ authorUserId: userId }, { adminUserId: userId }],
        },
        include: {
          hubItemTags: { include: { tag: true } },
          author: {
            include: this.authorInclude,
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.enterpriseNeed.findMany({
        where: { enterpriseUserId: userId, deletedAt: null },
        include: {
          enterprise: {
            include: this.authorInclude,
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.researchProject.findMany({
        where: { expertUserId: userId, deletedAt: null },
        include: {
          expert: {
            include: this.authorInclude,
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return [
      ...hubItems.map((item) => serializeHubItem(item)),
      ...enterpriseNeeds.map((item) => serializeEnterpriseNeed(item)),
      ...researchProjects.map((item) => serializeResearchProject(item)),
    ].sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
  }

  async softDelete(id: string, userId: string, userRole: string) {
    const item = await this.findContentRecord(id);

    if (item.authorId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('You can only delete your own items');
    }

    if (item.kind === 'enterprise_need') {
      return this.prisma.enterpriseNeed.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    }

    if (item.kind === 'research_project') {
      return this.prisma.researchProject.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    }

    return this.prisma.hubItem.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private resolveCreateKind(
    type: CreatePublishItemDto['type'],
    userRole?: string,
  ): PublishContentKind {
    if (type === 'project' && userRole === 'ENTERPRISE_LEADER') {
      return 'enterprise_need';
    }

    if (type === 'project' && userRole === 'EXPERT') {
      return 'research_project';
    }

    return 'hub_item';
  }

  private assertProjectOnlyType(type?: UpdatePublishItemDto['type']) {
    if (type !== undefined && type !== 'project') {
      throw new BadRequestException(
        'Enterprise needs and research projects must remain PROJECT content',
      );
    }
  }

  private async findContentRecord(id: string): Promise<PublishContentRecord> {
    const [hubItem, enterpriseNeed, researchProject] = await Promise.all([
      this.prisma.hubItem.findUnique({
        where: { id, deletedAt: null },
        select: {
          authorUserId: true,
          adminUserId: true,
          reviewStatus: true,
        },
      }),
      this.prisma.enterpriseNeed.findUnique({
        where: { id, deletedAt: null },
        select: {
          enterpriseUserId: true,
          reviewStatus: true,
        },
      }),
      this.prisma.researchProject.findUnique({
        where: { id, deletedAt: null },
        select: {
          expertUserId: true,
          reviewStatus: true,
        },
      }),
    ]);

    if (hubItem) {
      return {
        kind: 'hub_item',
        authorId: hubItem.authorUserId ?? hubItem.adminUserId ?? '',
        reviewStatus: hubItem.reviewStatus,
      };
    }

    if (enterpriseNeed) {
      return {
        kind: 'enterprise_need',
        authorId: enterpriseNeed.enterpriseUserId,
        reviewStatus: enterpriseNeed.reviewStatus,
      };
    }

    if (researchProject) {
      return {
        kind: 'research_project',
        authorId: researchProject.expertUserId,
        reviewStatus: researchProject.reviewStatus,
      };
    }

    throw new NotFoundException('Content not found');
  }

  private async getSerializedContentById(id: string): Promise<SerializedContent> {
    const [hubItem, enterpriseNeed, researchProject] = await Promise.all([
      this.prisma.hubItem.findUnique({
        where: { id, deletedAt: null },
        include: {
          hubItemTags: { include: { tag: true } },
          author: {
            include: this.authorInclude,
          },
        },
      }),
      this.prisma.enterpriseNeed.findUnique({
        where: { id, deletedAt: null },
        include: {
          enterprise: {
            include: this.authorInclude,
          },
        },
      }),
      this.prisma.researchProject.findUnique({
        where: { id, deletedAt: null },
        include: {
          expert: {
            include: this.authorInclude,
          },
        },
      }),
    ]);

    if (hubItem) {
      return serializeHubItem(hubItem);
    }

    if (enterpriseNeed) {
      return serializeEnterpriseNeed(enterpriseNeed);
    }

    if (researchProject) {
      return serializeResearchProject(researchProject);
    }

    throw new NotFoundException('Content not found');
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
