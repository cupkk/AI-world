import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { RedisService } from '../src/common/redis/redis.service';

describe('App E2E', () => {
  let app: INestApplication;

  const prismaMock = {
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  } as any;

  const redisMock = {
    client: {
      ping: jest.fn().mockResolvedValue('PONG'),
      lpush: jest.fn().mockResolvedValue(1),
      subscribe: jest.fn(),
      on: jest.fn(),
      publish: jest.fn(),
    },
    checkRateLimit: jest.fn().mockResolvedValue(true),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  } as any;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'e2e-test-secret';
    process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(RedisService)
      .useValue(redisMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /ready should return ready', async () => {
    const res = await request(app.getHttpServer()).get('/ready').expect(200);
    expect(res.body.status).toBe('ready');
  });

  it('GET /me should require authentication', async () => {
    await request(app.getHttpServer()).get('/me').expect(401);
  });

  it('POST /api/publish should require authentication', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/publish')
      .send({ title: 'Test', description: 'Desc', type: 'PAPER' });
    expect([401, 403]).toContain(res.status);
  });

  it('GET /api/publish/mine should require authentication', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/publish/mine');
    // Unauthenticated: may return 401 or 403 depending on guard layer
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('POST /api/hub/:id/like should require authentication', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/hub/some-id/like');
    expect([401, 403]).toContain(res.status);
  });
});
