import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { UpdateProfileDto } from './profile.dto';
import {
  serializeEnterpriseNeed,
  serializeHubItem,
  serializeResearchProject,
  serializeUser,
} from '../../common/serializers/serialize';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);
  private readonly userInclude = {
    profile: {
      include: {
        profileTags: { include: { tag: true } },
      },
    },
  } as const;

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  /**
   * Get user basic info
   */
  async getUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      include: this.userInclude,
    });

    if (!user) throw new NotFoundException('User not found');
    return serializeUser(user, { maskEmail: true });
  }

  /**
   * Get full profile by user ID (with email masking logic)
   */
  async getProfile(userId: string, requesterId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      include: this.userInclude,
    });

    if (!user || !user.profile) throw new NotFoundException('Profile not found');

    const maskEmail = requesterId !== userId;
    return serializeUser(user, { maskEmail });
  }

  async getProfilePage(userId: string, requesterId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      include: this.userInclude,
    });

    if (!user || !user.profile) {
      throw new NotFoundException('Profile not found');
    }

    const [hubItems, enterpriseNeeds, researchProjects] = await Promise.all([
      this.prisma.hubItem.findMany({
        where: {
          authorUserId: userId,
          deletedAt: null,
          reviewStatus: 'published',
        },
        include: {
          hubItemTags: {
            include: {
              tag: true,
            },
          },
        },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.enterpriseNeed.findMany({
        where: {
          enterpriseUserId: userId,
          deletedAt: null,
          reviewStatus: 'published',
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.researchProject.findMany({
        where: {
          expertUserId: userId,
          deletedAt: null,
          reviewStatus: 'published',
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const serializedContents = [
      ...hubItems.map(serializeHubItem),
      ...enterpriseNeeds.map(serializeEnterpriseNeed),
      ...researchProjects.map(serializeResearchProject),
    ].sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
    const contentTypeCounts = new Map<string, number>();

    for (const item of serializedContents) {
      contentTypeCounts.set(item.type, (contentTypeCounts.get(item.type) ?? 0) + 1);
    }

    const featuredTypes = Array.from(contentTypeCounts.entries())
      .sort((left, right) => right[1] - left[1])
      .map(([type]) => type)
      .slice(0, 3);

    return {
      user: serializeUser(user, { maskEmail: requesterId !== userId }),
      contents: serializedContents,
      summary: {
        publishedContentCount: serializedContents.length,
        totalViews: serializedContents.reduce(
          (sum, item) => sum + (item.views ?? 0),
          0,
        ),
        totalLikes: serializedContents.reduce(
          (sum, item) => sum + (item.likes ?? 0),
          0,
        ),
        featuredTypes,
        domainCounts: {
          hubItems: hubItems.length,
          enterpriseNeeds: enterpriseNeeds.length,
          researchProjects: researchProjects.length,
        },
      },
    };
  }

  /**
   * Update my profile
   */
  async updateMyProfile(userId: string, dto: UpdateProfileDto) {
    const { tags, role, ...profileData } = dto;

    // If role is being set during onboarding, update the user record
    if (role && ['EXPERT', 'ENTERPRISE_LEADER', 'LEARNER'].includes(role)) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { role: role as any },
      });
    }

    // Update profile fields
    await this.prisma.profile.upsert({
      where: { userId },
      update: profileData,
      create: {
        userId,
        ...profileData,
      },
    });

    // Update tags if provided
    if (tags !== undefined) {
      // Delete existing tags
      await this.prisma.profileTag.deleteMany({
        where: { profileUserId: userId },
      });

      // Upsert tags and create associations
      for (const tagName of tags) {
        const tag = await this.prisma.tag.upsert({
          where: { name: tagName },
          update: {},
          create: { name: tagName },
        });

        await this.prisma.profileTag.create({
          data: {
            profileUserId: userId,
            tagId: tag.id,
          },
        });
      }
    }

    return this.getProfile(userId, userId);
  }

  /**
   * Upload avatar image and update profile
   */
  async uploadAvatar(userId: string, file: Express.Multer.File) {
    // Upload via StorageService (OSS or local fallback)
    const stored = await this.storage.upload(
      userId,
      `avatar-${file.originalname}`,
      file.buffer,
      file.mimetype,
      'avatars',
    );

    const avatarUrl = stored.url;
    this.logger.log(`Avatar uploaded: ${avatarUrl}`);

    await this.prisma.profile.upsert({
      where: { userId },
      update: { avatarUrl },
      create: { userId, avatarUrl },
    });

    return this.getProfile(userId, userId);
  }
}
