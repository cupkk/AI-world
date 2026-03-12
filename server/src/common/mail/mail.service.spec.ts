import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

describe('MailService', () => {
  let service: MailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: any) => {
              // No SMTP configured — dev fallback mode
              return fallback;
            }),
          },
        },
      ],
    }).compile();

    service = module.get(MailService);
  });

  describe('send', () => {
    it('should not throw when SMTP is not configured (dev mode)', async () => {
      // In dev mode without SMTP, send() should just log and not throw
      await expect(
        service.send({
          to: 'user@example.com',
          subject: 'Test',
          text: 'Hello',
        }),
      ).resolves.not.toThrow();
    });

    it('should accept html content', async () => {
      await expect(
        service.send({
          to: 'user@example.com',
          subject: 'Test HTML',
          html: '<p>Hello</p>',
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('strict production mode', () => {
    it('should throw when SMTP is required but missing', async () => {
      await expect(
        Test.createTestingModule({
          providers: [
            MailService,
            {
              provide: ConfigService,
              useValue: {
                get: jest.fn((key: string, fallback?: any) => {
                  const map: Record<string, any> = {
                    NODE_ENV: 'production',
                    REQUIRE_SMTP: 'true',
                  };
                  return map[key] ?? fallback;
                }),
              },
            },
          ],
        }).compile(),
      ).rejects.toThrow('SMTP is required in this environment');
    });
  });
});
