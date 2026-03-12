import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LlmService } from './llm.service';

describe('LlmService', () => {
  it('does not require an API key outside strict production mode', async () => {
    const module = await Test.createTestingModule({
      providers: [
        LlmService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: unknown) => {
              const values: Record<string, unknown> = {
                NODE_ENV: 'development',
                REQUIRE_LLM: 'false',
                LLM_PROVIDER: 'openai',
              };
              return values[key] ?? fallback;
            }),
          },
        },
      ],
    }).compile();

    expect(module.get(LlmService)).toBeInstanceOf(LlmService);
  });

  it('throws when LLM is required in production but no key is configured', async () => {
    await expect(
      Test.createTestingModule({
        providers: [
          LlmService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, fallback?: unknown) => {
                const values: Record<string, unknown> = {
                  NODE_ENV: 'production',
                  REQUIRE_LLM: 'true',
                  LLM_PROVIDER: 'openai',
                  LLM_API_KEY: '',
                };
                return values[key] ?? fallback;
              }),
            },
          },
        ],
      }).compile(),
    ).rejects.toThrow('LLM is required in this environment');
  });
});
