import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { ChatMessage, LlmService } from './llm.service';
import { createAssistantUnavailableException } from './assistant.errors';

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private llm: LlmService,
  ) {}

  private getNormalizedLocale(locale?: string): 'zh' | 'en' {
    return locale?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  }

  private getNoRecommendationsReply(locale: 'zh' | 'en') {
    return locale === 'zh'
      ? '暂时没有找到与你问题匹配的人才或内容。你可以换一个更具体的关键词再试一次。'
      : 'No relevant people or content matched your request yet. Try a more specific query.';
  }

  private getAssistantUnavailableMessage(locale: 'zh' | 'en') {
    return locale === 'zh'
      ? 'AI 助手服务暂时不可用，请稍后重试。'
      : 'The AI assistant is temporarily unavailable. Please try again later.';
  }

  async recommend(
    userId: string,
    query: string,
    locale?: string,
    history?: Array<{ role: string; content: string }>,
  ) {
    const normalizedLocale = this.getNormalizedLocale(locale);
    const trimmedQuery = query.substring(0, 50);

    const allowed = await this.redis.checkRateLimit(
      `ratelimit:assist:${userId}`,
      10,
      60,
    );
    if (!allowed) {
      return {
        recommendations: [],
        message: 'Rate limit exceeded. Please wait.',
      };
    }

    await this.prisma.profile.findUnique({
      where: { userId },
      include: { profileTags: { include: { tag: true } } },
    });

    const userCandidates = await this.prisma.user.findMany({
      where: {
        status: 'active',
        deletedAt: null,
        profile: {
          OR: [
            { displayName: { contains: trimmedQuery, mode: 'insensitive' } },
            { headline: { contains: trimmedQuery, mode: 'insensitive' } },
            { bio: { contains: trimmedQuery, mode: 'insensitive' } },
          ],
        },
      },
      include: {
        profile: {
          include: { profileTags: { include: { tag: true } } },
        },
      },
      take: 5,
    });

    const contentCandidates = await this.prisma.hubItem.findMany({
      where: {
        deletedAt: null,
        reviewStatus: 'published',
        OR: [
          { title: { contains: trimmedQuery, mode: 'insensitive' } },
          { summary: { contains: trimmedQuery, mode: 'insensitive' } },
        ],
      },
      take: 5,
    });

    if (userCandidates.length === 0 && contentCandidates.length === 0) {
      return { reply: this.getNoRecommendationsReply(normalizedLocale) };
    }

    const allDescriptions: string[] = [];
    userCandidates.forEach((candidate, index) => {
      const profile = candidate.profile;
      allDescriptions.push(
        `[User ${index + 1}] id=${candidate.id} ${profile?.displayName || 'Unknown'} - ${profile?.headline || ''} - ${profile?.bio?.substring(0, 100) || ''}`,
      );
    });
    contentCandidates.forEach((candidate, index) => {
      allDescriptions.push(
        `[Content ${index + 1}] id=${candidate.id} ${candidate.title} - ${candidate.summary?.substring(0, 100) || ''}`,
      );
    });

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are an AI recommendation assistant for AI-World, a professional AI community platform.
Given a user's query and a list of users/content, select the most relevant match and explain why.
Respond in JSON format: { "reply": "<explanation in ${locale || 'en'}>", "recommendedUserId": "<user id or null>", "recommendedContentId": "<content id or null>" }
Only recommend the single best match. If no good match exists, set both IDs to null.`,
      },
    ];

    if (history && history.length > 0) {
      for (const item of history.slice(-6)) {
        const role =
          item.role === 'user'
            ? 'user'
            : item.role === 'system'
              ? 'system'
              : 'assistant';
        messages.push({ role, content: item.content });
      }
    }

    messages.push({
      role: 'user',
      content: `Query: ${query}\n\nCandidates:\n${allDescriptions.join('\n')}`,
    });

    try {
      const llmResponse = await this.llm.chat(messages, { temperature: 0.3 });
      const parsed = JSON.parse(llmResponse.content);

      return {
        reply: parsed.reply || undefined,
        recommendedUserId: parsed.recommendedUserId || undefined,
        recommendedContentId: parsed.recommendedContentId || undefined,
      };
    } catch (error) {
      this.logger.error('Assistant recommendation request failed', error);
      throw createAssistantUnavailableException(
        this.getAssistantUnavailableMessage(normalizedLocale),
      );
    }
  }
}
