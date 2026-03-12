import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { HubService } from './hub.service';
import { PrismaService } from '../../common/prisma/prisma.service';

const mockPrisma = {
  hubItem: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  hubItemTag: { deleteMany: jest.fn(), create: jest.fn() },
  tag: { upsert: jest.fn() },
};

describe('HubService', () => {
  let service: HubService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HubService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(HubService);
  });

  describe('list', () => {
    it('should filter by published for non-admin', async () => {
      mockPrisma.hubItem.findMany.mockResolvedValue([]);
      mockPrisma.hubItem.count.mockResolvedValue(0);

      const result = await service.list({ page: 1, limit: 10 }, 'LEARNER');
      expect(result.total).toBe(0);

      // Verify published filter was applied
      const whereArg = mockPrisma.hubItem.findMany.mock.calls[0][0].where;
      expect(whereArg.reviewStatus).toBe('published');
    });

    it('should not filter by published for admin', async () => {
      mockPrisma.hubItem.findMany.mockResolvedValue([]);
      mockPrisma.hubItem.count.mockResolvedValue(0);

      await service.list({ page: 1, limit: 10 }, 'ADMIN');

      const whereArg = mockPrisma.hubItem.findMany.mock.calls[0][0].where;
      expect(whereArg.reviewStatus).toBeUndefined();
    });
  });

  describe('getById', () => {
    it('should throw NotFoundException for missing item', async () => {
      mockPrisma.hubItem.findUnique.mockResolvedValue(null);
      await expect(service.getById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should reject editing non-own items', async () => {
      mockPrisma.hubItem.findUnique.mockResolvedValue({
        id: 'h1',
        authorUserId: 'other-user',
        reviewStatus: 'draft',
        deletedAt: null,
      });

      await expect(
        service.update('h1', { title: 'new' }, 'my-user'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject editing non-draft items', async () => {
      mockPrisma.hubItem.findUnique.mockResolvedValue({
        id: 'h1',
        authorUserId: 'u1',
        reviewStatus: 'published',
        deletedAt: null,
      });

      await expect(
        service.update('h1', { title: 'new' }, 'u1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow editing rejected items', async () => {
      const existingItem = {
        id: 'h1',
        authorUserId: 'u1',
        reviewStatus: 'rejected',
        deletedAt: null,
      };
      mockPrisma.hubItem.findUnique
        .mockResolvedValueOnce(existingItem)  // for update check
        .mockResolvedValueOnce({              // for getById after update
          ...existingItem,
          title: 'fixed title',
          hubItemTags: [],
        });
      mockPrisma.hubItem.update.mockResolvedValue({ ...existingItem, title: 'fixed title' });

      const result = await service.update('h1', { title: 'fixed title' }, 'u1');
      expect(result).toBeDefined();
      expect(mockPrisma.hubItem.update).toHaveBeenCalled();
    });
  });

  describe('submitForReview', () => {
    it('should reject submitting non-draft items', async () => {
      mockPrisma.hubItem.findUnique.mockResolvedValue({
        id: 'h1',
        authorUserId: 'u1',
        reviewStatus: 'pending_review',
        deletedAt: null,
      });

      await expect(service.submitForReview('h1', 'u1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should allow re-submitting rejected items', async () => {
      const rejectedItem = {
        id: 'h1',
        authorUserId: 'u1',
        reviewStatus: 'rejected',
        rejectReason: 'Needs improvement',
        deletedAt: null,
      };
      mockPrisma.hubItem.findUnique
        .mockResolvedValueOnce(rejectedItem)  // for submitForReview check
        .mockResolvedValueOnce({              // for getById after submit
          ...rejectedItem,
          reviewStatus: 'pending_review',
          rejectReason: null,
          hubItemTags: [],
        });
      mockPrisma.hubItem.update.mockResolvedValue({
        ...rejectedItem,
        reviewStatus: 'pending_review',
        rejectReason: null,
      });

      const result = await service.submitForReview('h1', 'u1');
      expect(result).toBeDefined();
      // Verify rejectReason is cleared
      expect(mockPrisma.hubItem.update).toHaveBeenCalledWith({
        where: { id: 'h1' },
        data: { reviewStatus: 'pending_review', rejectReason: null },
      });
    });

    it('should reject submitting published items', async () => {
      mockPrisma.hubItem.findUnique.mockResolvedValue({
        id: 'h1',
        authorUserId: 'u1',
        reviewStatus: 'published',
        deletedAt: null,
      });

      await expect(service.submitForReview('h1', 'u1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('toggleLike', () => {
    it('should increment likes count', async () => {
      mockPrisma.hubItem.findUnique.mockResolvedValue({
        id: 'h1',
        deletedAt: null,
      });
      mockPrisma.hubItem.update.mockResolvedValue({ likesCount: 5 });

      const result = await service.toggleLike('h1', 'u1');
      expect(result).toEqual({ likes: 5 });
    });

    it('should throw NotFoundException for missing item', async () => {
      mockPrisma.hubItem.findUnique.mockResolvedValue(null);
      await expect(service.toggleLike('nonexistent', 'u1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('softDelete', () => {
    it('should reject deleting others items as non-admin', async () => {
      mockPrisma.hubItem.findUnique.mockResolvedValue({
        id: 'h1',
        authorUserId: 'other',
        deletedAt: null,
      });

      await expect(
        service.softDelete('h1', 'me', 'LEARNER'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
