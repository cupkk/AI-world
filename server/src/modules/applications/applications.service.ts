import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ApplicationTargetType, ApplicationStatus } from '@prisma/client';

@Injectable()
export class ApplicationsService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    targetType: ApplicationTargetType;
    targetId: string;
    message?: string;
  }, userId: string) {
    // Check for duplicate application
    const existing = await this.prisma.application.findUnique({
      where: {
        applicantUserId_targetType_targetId: {
          applicantUserId: userId,
          targetType: data.targetType,
          targetId: data.targetId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('You have already applied');
    }

    return this.prisma.application.create({
      data: {
        ...data,
        applicantUserId: userId,
        status: 'submitted',
      },
    });
  }

  async listMine(userId: string) {
    return this.prisma.application.findMany({
      where: { applicantUserId: userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(id: string, status: ApplicationStatus, userId: string) {
    const app = await this.prisma.application.findUnique({ where: { id } });
    if (!app) throw new NotFoundException();

    // Verify ownership of target
    const isOwner = await this.verifyTargetOwner(app.targetType, app.targetId, userId);
    if (!isOwner) throw new ForbiddenException('Only the target owner can update application status');

    return this.prisma.application.update({
      where: { id },
      data: { status },
    });
  }

  private async verifyTargetOwner(
    targetType: ApplicationTargetType,
    targetId: string,
    userId: string,
  ): Promise<boolean> {
    switch (targetType) {
      case 'enterprise_need': {
        const need = await this.prisma.enterpriseNeed.findUnique({ where: { id: targetId } });
        return need?.enterpriseUserId === userId;
      }
      case 'research_project': {
        const project = await this.prisma.researchProject.findUnique({ where: { id: targetId } });
        return project?.expertUserId === userId;
      }
      case 'hub_project': {
        const item = await this.prisma.hubItem.findUnique({ where: { id: targetId } });
        return item?.authorUserId === userId;
      }
      default:
        return false;
    }
  }
}
