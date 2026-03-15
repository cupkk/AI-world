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

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublishService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(PublishService);
  });

  describe('createDraft', () => {
    it('creates a draft and syncs tags without touching view counts', async () => {
      mockPrisma.hubItem.create.mockResolvedValue({ id: 'h1' });
      mockPrisma.tag.upsert.mockResolvedValue({ id: 'tag-1' });
      mockPrisma.hubItem.findUnique.mockResolvedValue({
        id: 'h1',
        title: 'Draft title',
        authorUserId: 'u1',
        reviewStatus: 'draft',
        hubItemTags: [{ tag: { name: 'AI' } }],
      });

      const result = await service.createDraft(
        {
          title: 'Draft title',
          summary: 'Draft summary',
          type: 'project' as any,
          tags: ['AI'],
        },
        'u1',
      );

      expect(result.id).toBe('h1');
      expect(mockPrisma.hubItem.create).toHaveBeenCalledWith({
        data: {
          title: 'Draft title',
          summary: 'Draft summary',
          type: 'project',
          authorUserId: 'u1',
          reviewStatus: 'draft',
        },
      });
    });
  });

  describe('updateDraft', () => {
    it('rejects editing items owned by another user', async () => {
      mockPrisma.hubItem.findUnique.mockResolvedValue({
        id: 'h1',
        authorUserId: 'other-user',
        reviewStatus: 'draft',
      });

      await expect(
        service.updateDraft('h1', { title: 'new' }, 'u1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects editing items that are not draft or rejected', async () => {
      mockPrisma.hubItem.findUnique.mockResolvedValue({
        id: 'h1',
        authorUserId: 'u1',
        reviewStatus: 'published',
      });

      await expect(
        service.updateDraft('h1', { title: 'new' }, 'u1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows editing rejected items and returns refreshed detail', async () => {
      mockPrisma.hubItem.findUnique
        .mockResolvedValueOnce({
          id: 'h1',
          authorUserId: 'u1',
          reviewStatus: 'rejected',
        })
        .mockResolvedValueOnce({
          id: 'h1',
          title: 'fixed title',
          authorUserId: 'u1',
          reviewStatus: 'rejected',
          hubItemTags: [],
        });
      mockPrisma.hubItem.update.mockResolvedValue({});

      const result = await service.updateDraft('h1', { title: 'fixed title' }, 'u1');

      expect(result.title).toBe('fixed title');
      expect(mockPrisma.hubItem.update).toHaveBeenCalledWith({
        where: { id: 'h1' },
        data: { title: 'fixed title' },
      });
    });
  });

  describe('submitForReview', () => {
    it('rejects submitting items that are not draft or rejected', async () => {
      mockPrisma.hubItem.findUnique.mockResolvedValue({
        id: 'h1',
        authorUserId: 'u1',
        reviewStatus: 'pending_review',
      });

      await expect(service.submitForReview('h1', 'u1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('allows re-submitting rejected items and clears rejectReason', async () => {
      mockPrisma.hubItem.findUnique
        .mockResolvedValueOnce({
          id: 'h1',
          authorUserId: 'u1',
          reviewStatus: 'rejected',
          rejectReason: 'needs work',
        })
        .mockResolvedValueOnce({
          id: 'h1',
          authorUserId: 'u1',
          reviewStatus: 'pending_review',
          rejectReason: null,
          hubItemTags: [],
        });
      mockPrisma.hubItem.update.mockResolvedValue({});

      const result = await service.submitForReview('h1', 'u1');

      expect(result.reviewStatus).toBe('pending_review');
      expect(mockPrisma.hubItem.update).toHaveBeenCalledWith({
        where: { id: 'h1' },
        data: { reviewStatus: 'pending_review', rejectReason: null },
      });
    });
  });

  describe('listMine', () => {
    it('returns authored items across all statuses', async () => {
      mockPrisma.hubItem.findMany.mockResolvedValue([{ id: 'h1' }]);

      const result = await service.listMine('u1');

      expect(result).toEqual([{ id: 'h1' }]);
      expect(mockPrisma.hubItem.findMany).toHaveBeenCalledWith({
        where: { authorUserId: 'u1', deletedAt: null },
        include: {
          hubItemTags: { include: { tag: true } },
          author: {
            include: {
              profile: {
                include: {
                  profileTags: {
                    include: {
                      tag: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('moveToDraft', () => {
    it('moves a rejected item back to draft and clears the reject reason', async () => {
      mockPrisma.hubItem.findUnique
        .mockResolvedValueOnce({
          id: 'h1',
          authorUserId: 'u1',
          reviewStatus: 'rejected',
          rejectReason: 'Needs work',
        })
        .mockResolvedValueOnce({
          id: 'h1',
          title: 'Draft again',
          authorUserId: 'u1',
          reviewStatus: 'draft',
          rejectReason: null,
          hubItemTags: [],
        });
      mockPrisma.hubItem.update.mockResolvedValue({});

      const result = await service.moveToDraft('h1', 'u1');

      expect(result.reviewStatus).toBe('draft');
      expect(mockPrisma.hubItem.update).toHaveBeenCalledWith({
        where: { id: 'h1' },
        data: { reviewStatus: 'draft', rejectReason: null },
      });
    });

    it('rejects moving non-rejected items back to draft', async () => {
      mockPrisma.hubItem.findUnique.mockResolvedValue({
        id: 'h1',
        authorUserId: 'u1',
        reviewStatus: 'published',
      });

      await expect(service.moveToDraft('h1', 'u1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('softDelete', () => {
    it('rejects deleting another user item as a non-admin', async () => {
      mockPrisma.hubItem.findUnique.mockResolvedValue({
        id: 'h1',
        authorUserId: 'other',
      });

      await expect(service.softDelete('h1', 'u1', 'LEARNER')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws when the item does not exist', async () => {
      mockPrisma.hubItem.findUnique.mockResolvedValue(null);

      await expect(service.softDelete('missing', 'u1', 'ADMIN')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('allows admins to soft-delete another users item', async () => {
      mockPrisma.hubItem.findUnique.mockResolvedValue({
        id: 'h1',
        authorUserId: 'other',
      });
      mockPrisma.hubItem.update.mockResolvedValue({
        id: 'h1',
        deletedAt: new Date('2026-03-14T00:00:00.000Z'),
      });

      const result = await service.softDelete('h1', 'u1', 'ADMIN');

      expect(result.id).toBe('h1');
      expect(mockPrisma.hubItem.update).toHaveBeenCalledWith({
        where: { id: 'h1' },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });
});
