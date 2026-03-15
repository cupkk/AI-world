import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  serializeHubItem,
} from '../../common/serializers/serialize';
import { ApplicationsService } from '../applications/applications.service';

@Injectable()
export class LearnerService {
  constructor(
    private prisma: PrismaService,
    private applicationsService: ApplicationsService,
  ) {}

  async getDashboard(userId: string) {
    const hubItemInclude = {
      hubItemTags: {
        include: {
          tag: true,
        },
      },
      author: {
        select: {
          id: true,
          role: true,
        },
      },
    } as const;

    const publishedWhere = {
      deletedAt: null,
      reviewStatus: 'published',
    } as const;

    const [myContents, availableContentCount, publishedContents, applications] =
      await Promise.all([
        this.prisma.hubItem.findMany({
          where: {
            authorUserId: userId,
            deletedAt: null,
          },
          include: hubItemInclude,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.hubItem.count({
          where: publishedWhere,
        }),
        this.prisma.hubItem.findMany({
          where: publishedWhere,
          include: hubItemInclude,
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
        this.applicationsService.listOutbox(userId),
      ]);

    const serializedMyContents = myContents.map((item) => serializeHubItem(item));
    const serializedPublishedContents = publishedContents.map((item) =>
      serializeHubItem(item),
    );

    return {
      stats: {
        publishedContentCount: serializedMyContents.filter(
          (item) => item.status === 'PUBLISHED',
        ).length,
        availableContentCount,
        pendingReviewCount: serializedMyContents.filter(
          (item) => item.status === 'PENDING_REVIEW',
        ).length,
        applicationCount: applications.length,
      },
      learningResources: serializedPublishedContents
        .filter((item) =>
          item.type === 'PAPER' ||
          item.type === 'TOOL' ||
          item.type === 'PROJECT',
        )
        .slice(0, 4),
      projectOpportunities: serializedPublishedContents
        .filter(
          (item) => item.type === 'PROJECT' || item.type === 'CONTEST',
        )
        .slice(0, 4),
      recommendedContents: serializedPublishedContents.slice(0, 3),
      myContents: serializedMyContents,
      applications,
    };
  }
}
