import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/node';

@Injectable()
export class ExceptionTrackerService {
  private readonly logger = new Logger(ExceptionTrackerService.name);
  private readonly sentryEnabled: boolean;

  constructor(private readonly configService: ConfigService) {
    const dsn = this.configService.get<string>('SENTRY_DSN');
    const env = this.configService.get<string>('NODE_ENV', 'development');
    const release = this.configService.get<string>('APP_VERSION', 'local-dev');

    if (dsn) {
      Sentry.init({
        dsn,
        environment: env,
        release,
        tracesSampleRate: Number(this.configService.get<string>('SENTRY_TRACES_SAMPLE_RATE', '0.1')),
      });
      this.sentryEnabled = true;
      this.logger.log('Sentry exception tracking enabled');
    } else {
      this.sentryEnabled = false;
      this.logger.warn('Sentry DSN not configured, exception tracking disabled');
    }
  }

  captureException(exception: unknown, context: Record<string, unknown> = {}): void {
    if (!this.sentryEnabled) return;

    Sentry.withScope((scope) => {
      for (const [key, value] of Object.entries(context)) {
        scope.setExtra(key, value as any);
      }
      Sentry.captureException(exception);
    });
  }
}
