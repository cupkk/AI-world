import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class ExpertService {
  constructor(private prisma: PrismaService) {}

  async create(data: { title: string; summary?: string; neededSupport?: string; tags?: string[] }, userId: string) {
    return this.prisma.researchProject.create({
      data: {
        title: data.title,
        summary: data.summary,
        neededSupport: data.neededSupport,
        tags: data.tags as any,
        expertUserId: userId,
        reviewStatus: 'draft',
      },
    });
  }

  async submit(id: string, userId: string) {
    const project = await this.prisma.researchProject.findUnique({ where: { id, deletedAt: null } });
    if (!project) throw new NotFoundException();
    if (project.expertUserId !== userId) throw new ForbiddenException();
    if (project.reviewStatus !== 'draft') throw new BadRequestException('Only drafts can be submitted');

    return this.prisma.researchProject.update({
      where: { id },
      data: { reviewStatus: 'pending_review' },
    });
  }

  async listMine(userId: string) {
    return this.prisma.researchProject.findMany({
      where: { expertUserId: userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getApplications(id: string, userId: string) {
    const project = await this.prisma.researchProject.findUnique({ where: { id } });
    if (!project) throw new NotFoundException();
    if (project.expertUserId !== userId) throw new ForbiddenException();

    return this.prisma.application.findMany({
      where: { targetType: 'research_project', targetId: id },
      include: {
        applicant: { select: { id: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
