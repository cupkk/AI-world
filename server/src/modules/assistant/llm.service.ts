/**
 * Multi-provider LLM Service
 * Supports OpenAI, Qwen (通义千问), and more via factory pattern.
 * Provider is selected at runtime via LLM_PROVIDER env var.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isProductionEnv, parseBooleanFlag } from '../../common/config/runtime.util';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmChatResponse {
  content: string;
  usage?: { promptTokens: number; completionTokens: number };
}

export interface EmbeddingResponse {
  embedding: number[];
  dimensions: number;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly provider: string;
  private readonly apiKey: string;
  private readonly embeddingModel: string;
  private readonly chatModel: string;
  private readonly openAiBaseUrl: string;
  private readonly qwenBaseUrl: string;
  private readonly requireLlm: boolean;
  private readonly maxRetries = 3;

  constructor(private config: ConfigService) {
    this.provider = config.get<string>('LLM_PROVIDER', 'openai');
    this.apiKey = config.get<string>('LLM_API_KEY', '');
    const nodeEnv = config.get<string>('NODE_ENV', 'development');
    this.requireLlm = parseBooleanFlag(
      config.get<string>('REQUIRE_LLM'),
      isProductionEnv(nodeEnv),
    );
    this.chatModel = config.get<string>(
      'LLM_CHAT_MODEL',
      this.provider === 'qwen' ? 'qwen-max' : 'gpt-4o',
    );
    this.embeddingModel = config.get<string>('EMBEDDING_MODEL', 'text-embedding-3-small');
    this.openAiBaseUrl = config
      .get<string>('OPENAI_BASE_URL', 'https://api.openai.com/v1')
      .replace(/\/$/, '');
    this.qwenBaseUrl = config
      .get<string>('QWEN_BASE_URL', 'https://dashscope.aliyuncs.com/compatible-mode/v1')
      .replace(/\/$/, '');

    if (this.requireLlm && !this.apiKey) {
      throw new Error(
        `LLM is required in this environment. Configure LLM_API_KEY for provider "${this.provider}".`,
      );
    }
  }

  private ensureConfigured(operation: 'chat' | 'embedding') {
    if (!this.apiKey) {
      throw new Error(
        `LLM_API_KEY is not configured for ${this.provider} ${operation} requests.`,
      );
    }
  }

  /**
   * Retry wrapper with exponential backoff.
   * Retries on network errors and 429/5xx status codes.
   */
  private async withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err: any) {
        lastError = err;
        const isRetryable =
          err.message?.includes('fetch failed') ||
          err.message?.includes('ECONNRESET') ||
          err.message?.includes('429') ||
          err.message?.includes('5');
        if (!isRetryable || attempt === this.maxRetries) break;
        const delay = Math.min(1000 * 2 ** attempt, 8000);
        this.logger.warn(`${label} attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw lastError;
  }

  /**
   * Chat completion (multi-provider)
   */
  async chat(messages: ChatMessage[], options?: { temperature?: number; maxTokens?: number }): Promise<LlmChatResponse> {
    switch (this.provider) {
      case 'openai':
        return this.chatOpenAI(messages, options);
      case 'qwen':
        return this.chatQwen(messages, options);
      default:
        throw new Error(`Unsupported LLM provider: ${this.provider}`);
    }
  }

  /**
   * Generate embedding (multi-provider)
   */
  async embed(text: string): Promise<EmbeddingResponse> {
    switch (this.provider) {
      case 'openai':
        return this.embedOpenAI(text);
      case 'qwen':
        return this.embedQwen(text);
      default:
        throw new Error(`Unsupported embedding provider: ${this.provider}`);
    }
  }

  // ---- OpenAI ----

  private async chatOpenAI(messages: ChatMessage[], options?: { temperature?: number; maxTokens?: number }): Promise<LlmChatResponse> {
    return this.withRetry('chatOpenAI', async () => {
    this.ensureConfigured('chat');
    const response = await fetch(`${this.openAiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.chatModel,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 1024,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      this.logger.error('OpenAI API error', data);
      throw new Error(`OpenAI API error: ${data.error?.message || 'Unknown'}`);
    }

    return {
      content: data.choices[0].message.content,
      usage: data.usage
        ? { promptTokens: data.usage.prompt_tokens, completionTokens: data.usage.completion_tokens }
        : undefined,
    };
    });
  }

  private async embedOpenAI(text: string): Promise<EmbeddingResponse> {
    return this.withRetry('embedOpenAI', async () => {
    this.ensureConfigured('embedding');
    const response = await fetch(`${this.openAiBaseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.embeddingModel,
        input: text,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      this.logger.error('OpenAI Embedding error', data);
      throw new Error(`OpenAI Embedding error: ${data.error?.message || 'Unknown'}`);
    }

    const embedding = data.data[0].embedding;
    return { embedding, dimensions: embedding.length };
    });
  }

  // ---- Qwen (通义千问) ----

  private async chatQwen(messages: ChatMessage[], options?: { temperature?: number; maxTokens?: number }): Promise<LlmChatResponse> {
    return this.withRetry('chatQwen', async () => {
    this.ensureConfigured('chat');
    const response = await fetch(`${this.qwenBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.chatModel,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 1024,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      this.logger.error('Qwen API error', data);
      throw new Error(`Qwen API error: ${JSON.stringify(data)}`);
    }

    return {
      content: data.choices[0].message.content,
      usage: data.usage
        ? { promptTokens: data.usage.prompt_tokens, completionTokens: data.usage.completion_tokens }
        : undefined,
    };
    });
  }

  private async embedQwen(text: string): Promise<EmbeddingResponse> {
    return this.withRetry('embedQwen', async () => {
    this.ensureConfigured('embedding');
    const response = await fetch(`${this.qwenBaseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.embeddingModel || 'text-embedding-v2',
        input: text,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      this.logger.error('Qwen Embedding error', data);
      throw new Error(`Qwen Embedding error: ${JSON.stringify(data)}`);
    }

    const embedding = data.data[0].embedding;
    return { embedding, dimensions: embedding.length };
    });
  }
}
