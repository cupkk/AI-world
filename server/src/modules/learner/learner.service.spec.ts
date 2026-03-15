import { Test, TestingModule } from '@nestjs/testing';
import { LearnerService } from './learner.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ApplicationsService } from '../applications/applications.service';

const mockPrisma: any = {
  hubItem: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  application: {
    findMany: jest.fn(),
  },
};

const mockApplicationsService = {
  listOutbox: jest.fn(),
};

describe('LearnerService', () => {
  let service: LearnerService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockApplicationsService.listOutbox.mockReset();
    mockApplicationsService.listOutbox.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LearnerService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ApplicationsService, useValue: mockApplicationsService },
      ],
    }).compile();

    service = module.get(LearnerService);
  });

  it('returns aggregated learner dashboard data', async () => {
    mockPrisma.hubItem.findMany
      .mockResolvedValueOnce([
        {
          id: 'mine-1',
          title: 'My Pending Submission',
          summary: 'Waiting for review',
          type: 'paper',
          reviewStatus: 'pending_review',
          authorUserId: 'learner-1',
          createdAt: new Date('2026-03-14T09:00:00.000Z'),
          likesCount: 1,
          viewsCount: 4,
          hubItemTags: [{ tag: { name: 'AI' } }],
          author: { id: 'learner-1', role: 'LEARNER' },
        },
        {
          id: 'mine-2',
          title: 'My Published Submission',
          summary: 'Already live',
          type: 'tool',
          reviewStatus: 'published',
          authorUserId: 'learner-1',
          createdAt: new Date('2026-03-13T09:00:00.000Z'),
          likesCount: 3,
          viewsCount: 12,
          hubItemTags: [{ tag: { name: 'Tooling' } }],
          author: { id: 'learner-1', role: 'LEARNER' },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'pub-1',
          title: 'Starter Paper',
          summary: 'Learn the basics',
          type: 'paper',
          reviewStatus: 'published',
          authorUserId: 'expert-1',
          createdAt: new Date('2026-03-14T10:00:00.000Z'),
          likesCount: 5,
          viewsCount: 40,
          hubItemTags: [{ tag: { name: 'NLP' } }],
          author: { id: 'expert-1', role: 'EXPERT' },
        },
        {
          id: 'pub-2',
          title: 'Research Contest',
          summary: 'Participate now',
          type: 'contest',
          reviewStatus: 'published',
          authorUserId: 'expert-2',
          createdAt: new Date('2026-03-14T08:00:00.000Z'),
          likesCount: 2,
          viewsCount: 18,
          hubItemTags: [{ tag: { name: 'Contest' } }],
          author: { id: 'expert-2', role: 'EXPERT' },
        },
      ]);
    mockPrisma.hubItem.count.mockResolvedValue(9);
    mockApplicationsService.listOutbox.mockResolvedValue([
      {
        id: 'app-1',
        applicantId: 'learner-1',
        targetType: 'PROJECT',
        targetId: 'pub-2',
        message: 'Count me in',
        status: 'SUBMITTED',
        createdAt: new Date('2026-03-14T11:00:00.000Z').toISOString(),
        target: {
          id: 'pub-2',
          targetType: 'PROJECT',
          contentType: 'CONTEST',
          title: 'Research Contest',
          status: 'PUBLISHED',
          ownerId: 'expert-2',
        },
        targetContentTitle: 'Research Contest',
      },
    ]);

    const result = await service.getDashboard('learner-1');

    expect(result).toEqual({
      stats: {
        publishedContentCount: 1,
        availableContentCount: 9,
        pendingReviewCount: 1,
        applicationCount: 1,
      },
      learningResources: [
        expect.objectContaining({
          id: 'pub-1',
          title: 'Starter Paper',
          status: 'PUBLISHED',
        }),
      ],
      projectOpportunities: [
        expect.objectContaining({
          id: 'pub-2',
          type: 'CONTEST',
        }),
      ],
      recommendedContents: [
        expect.objectContaining({ id: 'pub-1' }),
        expect.objectContaining({ id: 'pub-2' }),
      ],
      myContents: [
        expect.objectContaining({
          id: 'mine-1',
          status: 'PENDING_REVIEW',
        }),
        expect.objectContaining({
          id: 'mine-2',
          status: 'PUBLISHED',
        }),
      ],
      applications: [
        expect.objectContaining({
          id: 'app-1',
          applicantId: 'learner-1',
          targetType: 'PROJECT',
          status: 'SUBMITTED',
          targetContentTitle: 'Research Contest',
        }),
      ],
    });
  });
});
