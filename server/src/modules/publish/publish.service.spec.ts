import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PublishService } from './publish.service';
import { PrismaService } from '../../common/prisma/prisma.service';

const mockPrisma: any = {
  hubItem: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  enterpriseNeed: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  researchProject: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  hubItemTag: {
    deleteMany: jest.fn(),
    create: jest.fn(),
  },
  tag: {
    upsert: jest.fn(),
  },
};

describe('PublishService', () => {
  let service: PublishService;
  let hubItems: Record<string, any>;
  let enterpriseNeeds: Record<string, any>;
  let researchProjects: Record<string, any>;

  beforeEach(async () => {
    jest.clearAllMocks();

    hubItems = {};
    enterpriseNeeds = {};
    researchProjects = {};

    mockPrisma.hubItem.findUnique.mockImplementation(async ({ where }: any) => {
      return hubItems[where.id] ?? null;
    });
    mockPrisma.enterpriseNeed.findUnique.mockImplementation(
      async ({ where }: any) => {
        return enterpriseNeeds[where.id] ?? null;
      },
    );
    mockPrisma.researchProject.findUnique.mockImplementation(
      async ({ where }: any) => {
        return researchProjects[where.id] ?? null;
      },
    );

    mockPrisma.hubItem.update.mockImplementation(async ({ where, data }: any) => {
      if (!hubItems[where.id]) {
        throw new NotFoundException();
      }
      hubItems[where.id] = { ...hubItems[where.id], ...data };
      return hubItems[where.id];
    });
    mockPrisma.enterpriseNeed.update.mockImplementation(
      async ({ where, data }: any) => {
        if (!enterpriseNeeds[where.id]) {
          throw new NotFoundException();
        }
        enterpriseNeeds[where.id] = { ...enterpriseNeeds[where.id], ...data };
        return enterpriseNeeds[where.id];
      },
    );
    mockPrisma.researchProject.update.mockImplementation(
      async ({ where, data }: any) => {
        if (!researchProjects[where.id]) {
          throw new NotFoundException();
        }
        researchProjects[where.id] = {
          ...researchProjects[where.id],
          ...data,
        };
        return researchProjects[where.id];
      },
    );

    mockPrisma.hubItem.findMany.mockResolvedValue([]);
    mockPrisma.enterpriseNeed.findMany.mockResolvedValue([]);
    mockPrisma.researchProject.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublishService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(PublishService);
  });

  describe('createDraft', () => {
    it('creates a hub draft for generic publish content', async () => {
      mockPrisma.hubItem.create.mockImplementation(async ({ data }: any) => {
        hubItems.h1 = {
          id: 'h1',
          createdAt: new Date('2026-03-17T00:00:00.000Z'),
          likesCount: 0,
          viewsCount: 0,
          hubItemTags: [{ tag: { name: 'AI' } }],
          ...data,
        };
        return { id: 'h1' };
      });
      mockPrisma.tag.upsert.mockResolvedValue({ id: 'tag-1' });

      const result = await service.createDraft(
        {
          title: 'Draft title',
          summary: 'Draft summary',
          type: 'paper' as any,
          tags: ['AI'],
        },
        'u1',
        'LEARNER',
      );

      expect(result).toMatchObject({
        id: 'h1',
        title: 'Draft title',
        description: 'Draft summary',
        type: 'PAPER',
        contentDomain: 'HUB_ITEM',
        status: 'DRAFT',
      });
      expect(mockPrisma.hubItem.create).toHaveBeenCalledWith({
        data: {
          title: 'Draft title',
          summary: 'Draft summary',
          type: 'paper',
          contentRich: undefined,
          coverUrl: undefined,
          sourceUrl: undefined,
          authorUserId: 'u1',
          reviewStatus: 'draft',
        },
      });
    });

    it('routes enterprise leader project drafts to enterprise needs', async () => {
      mockPrisma.enterpriseNeed.create.mockImplementation(async ({ data }: any) => {
        enterpriseNeeds.need1 = {
          id: 'need1',
          createdAt: new Date('2026-03-17T00:00:00.000Z'),
          ...data,
        };
        return { id: 'need1' };
      });

      const result = await service.createDraft(
        {
          title: 'Need delivery support',
          summary: 'Ship evaluation assets',
          type: 'project' as any,
          tags: ['Prompt QA'],
          background: 'Need help with delivery',
          goal: 'Launch evaluation workflow',
          visibility: 'experts_and_learners' as any,
        },
        'enterprise-1',
        'ENTERPRISE_LEADER',
      );

      expect(result).toMatchObject({
        id: 'need1',
        contentDomain: 'ENTERPRISE_NEED',
        type: 'PROJECT',
        description: 'Ship evaluation assets',
        background: 'Need help with delivery',
        goal: 'Launch evaluation workflow',
        visibility: 'EXPERTS_LEARNERS',
      });
      expect(mockPrisma.enterpriseNeed.create).toHaveBeenCalledWith({
        data: {
          title: 'Need delivery support',
          background: 'Need help with delivery',
          goal: 'Launch evaluation workflow',
          deliverables: 'Ship evaluation assets',
          requiredRoles: ['Prompt QA'],
          visibility: 'experts_and_learners',
          enterpriseUserId: 'enterprise-1',
          reviewStatus: 'draft',
        },
      });
    });

    it('routes expert project drafts to research projects', async () => {
      mockPrisma.researchProject.create.mockImplementation(async ({ data }: any) => {
        researchProjects.project1 = {
          id: 'project1',
          createdAt: new Date('2026-03-17T00:00:00.000Z'),
          ...data,
        };
        return { id: 'project1' };
      });

      const result = await service.createDraft(
        {
          title: 'Benchmark study',
          summary: 'Compare prompt pipelines',
          type: 'project' as any,
          tags: ['LLM'],
          neededSupport: 'Need learner support',
        },
        'expert-1',
        'EXPERT',
      );

      expect(result).toMatchObject({
        id: 'project1',
        contentDomain: 'RESEARCH_PROJECT',
        type: 'PROJECT',
        description: 'Compare prompt pipelines',
        neededSupport: 'Need learner support',
      });
      expect(mockPrisma.researchProject.create).toHaveBeenCalledWith({
        data: {
          title: 'Benchmark study',
          summary: 'Compare prompt pipelines',
          neededSupport: 'Need learner support',
          tags: ['LLM'],
          expertUserId: 'expert-1',
          reviewStatus: 'draft',
        },
      });
    });
  });

  describe('getItemDetail', () => {
    it('rejects access to another users authored content', async () => {
      hubItems.h1 = {
        id: 'h1',
        authorUserId: 'owner-1',
        reviewStatus: 'draft',
        createdAt: new Date('2026-03-17T00:00:00.000Z'),
        hubItemTags: [],
      };

      await expect(service.getItemDetail('h1', 'user-2', 'LEARNER')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateDraft', () => {
    it('rejects editing items owned by another user', async () => {
      hubItems.h1 = {
        id: 'h1',
        authorUserId: 'other-user',
        reviewStatus: 'draft',
        createdAt: new Date('2026-03-17T00:00:00.000Z'),
        hubItemTags: [],
      };

      await expect(
        service.updateDraft('h1', { title: 'new' }, 'u1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows editing rejected enterprise needs and keeps project-only type', async () => {
      enterpriseNeeds.need1 = {
        id: 'need1',
        title: 'Old need',
        enterpriseUserId: 'enterprise-1',
        reviewStatus: 'rejected',
        createdAt: new Date('2026-03-17T00:00:00.000Z'),
        background: 'Old background',
        goal: 'Old goal',
        deliverables: 'Old deliverables',
        requiredRoles: ['QA'],
        visibility: 'public_all',
      };

      const result = await service.updateDraft(
        'need1',
        {
          title: 'Updated need',
          summary: 'Updated deliverables',
          background: 'Updated background',
          goal: 'Updated goal',
          tags: ['Prompt QA'],
          visibility: 'experts_and_learners' as any,
          type: 'project' as any,
        },
        'enterprise-1',
      );

      expect(result).toMatchObject({
        id: 'need1',
        title: 'Updated need',
        contentDomain: 'ENTERPRISE_NEED',
        description: 'Updated deliverables',
        background: 'Updated background',
        goal: 'Updated goal',
        visibility: 'EXPERTS_LEARNERS',
      });
      expect(mockPrisma.enterpriseNeed.update).toHaveBeenCalledWith({
        where: { id: 'need1' },
        data: {
          title: 'Updated need',
          background: 'Updated background',
          goal: 'Updated goal',
          deliverables: 'Updated deliverables',
          requiredRoles: ['Prompt QA'],
          visibility: 'experts_and_learners',
        },
      });
    });

    it('allows authors to edit published hub items', async () => {
      hubItems.h1 = {
        id: 'h1',
        title: 'Published title',
        summary: 'Published summary',
        type: 'paper',
        authorUserId: 'u1',
        reviewStatus: 'published',
        createdAt: new Date('2026-03-17T00:00:00.000Z'),
        likesCount: 3,
        viewsCount: 12,
        hubItemTags: [{ tag: { name: 'AI' } }],
      };

      mockPrisma.tag.upsert.mockResolvedValue({ id: 'tag-2' });

      const result = await service.updateDraft(
        'h1',
        {
          title: 'Updated published title',
          summary: 'Updated published summary',
          tags: ['Agents'],
        },
        'u1',
      );

      expect(result).toMatchObject({
        id: 'h1',
        title: 'Updated published title',
        description: 'Updated published summary',
        status: 'PUBLISHED',
      });
      expect(mockPrisma.hubItem.update).toHaveBeenCalledWith({
        where: { id: 'h1' },
        data: {
          title: 'Updated published title',
          summary: 'Updated published summary',
        },
      });
      expect(mockPrisma.hubItemTag.deleteMany).toHaveBeenCalledWith({
        where: { hubItemId: 'h1' },
      });
      expect(mockPrisma.hubItemTag.create).toHaveBeenCalled();
    });

    it('rejects changing enterprise needs to a non-project type', async () => {
      enterpriseNeeds.need1 = {
        id: 'need1',
        enterpriseUserId: 'enterprise-1',
        reviewStatus: 'draft',
        createdAt: new Date('2026-03-17T00:00:00.000Z'),
      };

      await expect(
        service.updateDraft(
          'need1',
          { type: 'paper' as any },
          'enterprise-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates research project fields for rejected drafts', async () => {
      researchProjects.project1 = {
        id: 'project1',
        title: 'Old project',
        expertUserId: 'expert-1',
        reviewStatus: 'rejected',
        createdAt: new Date('2026-03-17T00:00:00.000Z'),
        summary: 'Old summary',
        neededSupport: 'Old support',
        tags: ['LLM'],
      };

      const result = await service.updateDraft(
        'project1',
        {
          title: 'Updated project',
          summary: 'Updated summary',
          neededSupport: 'Updated support',
          tags: ['Agents'],
        },
        'expert-1',
      );

      expect(result).toMatchObject({
        id: 'project1',
        title: 'Updated project',
        contentDomain: 'RESEARCH_PROJECT',
        description: 'Updated summary',
        neededSupport: 'Updated support',
        tags: ['Agents'],
      });
    });
  });

  describe('submitForReview', () => {
    it('rejects submitting items that are not draft or rejected', async () => {
      hubItems.h1 = {
        id: 'h1',
        authorUserId: 'u1',
        reviewStatus: 'pending_review',
        createdAt: new Date('2026-03-17T00:00:00.000Z'),
        hubItemTags: [],
      };

      await expect(service.submitForReview('h1', 'u1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('allows re-submitting rejected research projects and clears rejectReason', async () => {
      researchProjects.project1 = {
        id: 'project1',
        title: 'Benchmark study',
        expertUserId: 'expert-1',
        reviewStatus: 'rejected',
        rejectReason: 'needs more structure',
        createdAt: new Date('2026-03-17T00:00:00.000Z'),
        summary: 'Compare pipelines',
        tags: [],
      };

      const result = await service.submitForReview('project1', 'expert-1');

      expect(result).toMatchObject({
        id: 'project1',
        contentDomain: 'RESEARCH_PROJECT',
        status: 'PENDING_REVIEW',
      });
      expect(mockPrisma.researchProject.update).toHaveBeenCalledWith({
        where: { id: 'project1' },
        data: { reviewStatus: 'pending_review', rejectReason: null },
      });
    });
  });

  describe('listMine', () => {
    it('returns authored items across hub, enterprise, and research domains', async () => {
      mockPrisma.hubItem.findMany.mockResolvedValue([
        {
          id: 'h1',
          title: 'Hub item',
          summary: 'Hub summary',
          type: 'paper',
          authorUserId: 'u1',
          reviewStatus: 'published',
          createdAt: new Date('2026-03-15T00:00:00.000Z'),
          likesCount: 2,
          viewsCount: 5,
          hubItemTags: [],
        },
      ]);
      mockPrisma.enterpriseNeed.findMany.mockResolvedValue([
        {
          id: 'need1',
          title: 'Enterprise need',
          enterpriseUserId: 'u1',
          reviewStatus: 'draft',
          createdAt: new Date('2026-03-17T00:00:00.000Z'),
          background: 'Need implementation help',
          goal: 'Launch workflow',
          deliverables: 'Ship assets',
          requiredRoles: ['QA'],
          visibility: 'public_all',
        },
      ]);
      mockPrisma.researchProject.findMany.mockResolvedValue([
        {
          id: 'project1',
          title: 'Research project',
          expertUserId: 'u1',
          reviewStatus: 'pending_review',
          createdAt: new Date('2026-03-16T00:00:00.000Z'),
          summary: 'Study benchmark quality',
          neededSupport: 'Need learners',
          tags: ['LLM'],
        },
      ]);

      const result = await service.listMine('u1');

      expect(result.map((item) => item.id)).toEqual([
        'need1',
        'project1',
        'h1',
      ]);
      expect(result.map((item) => item.contentDomain)).toEqual([
        'ENTERPRISE_NEED',
        'RESEARCH_PROJECT',
        'HUB_ITEM',
      ]);
    });
  });

  describe('moveToDraft', () => {
    it('moves a rejected enterprise need back to draft and clears the reject reason', async () => {
      enterpriseNeeds.need1 = {
        id: 'need1',
        title: 'Enterprise need',
        enterpriseUserId: 'enterprise-1',
        reviewStatus: 'rejected',
        rejectReason: 'Needs more delivery detail',
        createdAt: new Date('2026-03-17T00:00:00.000Z'),
        deliverables: 'Ship assets',
        visibility: 'public_all',
      };

      const result = await service.moveToDraft('need1', 'enterprise-1');

      expect(result).toMatchObject({
        id: 'need1',
        contentDomain: 'ENTERPRISE_NEED',
        status: 'DRAFT',
      });
      expect(mockPrisma.enterpriseNeed.update).toHaveBeenCalledWith({
        where: { id: 'need1' },
        data: { reviewStatus: 'draft', rejectReason: null },
      });
    });
  });

  describe('softDelete', () => {
    it('rejects deleting another users enterprise need as a non-admin', async () => {
      enterpriseNeeds.need1 = {
        id: 'need1',
        enterpriseUserId: 'other',
        reviewStatus: 'draft',
        createdAt: new Date('2026-03-17T00:00:00.000Z'),
      };

      await expect(
        service.softDelete('need1', 'u1', 'ENTERPRISE_LEADER'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows admins to soft-delete research projects', async () => {
      researchProjects.project1 = {
        id: 'project1',
        expertUserId: 'expert-1',
        reviewStatus: 'draft',
        createdAt: new Date('2026-03-17T00:00:00.000Z'),
      };

      const result = await service.softDelete('project1', 'admin-1', 'ADMIN');

      expect(result.id).toBe('project1');
      expect(mockPrisma.researchProject.update).toHaveBeenCalledWith({
        where: { id: 'project1' },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });
});
