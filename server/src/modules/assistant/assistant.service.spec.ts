import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { AssistantService } from './assistant.service';
import { ASSISTANT_UNAVAILABLE_ERROR_CODE } from './assistant.errors';
import { LlmService } from './llm.service';

const mockPrisma = {
  profile: {
    findUnique: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
  hubItem: {
    findMany: jest.fn(),
  },
};

const mockRedis = {
  checkRateLimit: jest.fn(),
};

const mockLlm = {
  chat: jest.fn(),
};

describe('AssistantService', () => {
  let service: AssistantService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRedis.checkRateLimit.mockResolvedValue(true);
    mockPrisma.profile.findUnique.mockResolvedValue(null);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.hubItem.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssistantService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: LlmService, useValue: mockLlm },
      ],
    }).compile();

    service = module.get(AssistantService);
  });

  it('returns a localized empty-result message when no candidates exist', async () => {
    const result = await service.recommend('user-1', 'unknown', 'zh-CN');

    expect(result).toEqual({
      reply:
        '暂时没有找到与你问题匹配的人才或内容。你可以换一个更具体的关键词再试一次。',
    });
    expect(mockLlm.chat).not.toHaveBeenCalled();
  });

  it('returns parsed recommendations from the LLM response', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: 'expert-1',
        profile: {
          displayName: 'Expert One',
          headline: 'NLP',
          bio: 'Builds production NLP systems',
        },
      },
    ]);
    mockLlm.chat.mockResolvedValue({
      content: JSON.stringify({
        reply: 'Expert One is the best match for NLP system design.',
        recommendedUserId: 'expert-1',
      }),
    });

    const result = await service.recommend('user-1', 'NLP');

    expect(result).toEqual({
      reply: 'Expert One is the best match for NLP system design.',
      recommendedUserId: 'expert-1',
      recommendedContentId: undefined,
    });
  });

  it('throws a structured 503 when the LLM call fails', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: 'expert-1',
        profile: {
          displayName: 'Expert One',
          headline: 'NLP',
          bio: 'Builds production NLP systems',
        },
      },
    ]);
    mockLlm.chat.mockRejectedValue(new Error('upstream timeout'));

    await expect(service.recommend('user-1', 'NLP')).rejects.toMatchObject({
      response: {
        errorCode: ASSISTANT_UNAVAILABLE_ERROR_CODE,
        message: 'The AI assistant is temporarily unavailable. Please try again later.',
      },
      status: 503,
    });
  });

  it('throws the same structured 503 when the LLM response is invalid JSON', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: 'expert-1',
        profile: {
          displayName: 'Expert One',
          headline: 'NLP',
          bio: 'Builds production NLP systems',
        },
      },
    ]);
    mockLlm.chat.mockResolvedValue({
      content: 'not-json',
    });

    try {
      await service.recommend('user-1', 'NLP', 'en');
      fail('Expected ServiceUnavailableException');
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect((error as ServiceUnavailableException).getResponse()).toEqual({
        errorCode: ASSISTANT_UNAVAILABLE_ERROR_CODE,
        message: 'The AI assistant is temporarily unavailable. Please try again later.',
      });
    }
  });
});
