import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  serializeEnterpriseNeed,
  serializeHubItem,
  serializeResearchProject,
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

    const publishedHubWhere = {
      deletedAt: null,
      reviewStatus: 'published',
    } as const;

    const [
      myContents,
      publishedHubCount,
      publishedHubItems,
      publishedEnterpriseNeedCount,
      publishedEnterpriseNeeds,
      publishedResearchProjectCount,
      publishedResearchProjects,
      applications,
    ] =
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
          where: publishedHubWhere,
        }),
        this.prisma.hubItem.findMany({
          where: publishedHubWhere,
          include: hubItemInclude,
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
        this.prisma.enterpriseNeed.count({
          where: {
            deletedAt: null,
            reviewStatus: 'published',
          },
        }),
        this.prisma.enterpriseNeed.findMany({
          where: {
            deletedAt: null,
            reviewStatus: 'published',
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
        this.prisma.researchProject.count({
          where: {
            deletedAt: null,
            reviewStatus: 'published',
          },
        }),
        this.prisma.researchProject.findMany({
          where: {
            deletedAt: null,
            reviewStatus: 'published',
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
        this.applicationsService.listOutbox(userId),
      ]);

    const serializedMyContents = myContents.map((item) => serializeHubItem(item));
    const serializedPublishedHubContents = publishedHubItems.map((item) =>
      serializeHubItem(item),
    );
    const serializedPublishedEnterpriseNeeds = publishedEnterpriseNeeds.map(
      (item) => serializeEnterpriseNeed(item),
    );
    const serializedPublishedResearchProjects = publishedResearchProjects.map(
      (item) => serializeResearchProject(item),
    );
    const serializedPublishedContents = [
      ...serializedPublishedHubContents,
      ...serializedPublishedEnterpriseNeeds,
      ...serializedPublishedResearchProjects,
    ].sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );

    return {
      stats: {
        publishedContentCount: serializedMyContents.filter(
          (item) => item.status === 'PUBLISHED',
        ).length,
        availableContentCount:
          publishedHubCount +
          publishedEnterpriseNeedCount +
          publishedResearchProjectCount,
        pendingReviewCount: serializedMyContents.filter(
          (item) => item.status === 'PENDING_REVIEW',
        ).length,
        applicationCount: applications.length,
      },
      learningResources: serializedPublishedHubContents
        .filter((item) =>
          item.type === 'PAPER' ||
          item.type === 'TOOL' ||
          item.type === 'POLICY',
        )
        .slice(0, 4),
      projectOpportunities: serializedPublishedContents
        .filter(
          (item) =>
            item.contentDomain === 'ENTERPRISE_NEED' ||
            item.contentDomain === 'RESEARCH_PROJECT' ||
            item.type === 'PROJECT' ||
            item.type === 'CONTEST',
        )
        .slice(0, 4),
      recommendedContents: serializedPublishedContents.slice(0, 3),
      myContents: serializedMyContents,
      applications,
    };
  }
}
