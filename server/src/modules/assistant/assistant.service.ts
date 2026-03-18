import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { ChatMessage, LlmService } from './llm.service';
import { createAssistantUnavailableException } from './assistant.errors';
import {
  isLocalDevelopmentEnv,
  parseBooleanFlag,
} from '../../common/config/runtime.util';

type SupportedLocale = 'zh' | 'en';

type AssistantHistoryItem = {
  role: string;
  content: string;
};

type AssistantKnowledgeSource = {
  fileId: string;
  fileName: string;
  excerpt: string;
  score?: number;
};

type AssistantJsonResponse = {
  reply?: string | null;
  recommendedUserId?: string | null;
  recommendedContentId?: string | null;
};

type KnowledgeChunkRow = {
  fileId: string;
  fileName: string;
  excerpt: string;
  score: number | string | null;
};

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private llm: LlmService,
    private configService: ConfigService,
  ) {}

  private isAssistantEnabled(): boolean {
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    return parseBooleanFlag(
      this.configService.get<string>('ENABLE_ASSISTANT'),
      isLocalDevelopmentEnv(nodeEnv),
    );
  }

  private isKnowledgeBaseEnabled(): boolean {
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    return parseBooleanFlag(
      this.configService.get<string>('ENABLE_KNOWLEDGE_BASE'),
      isLocalDevelopmentEnv(nodeEnv),
    );
  }

  private getNormalizedLocale(locale?: string): SupportedLocale {
    return locale?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  }

  private getNoRecommendationsReply(locale: SupportedLocale) {
    return locale === 'zh'
      ? '暂时没有找到与你问题匹配的人才、内容或个人知识库资料。你可以换一个更具体的关键词再试一次。'
      : 'No relevant people, content, or personal knowledge matched your request yet. Try a more specific query.';
  }

  private getAssistantUnavailableMessage(locale: SupportedLocale) {
    return locale === 'zh'
      ? 'AI 助手服务暂时不可用，请稍后重试。'
      : 'The AI assistant is temporarily unavailable. Please try again later.';
  }

  private getRateLimitMessage(locale: SupportedLocale) {
    return locale === 'zh'
      ? '请求过于频繁，请稍后再试。'
      : 'Rate limit exceeded. Please wait a moment and try again.';
  }

  private getProfileSummary(profile: any, locale: SupportedLocale) {
    if (!profile) {
      return locale === 'zh'
        ? '当前用户还没有完善个人资料。'
        : 'The current user has not completed a profile yet.';
    }

    const tagNames = Array.isArray(profile.profileTags)
      ? profile.profileTags
          .map((item: any) => item?.tag?.name)
          .filter((item: unknown): item is string => typeof item === 'string')
      : [];

    const fields = [
      profile.displayName ? `Name: ${profile.displayName}` : null,
      profile.headline ? `Headline: ${profile.headline}` : null,
      profile.bio ? `Bio: ${this.trimText(profile.bio, 240)}` : null,
      profile.whatImDoing
        ? `What I'm doing: ${this.trimText(profile.whatImDoing, 200)}`
        : null,
      profile.whatICanProvide
        ? `What I can provide: ${this.trimText(profile.whatICanProvide, 200)}`
        : null,
      profile.whatImLookingFor
        ? `What I'm looking for: ${this.trimText(profile.whatImLookingFor, 200)}`
        : null,
      profile.aiStrategy
        ? `AI strategy: ${this.trimText(profile.aiStrategy, 200)}`
        : null,
      tagNames.length > 0 ? `Tags: ${tagNames.join(', ')}` : null,
    ].filter((item): item is string => Boolean(item));

    if (fields.length === 0) {
      return locale === 'zh'
        ? '当前用户资料为空。'
        : 'The current user profile is empty.';
    }

    return fields.join('\n');
  }

  private trimText(text: string, maxLength: number) {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) {
      return normalized;
    }
    return `${normalized.slice(0, maxLength - 3)}...`;
  }

  private toChatRole(role: string): ChatMessage['role'] {
    if (role === 'user' || role === 'system') {
      return role;
    }
    return 'assistant';
  }

  private toVectorLiteral(embedding: number[]) {
    return `[${embedding
      .map((value) => (Number.isFinite(value) ? value : 0))
      .join(',')}]`;
  }

  private normalizeScore(raw: number | string | null | undefined) {
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return Math.max(0, Math.min(1, raw));
    }

    if (typeof raw === 'string') {
      const nextValue = Number(raw);
      if (Number.isFinite(nextValue)) {
        return Math.max(0, Math.min(1, nextValue));
      }
    }

    return undefined;
  }

  private parseAssistantResponse(rawContent: string): AssistantJsonResponse {
    const fencedMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fencedMatch?.[1]?.trim() ?? rawContent.trim();
    const startIndex = candidate.indexOf('{');
    const endIndex = candidate.lastIndexOf('}');
    const normalized =
      startIndex >= 0 && endIndex > startIndex
        ? candidate.slice(startIndex, endIndex + 1)
        : candidate;

    return JSON.parse(normalized) as AssistantJsonResponse;
  }

  private async searchKnowledgeBase(
    userId: string,
    query: string,
  ): Promise<AssistantKnowledgeSource[]> {
    const { embedding } = await this.llm.embed(query);
    const vectorLiteral = this.toVectorLiteral(embedding);
    const rows = await this.prisma.$queryRawUnsafe<KnowledgeChunkRow[]>(
      `
        SELECT
          kc.id AS "chunkId",
          kf.id AS "fileId",
          kf.file_name AS "fileName",
          kc.text AS "excerpt",
          1 - (kc.embedding <=> $2::vector) AS "score"
        FROM kb_chunks kc
        INNER JOIN kb_files kf ON kf.id = kc.kb_file_id
        WHERE kc.owner_user_id = $1::uuid
          AND kf.status = 'ready'
          AND kc.embedding IS NOT NULL
        ORDER BY kc.embedding <=> $2::vector
        LIMIT 3
      `,
      userId,
      vectorLiteral,
    );

    return rows.map((item) => ({
      fileId: item.fileId,
      fileName: item.fileName,
      excerpt: this.trimText(item.excerpt, 260),
      score: this.normalizeScore(item.score),
    }));
  }

  async recommend(
    userId: string,
    query: string,
    locale?: string,
    history?: AssistantHistoryItem[],
  ) {
    const normalizedLocale = this.getNormalizedLocale(locale);

    if (!this.isAssistantEnabled()) {
      throw createAssistantUnavailableException(
        this.getAssistantUnavailableMessage(normalizedLocale),
      );
    }

    const trimmedQuery = query.trim().slice(0, 1000);
    const keywordQuery = trimmedQuery.slice(0, 160);
    const knowledgeBaseEnabled = this.isKnowledgeBaseEnabled();

    if (!trimmedQuery) {
      return {
        reply: this.getNoRecommendationsReply(normalizedLocale),
        knowledgeBaseReadyCount: 0,
        knowledgeSources: [],
      };
    }

    const allowed = await this.redis.checkRateLimit(
      `ratelimit:assist:${userId}`,
      10,
      60,
    );
    if (!allowed) {
      return {
        reply: this.getRateLimitMessage(normalizedLocale),
        knowledgeBaseReadyCount: 0,
      };
    }

    const [profile, knowledgeBaseReadyCount, userCandidates, contentCandidates] =
      await Promise.all([
        this.prisma.profile.findUnique({
          where: { userId },
          include: { profileTags: { include: { tag: true } } },
        }),
        knowledgeBaseEnabled
          ? this.prisma.kbFile.count({
              where: { ownerUserId: userId, status: 'ready' },
            })
          : Promise.resolve(0),
        this.prisma.user.findMany({
          where: {
            id: { not: userId },
            status: 'active',
            deletedAt: null,
            profile: {
              OR: [
                { displayName: { contains: keywordQuery, mode: 'insensitive' } },
                { headline: { contains: keywordQuery, mode: 'insensitive' } },
                { bio: { contains: keywordQuery, mode: 'insensitive' } },
                {
                  profileTags: {
                    some: {
                      tag: { name: { contains: keywordQuery, mode: 'insensitive' } },
                    },
                  },
                },
              ],
            },
          },
          include: {
            profile: {
              include: { profileTags: { include: { tag: true } } },
            },
          },
          take: 5,
        }),
        this.prisma.hubItem.findMany({
          where: {
            deletedAt: null,
            reviewStatus: 'published',
            OR: [
              { title: { contains: keywordQuery, mode: 'insensitive' } },
              { summary: { contains: keywordQuery, mode: 'insensitive' } },
              {
                hubItemTags: {
                  some: {
                    tag: { name: { contains: keywordQuery, mode: 'insensitive' } },
                  },
                },
              },
            ],
          },
          include: {
            hubItemTags: {
              include: { tag: true },
            },
          },
          take: 5,
        }),
      ]);

    let knowledgeSources: AssistantKnowledgeSource[] = [];
    if (knowledgeBaseEnabled && knowledgeBaseReadyCount > 0 && trimmedQuery) {
      try {
        knowledgeSources = await this.searchKnowledgeBase(userId, trimmedQuery);
      } catch (error: any) {
        this.logger.warn(
          `Knowledge base retrieval failed for user ${userId}: ${
            error?.message ?? 'Unknown error'
          }`,
        );
      }
    }

    if (
      userCandidates.length === 0 &&
      contentCandidates.length === 0 &&
      knowledgeSources.length === 0
    ) {
      return {
        reply: this.getNoRecommendationsReply(normalizedLocale),
        knowledgeBaseReadyCount,
        knowledgeSources: [],
      };
    }

    const candidateDescriptions: string[] = [];

    userCandidates.forEach((candidate, index) => {
      const profileTags = Array.isArray(candidate.profile?.profileTags)
        ? candidate.profile.profileTags
            .map((item: any) => item?.tag?.name)
            .filter((item: unknown): item is string => typeof item === 'string')
        : [];

      candidateDescriptions.push(
        [
          `[User ${index + 1}]`,
          `id=${candidate.id}`,
          `name=${candidate.profile?.displayName || 'Unknown'}`,
          `headline=${candidate.profile?.headline || ''}`,
          `bio=${this.trimText(candidate.profile?.bio || '', 140)}`,
          profileTags.length > 0 ? `tags=${profileTags.join(', ')}` : null,
        ]
          .filter((item): item is string => Boolean(item))
          .join(' '),
      );
    });

    contentCandidates.forEach((candidate, index) => {
      const tagNames = Array.isArray(candidate.hubItemTags)
        ? candidate.hubItemTags
            .map((item: any) => item?.tag?.name)
            .filter((item: unknown): item is string => typeof item === 'string')
        : [];

      candidateDescriptions.push(
        [
          `[Content ${index + 1}]`,
          `id=${candidate.id}`,
          `title=${candidate.title}`,
          `summary=${this.trimText(candidate.summary || '', 140)}`,
          tagNames.length > 0 ? `tags=${tagNames.join(', ')}` : null,
        ]
          .filter((item): item is string => Boolean(item))
          .join(' '),
      );
    });

    const knowledgeDescriptions =
      knowledgeSources.length > 0
        ? knowledgeSources
            .map(
              (source, index) =>
                `[KB ${index + 1}] file=${source.fileName} excerpt=${source.excerpt}`,
            )
            .join('\n')
        : 'None';

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are the AI-World assistant for a professional AI community platform.
Use the provided context only.
Priority order for grounding:
1. The current user's personal knowledge base snippets
2. The current user's profile
3. Public people and public content candidates

Return strict JSON only:
{
  "reply": "<answer in ${normalizedLocale === 'zh' ? 'Simplified Chinese' : 'English'}>",
  "recommendedUserId": "<single best public user id or null>",
  "recommendedContentId": "<single best public content id or null>"
}

Rules:
- Recommend at most one public user and at most one public content item.
- If knowledge-base snippets are relevant, mention them in the reply.
- If no public recommendation is justified, return null for the IDs.
- Do not invent facts beyond the provided context.`,
      },
    ];

    if (history && history.length > 0) {
      for (const item of history.slice(-6)) {
        messages.push({
          role: this.toChatRole(item.role),
          content: item.content,
        });
      }
    }

    messages.push({
      role: 'user',
      content: [
        `User query: ${trimmedQuery}`,
        '',
        'Current user profile:',
        this.getProfileSummary(profile, normalizedLocale),
        '',
        `Knowledge base ready files: ${knowledgeBaseReadyCount}`,
        'Knowledge base snippets:',
        knowledgeDescriptions,
        '',
        'Public candidates:',
        candidateDescriptions.length > 0 ? candidateDescriptions.join('\n') : 'None',
      ].join('\n'),
    });

    try {
      const llmResponse = await this.llm.chat(messages, {
        temperature: 0.2,
        maxTokens: 600,
      });
      const parsed = this.parseAssistantResponse(llmResponse.content);

      return {
        reply:
          typeof parsed.reply === 'string' && parsed.reply.trim().length > 0
            ? parsed.reply.trim()
            : undefined,
        recommendedUserId:
          typeof parsed.recommendedUserId === 'string' &&
          parsed.recommendedUserId.trim().length > 0
            ? parsed.recommendedUserId
            : undefined,
        recommendedContentId:
          typeof parsed.recommendedContentId === 'string' &&
          parsed.recommendedContentId.trim().length > 0
            ? parsed.recommendedContentId
            : undefined,
        knowledgeSources,
        knowledgeBaseReadyCount,
      };
    } catch (error) {
      this.logger.error('Assistant recommendation request failed', error);
      throw createAssistantUnavailableException(
        this.getAssistantUnavailableMessage(normalizedLocale),
      );
    }
  }
}
