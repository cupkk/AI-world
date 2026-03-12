import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  public readonly client: Redis;

  constructor(private configService: ConfigService) {
    this.client = new Redis(
      this.configService.get<string>('REDIS_URL', 'redis://localhost:6379'),
    );

    this.client.on('connect', () => {
      this.logger.log('Redis connected');
    });

    this.client.on('error', (err) => {
      this.logger.error('Redis error', err);
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
    this.logger.log('Redis disconnected');
  }

  // Rate limiting helper
  async checkRateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
    const current = await this.client.incr(key);
    if (current === 1) {
      await this.client.expire(key, windowSec);
    }
    return current <= limit;
  }

  // Session-related helpers
  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }
}
