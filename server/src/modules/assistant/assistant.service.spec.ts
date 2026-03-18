import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  kbFile: {
    count: jest.fn(),
  },
  $queryRawUnsafe: jest.fn(),
};

const mockRedis = {
  checkRateLimit: jest.fn(),
};

const mockLlm = {
  chat: jest.fn(),
  embed: jest.fn(),
};

const defaultConfigValues: Record<string, string> = {
  NODE_ENV: 'development',
  ENABLE_ASSISTANT: '',
  ENABLE_KNOWLEDGE_BASE: '',
};

function getConfigValue(key: string, fallback?: any) {
  return defaultConfigValues[key] ?? fallback;
}

const mockConfig = {
  get: jest.fn(getConfigValue),
};

describe('AssistantService', () => {
  let service: AssistantService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfig.get.mockImplementation(getConfigValue);
    mockRedis.checkRateLimit.mockResolvedValue(true);
    mockPrisma.profile.findUnique.mockResolvedValue(null);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.hubItem.findMany.mockResolvedValue([]);
    mockPrisma.kbFile.count.mockResolvedValue(0);
    mockPrisma.$queryRawUnsafe.mockResolvedValue([]);
    mockLlm.embed.mockResolvedValue({
      embedding: [0.01, 0.02, 0.03],
      dimensions: 3,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssistantService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: LlmService, useValue: mockLlm },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get(AssistantService);
  });

  it('returns a localized empty-result message when no candidates or knowledge snippets exist', async () => {
    const result = await service.recommend('user-1', 'unknown', 'zh-CN');

    expect(result).toEqual({
      reply:
        '暂时没有找到与你问题匹配的人才、内容或个人知识库资料。你可以换一个更具体的关键词再试一次。',
      knowledgeBaseReadyCount: 0,
      knowledgeSources: [],
    });
    expect(mockLlm.chat).not.toHaveBeenCalled();
  });

  it('throws a structured 503 when the assistant feature flag is disabled', async () => {
    mockConfig.get.mockImplementation((key: string, fallback?: any) => {
      const map: Record<string, string> = {
        NODE_ENV: 'production',
        ENABLE_ASSISTANT: 'false',
      };
      return map[key] ?? fallback;
    });

    await expect(service.recommend('user-1', 'unknown')).rejects.toMatchObject({
      response: {
        errorCode: ASSISTANT_UNAVAILABLE_ERROR_CODE,
        message: 'The AI assistant is temporarily unavailable. Please try again later.',
      },
      status: 503,
    });
    expect(mockRedis.checkRateLimit).not.toHaveBeenCalled();
  });

  it('returns parsed recommendations with knowledge-base sources', async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({
      displayName: 'Learner One',
      headline: 'Building NLP copilots',
      profileTags: [{ tag: { name: 'NLP' } }],
    });
    mockPrisma.kbFile.count.mockResolvedValue(2);
    mockPrisma.$queryRawUnsafe.mockResolvedValue([
      {
        fileId: 'kb-file-1',
        fileName: 'nlp-notes.pdf',
        excerpt: 'Built production NLP copilots for enterprise search and support.',
        score: 0.91,
      },
    ]);
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: 'expert-1',
        profile: {
          displayName: 'Expert One',
          headline: 'NLP systems',
          bio: 'Builds production NLP systems',
          profileTags: [{ tag: { name: 'NLP' } }],
        },
      },
    ]);
    mockPrisma.hubItem.findMany.mockResolvedValue([
      {
        id: 'content-1',
        title: 'NLP Systems Handbook',
        summary: 'A practical guide to NLP delivery.',
        hubItemTags: [{ tag: { name: 'NLP' } }],
      },
    ]);
    mockLlm.chat.mockResolvedValue({
      content: JSON.stringify({
        reply: 'Expert One is the best fit, and your own notes show strong NLP product context.',
        recommendedUserId: 'expert-1',
        recommendedContentId: 'content-1',
      }),
    });

    const result = await service.recommend('user-1', 'NLP');

    expect(mockLlm.embed).toHaveBeenCalledWith('NLP');
    expect(result).toEqual({
      reply:
        'Expert One is the best fit, and your own notes show strong NLP product context.',
      recommendedUserId: 'expert-1',
      recommendedContentId: 'content-1',
      knowledgeBaseReadyCount: 2,
      knowledgeSources: [
        {
          fileId: 'kb-file-1',
          fileName: 'nlp-notes.pdf',
          excerpt:
            'Built production NLP copilots for enterprise search and support.',
          score: 0.91,
        },
      ],
    });
  });

  it('continues without knowledge-base snippets when embedding retrieval fails', async () => {
    mockPrisma.kbFile.count.mockResolvedValue(1);
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: 'expert-1',
        profile: {
          displayName: 'Expert One',
          headline: 'NLP',
          bio: 'Builds production NLP systems',
          profileTags: [],
        },
      },
    ]);
    mockLlm.embed.mockRejectedValue(new Error('embedding service unavailable'));
    mockLlm.chat.mockResolvedValue({
      content: JSON.stringify({
        reply: 'Expert One is the best match for your NLP question.',
        recommendedUserId: 'expert-1',
      }),
    });

    const result = await service.recommend('user-1', 'NLP');

    expect(result).toEqual({
      reply: 'Expert One is the best match for your NLP question.',
      recommendedUserId: 'expert-1',
      recommendedContentId: undefined,
      knowledgeBaseReadyCount: 1,
      knowledgeSources: [],
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
          profileTags: [],
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
          profileTags: [],
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
