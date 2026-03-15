import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { StorageModule } from './common/storage/storage.module';
import { MailModule } from './common/mail/mail.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProfileModule } from './modules/profile/profile.module';
import { HubModule } from './modules/hub/hub.module';
import { TalentModule } from './modules/talent/talent.module';
import { EnterpriseModule } from './modules/enterprise/enterprise.module';
import { ExpertModule } from './modules/expert/expert.module';
import { LearnerModule } from './modules/learner/learner.module';
import { ApplicationsModule } from './modules/applications/applications.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { KbModule } from './modules/kb/kb.module';
import { AssistantModule } from './modules/assistant/assistant.module';
import { AdminModule } from './modules/admin/admin.module';
import { PublishModule } from './modules/publish/publish.module';
import { RequestObservabilityMiddleware } from './common/observability/request-observability.middleware';
import { CsrfMiddleware } from './common/middleware/csrf.middleware';
import { ExceptionTrackerService } from './common/observability/exception-tracker.service';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AuthGuard } from './common/guards/auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { ActiveUserGuard } from './common/guards/active-user.guard';

@Module({
  imports: [
    // Global config
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,   // 1 second
        limit: 10,   // 10 requests per second
      },
      {
        name: 'medium',
        ttl: 60000,  // 1 minute
        limit: 60,   // 60 requests per minute
      },
    ]),

    // Infrastructure
    PrismaModule,
    RedisModule,
    StorageModule,
    MailModule,

    // Feature modules
    HealthModule,
    AuthModule,
    ProfileModule,
    HubModule,
    TalentModule,
    EnterpriseModule,
    ExpertModule,
    LearnerModule,
    ApplicationsModule,
    MessagingModule,
    KbModule,
    AssistantModule,
    AdminModule,
    PublishModule,
  ],
  providers: [
    ExceptionTrackerService,
    AllExceptionsFilter,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ActiveUserGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestObservabilityMiddleware, CsrfMiddleware).forRoutes('*');
  }
}
