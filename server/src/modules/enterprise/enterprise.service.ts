import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpdateEnterpriseProfileDto, CreateNeedDto, QueryNeedsDto } from './enterprise.dto';
import { Prisma } from '@prisma/client';
import {
  serializeHubItem,
  serializeUser,
} from '../../common/serializers/serialize';
import { ApplicationsService } from '../applications/applications.service';

// Recruitment keyword blocklist
const RECRUITMENT_KEYWORDS = [
  '招聘', '岗位', '简历', '面试', '入职', 'hiring', 'job opening',
  'resume', 'interview', '薪资', '薪酬', 'salary', 'JD',
];

@Injectable()
export class EnterpriseService {
  constructor(
    private prisma: PrismaService,
    private applicationsService: ApplicationsService,
  ) {}

  async getDashboard(userId: string) {
    const expertWhere: Prisma.UserWhereInput = {
      role: 'EXPERT',
      status: 'active',
      deletedAt: null,
    };

    const [profile, expertCount, recommendedExperts, myContents, activeConversationsCount] =
      await Promise.all([
        this.prisma.enterpriseProfile.findUnique({
          where: { userId },
        }),
        this.prisma.user.count({ where: expertWhere }),
        this.prisma.user.findMany({
          where: expertWhere,
          include: {
            profile: {
              include: {
                profileTags: { include: { tag: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 4,
        }),
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
        this.prisma.conversationMember.count({
          where: { userId },
        }),
      ]);

    const serializedInboundApplications =
      myContents.length > 0
        ? await this.applicationsService.listForTargets(
            myContents.map((item) => ({
              targetType: 'hub_project',
              targetId: item.id,
            })),
          )
        : [];

    return {
      profile: {
        aiStrategy: profile?.aiStrategyText ?? '',
        whatImDoing: profile?.casesText ?? '',
        whatImLookingFor: profile?.achievementsText ?? '',
      },
      stats: {
        recommendedExpertsCount: expertCount,
        activeConversationsCount,
        postedNeedsCount: myContents.length,
        pendingInboundApplicationsCount: serializedInboundApplications.filter(
          (app) => app.status === 'SUBMITTED',
        ).length,
      },
      recommendedExperts: recommendedExperts.map((expert) =>
        serializeUser(expert, { maskEmail: true }),
      ),
      myContents: myContents.map((item) => serializeHubItem(item)),
      inboundApplications: serializedInboundApplications,
    };
  }

  async getMyProfile(userId: string) {
    const profile = await this.prisma.enterpriseProfile.findUnique({
      where: { userId },
    });
    return profile || { userId, aiStrategyText: null, casesText: null, achievementsText: null };
  }

  async updateMyProfile(userId: string, dto: UpdateEnterpriseProfileDto) {
    return this.prisma.enterpriseProfile.upsert({
      where: { userId },
      update: dto,
      create: { userId, ...dto },
    });
  }

  async createNeed(dto: CreateNeedDto, userId: string) {
    // Content moderation: block recruitment
    this.checkRecruitmentContent(dto.title + ' ' + (dto.background || '') + ' ' + (dto.goal || ''));

    return this.prisma.enterpriseNeed.create({
      data: {
        ...dto,
        requiredRoles: dto.requiredRoles as any,
        enterpriseUserId: userId,
        reviewStatus: 'draft',
      },
    });
  }

  async submitNeed(id: string, userId: string) {
    const need = await this.prisma.enterpriseNeed.findUnique({
      where: { id, deletedAt: null },
    });
    if (!need) throw new NotFoundException('Need not found');
    if (need.enterpriseUserId !== userId) throw new ForbiddenException();
    if (need.reviewStatus !== 'draft') {
      throw new BadRequestException('Only drafts can be submitted');
    }

    return this.prisma.enterpriseNeed.update({
      where: { id },
      data: { reviewStatus: 'pending_review' },
    });
  }

  /**
   * List needs with SQL-level visibility filtering (NOT frontend-only)
   */
  async listNeeds(query: QueryNeedsDto, userRole: string) {
    const { q, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.EnterpriseNeedWhereInput = {
      deletedAt: null,
      reviewStatus: 'published',
    };

    // SQL-level visibility filtering based on role
    if (userRole === 'ENTERPRISE_LEADER') {
      // Enterprise users can only see public_all needs
      where.visibility = 'public_all';
    }
    // EXPERT, LEARNER, ADMIN can see all visibility levels

    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { background: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.enterpriseNeed.findMany({
        where,
        include: {
          enterprise: {
            select: { id: true, role: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.enterpriseNeed.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getNeed(id: string, userRole: string) {
    const need = await this.prisma.enterpriseNeed.findUnique({
      where: { id, deletedAt: null },
      include: {
        enterprise: { select: { id: true, role: true } },
      },
    });

    if (!need) throw new NotFoundException('Need not found');

    // Visibility check at data level
    if (
      need.visibility === 'experts_and_learners' &&
      userRole === 'ENTERPRISE_LEADER'
    ) {
      throw new ForbiddenException('You do not have access to this need');
    }

    return need;
  }

  async getNeedApplications(id: string, userId: string) {
    const need = await this.prisma.enterpriseNeed.findUnique({
      where: { id },
    });
    if (!need) throw new NotFoundException();
    if (need.enterpriseUserId !== userId) throw new ForbiddenException();

    return this.applicationsService.listForTargets([
      { targetType: 'enterprise_need', targetId: id },
    ]);
  }

  private checkRecruitmentContent(text: string) {
    const lower = text.toLowerCase();
    const found = RECRUITMENT_KEYWORDS.find((kw) => lower.includes(kw.toLowerCase()));
    if (found) {
      throw new BadRequestException(
        `Content contains recruitment-related keyword "${found}". AI-World prohibits job postings. Please rephrase as a project need.`,
      );
    }
  }
}
