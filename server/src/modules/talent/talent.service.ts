import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { serializeUser } from '../../common/serializers/serialize';

@Injectable()
export class TalentService {
  constructor(private prisma: PrismaService) {}

  private normalizeKeyword(value?: string) {
    return value?.trim().toLowerCase() ?? '';
  }

  private computeProfileStrength(user: ReturnType<typeof serializeUser>) {
    const filledFields = [
      user.name,
      user.bio,
      user.title,
      user.company,
      user.location,
      user.researchField,
      user.major,
      user.whatImDoing,
      user.whatICanProvide,
      user.whatImLookingFor,
      user.aiStrategy,
      user.contactEmail,
      user.personalPage,
      user.academicTitle,
    ].filter((value) => typeof value === 'string' && value.trim().length > 0)
      .length;

    return (
      filledFields +
      (user.skills?.length ?? 0) * 1.5 +
      (user.platformIntents?.length ?? 0)
    );
  }

  private buildRelevanceScore(
    user: ReturnType<typeof serializeUser>,
    keyword: string,
  ) {
    if (!keyword) {
      return 0;
    }

    return [
      user.name,
      user.title,
      user.company,
      user.bio,
      ...(user.skills ?? []),
      ...(user.platformIntents ?? []),
    ]
      .filter((value): value is string => typeof value === 'string')
      .reduce((score, value) => {
        const normalized = value.toLowerCase();
        if (!normalized.includes(keyword)) {
          return score;
        }

        return score + (normalized === keyword ? 3 : 1);
      }, 0);
  }

  async search(query: {
    q?: string;
    tags?: string;
    location?: string;
    org?: string;
    intents?: string;
    role?: string;
    sort?: string;
    page?: number;
    limit?: number;
  }) {
    const {
      q,
      tags,
      location,
      org,
      intents,
      role,
      sort,
      page = 1,
      limit = 20,
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      status: 'active',
      deletedAt: null,
    };

    if (role) {
      where.role = role as any;
    }

    const users = await this.prisma.user.findMany({
      where,
      include: {
        profile: {
          include: {
            profileTags: { include: { tag: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const keyword = this.normalizeKeyword(q);
    const normalizedLocation = this.normalizeKeyword(location);
    const normalizedOrg = this.normalizeKeyword(org);
    const tagNames = (tags ?? '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    const intentNames = (intents ?? '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    const sortMode = (sort ?? 'profile_strength').trim().toLowerCase();

    const filteredUsers = users
      .map((user) => serializeUser(user, { maskEmail: true }))
      .filter((user) => user.role !== 'ADMIN')
      .filter((user) => {
        if (!keyword) {
          return true;
        }

        const searchableParts = [
          user.name,
          user.bio,
          user.title,
          user.company,
          user.location,
          user.researchField,
          user.major,
          user.academicTitle,
          user.whatImDoing,
          user.whatICanProvide,
          user.whatImLookingFor,
          user.aiStrategy,
          ...(user.skills ?? []),
          ...(user.platformIntents ?? []),
        ]
          .filter((value): value is string => typeof value === 'string')
          .map((value) => value.toLowerCase());

        return searchableParts.some((value) => value.includes(keyword));
      })
      .filter((user) => {
        if (tagNames.length === 0) {
          return true;
        }

        const skills = (user.skills ?? []).map((item) => item.toLowerCase());
        return tagNames.some((tag) => skills.includes(tag));
      })
      .filter((user) => {
        if (!normalizedLocation) {
          return true;
        }

        return (user.location ?? '').toLowerCase().includes(normalizedLocation);
      })
      .filter((user) => {
        if (!normalizedOrg) {
          return true;
        }

        return [user.company, user.companyName]
          .filter((value): value is string => typeof value === 'string')
          .some((value) => value.toLowerCase().includes(normalizedOrg));
      })
      .filter((user) => {
        if (intentNames.length === 0) {
          return true;
        }

        const userIntents = (user.platformIntents ?? []).map((item) =>
          item.toLowerCase(),
        );
        return intentNames.some((intent) => userIntents.includes(intent));
      });

    filteredUsers.sort((left, right) => {
      switch (sortMode) {
        case 'name':
          return left.name.localeCompare(right.name);
        case 'newest':
          return 0;
        case 'relevance': {
          const scoreDiff =
            this.buildRelevanceScore(right, keyword) -
            this.buildRelevanceScore(left, keyword);
          if (scoreDiff !== 0) {
            return scoreDiff;
          }
          return (
            this.computeProfileStrength(right) -
            this.computeProfileStrength(left)
          );
        }
        case 'profile_strength':
        default:
          return (
            this.computeProfileStrength(right) -
            this.computeProfileStrength(left)
          );
      }
    });

    const pagedUsers = filteredUsers.slice(skip, skip + limit);

    return {
      items: pagedUsers,
      total: filteredUsers.length,
      page,
      limit,
    };
  }
}
