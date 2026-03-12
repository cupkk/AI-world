import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { serializeUser } from '../../common/serializers/serialize';

@Injectable()
export class TalentService {
  constructor(private prisma: PrismaService) {}

  async search(query: {
    q?: string;
    tags?: string;
    role?: string;
    page?: number;
    limit?: number;
  }) {
    const { q, tags, role, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      status: 'active',
      deletedAt: null,
    };

    if (role) {
      where.role = role as any;
    }

    if (q) {
      where.profile = {
        OR: [
          { displayName: { contains: q, mode: 'insensitive' } },
          { headline: { contains: q, mode: 'insensitive' } },
          { bio: { contains: q, mode: 'insensitive' } },
          { org: { contains: q, mode: 'insensitive' } },
        ],
      };
    }

    if (tags) {
      const tagNames = tags.split(',').map((t) => t.trim());
      where.profile = {
        ...where.profile as any,
        profileTags: {
          some: {
            tag: { name: { in: tagNames } },
          },
        },
      };
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          profile: {
            include: {
              profileTags: { include: { tag: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: users.map((u) => serializeUser(u, { maskEmail: true })),
      total,
      page,
      limit,
    };
  }
}
