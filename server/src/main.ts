import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import * as session from 'express-session';
import { RedisStore } from 'connect-redis';
import { createClient } from 'redis';
import * as path from 'path';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

class SessionIoAdapter extends IoAdapter {
  constructor(
    app: NestExpressApplication,
    private readonly sessionMiddleware: any,
  ) {
    super(app);
  }

  createIOServer(port: number, options?: any) {
    const server = super.createIOServer(port, options);
    server.engine.use(this.sessionMiddleware);
    server.use((socket: any, next: (err?: Error) => void) => {
      if (socket.request?.session) {
        next();
        return;
      }
      this.sessionMiddleware(socket.request, socket.request?.res ?? ({} as any), next);
    });
    return server;
  }
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  // Trust reverse proxy (nginx) — required for secure cookies behind proxy
  if (configService.get<string>('NODE_ENV') === 'production') {
    app.set('trust proxy', 1);
  }

  // Security — helmet with CSP
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:', '*.aliyuncs.com'],
        connectSrc: ["'self'", 'wss:', 'ws:'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
  }));
  app.use(cookieParser());

  // CORS
  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN', 'http://localhost:5173'),
    credentials: true,
  });

  // Session with Redis store — use node-redis client for connect-redis v9 compatibility
  const sessionSecret = configService.get<string>('SESSION_SECRET', 'dev-secret-change-in-production');
  if (configService.get<string>('NODE_ENV') === 'production' && sessionSecret === 'dev-secret-change-in-production') {
    throw new Error('SESSION_SECRET must be set in production environment');
  }

  const redisUrl = configService.get<string>('REDIS_URL', 'redis://localhost:6379');
  const sessionRedisClient = createClient({ url: redisUrl });
  sessionRedisClient.on('error', (err) => console.error('Session Redis error:', err));
  await sessionRedisClient.connect();

  const store = new RedisStore({
    client: sessionRedisClient,
    prefix: 'sess:',
  });

  const sessionMiddleware = session({
    store,
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  });

  app.use(sessionMiddleware);
  app.useWebSocketAdapter(new SessionIoAdapter(app, sessionMiddleware));

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global interceptors & filters
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(app.get(AllExceptionsFilter));

  // Serve uploaded files (avatars, etc.)
  app.useStaticAssets(path.join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  // API prefix — aligned to frontend api.ts paths (no /v1)
  app.setGlobalPrefix('api', {
    exclude: ['health', 'ready', 'metrics'],
  });

  // Swagger docs (non-production only)
  if (configService.get<string>('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('AI-World API')
      .setDescription('AI-World 后端 API 文档')
      .setVersion('1.0')
      .addCookieAuth('connect.sid')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  // Graceful shutdown
  app.enableShutdownHooks();

  const port = configService.get<number>('API_PORT', 3000);
  await app.listen(port);
  console.log(`🚀 AI-World API running on http://localhost:${port}`);
  console.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
