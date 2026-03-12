import { Controller, Get, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { metricsRegistry } from '../../common/observability/metrics';
import { Response } from 'express';

@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  @Get('health')
  @Public()
  @ApiOperation({ summary: 'Health check — DB + Redis connectivity' })
  async health() {
    const checks: Record<string, string> = {};

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = 'ok';
    } catch {
      checks.database = 'error';
    }

    try {
      await this.redis.client.ping();
      checks.redis = 'ok';
    } catch {
      checks.redis = 'error';
    }

    const healthy = Object.values(checks).every((v) => v === 'ok');
    return {
      status: healthy ? 'healthy' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @Public()
  @ApiOperation({ summary: 'Readiness check — is the service ready to serve traffic' })
  async ready() {
    return { status: 'ready', timestamp: new Date().toISOString() };
  }

  @Get('metrics')
  @Public()
  @ApiOperation({ summary: 'Prometheus metrics endpoint' })
  async metrics(@Res() res: Response) {
    res.setHeader('Content-Type', metricsRegistry.contentType);
    res.send(await metricsRegistry.metrics());
  }
}
