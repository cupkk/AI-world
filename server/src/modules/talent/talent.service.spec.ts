import { Test, TestingModule } from '@nestjs/testing';
import { TalentService } from './talent.service';
import { PrismaService } from '../../common/prisma/prisma.service';

const mockPrisma: any = {
  user: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

describe('TalentService', () => {
  let service: TalentService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TalentService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(TalentService);
  });

  describe('search', () => {
    it('returns paginated serialized users with masked emails', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: 'user-1',
          email: 'learner@example.com',
          role: 'LEARNER',
          status: 'active',
          profile: {
            displayName: 'Learner One',
            avatarUrl: null,
            bio: 'AI builder',
            org: 'AI World',
            headline: 'Product learner',
            emailVisibility: 'masked',
            profileTags: [{ tag: { name: 'AI' } }],
          },
        },
      ]);
      mockPrisma.user.count.mockResolvedValue(1);

      const result = await service.search({
        q: 'learner',
        tags: 'AI,NLP',
        role: 'LEARNER',
        page: 1,
        limit: 5,
      });

      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(5);
      expect(result.items[0]).toEqual(
        expect.objectContaining({
          id: 'user-1',
          name: 'Learner One',
          email: 'l***@example.com',
          role: 'LEARNER',
          skills: ['AI'],
        }),
      );

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'active',
            deletedAt: null,
            role: 'LEARNER',
          },
          include: {
            profile: {
              include: {
                profileTags: { include: { tag: true } },
              },
            },
          },
        }),
      );
    });

    it('falls back to the default pagination and base active filter', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      const result = await service.search({});

      expect(result).toEqual({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
      });
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'active',
            deletedAt: null,
          },
        }),
      );
    });
  });
});
