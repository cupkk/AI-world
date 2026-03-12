import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs module
jest.mock('fs/promises');

const mockedFs = fs as jest.Mocked<typeof fs>;

describe('StorageService', () => {
  describe('local mode (no OSS)', () => {
    let service: StorageService;

    beforeEach(async () => {
      jest.clearAllMocks();
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.writeFile.mockResolvedValue(undefined);
      mockedFs.unlink.mockResolvedValue(undefined);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          StorageService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, fallback?: any) => {
                // Return empty for OSS — forces local mode
                const map: Record<string, any> = {
                  KB_UPLOAD_DIR: 'test-uploads/kb',
                };
                return map[key] ?? fallback ?? '';
              }),
            },
          },
        ],
      }).compile();

      service = module.get(StorageService);
    });

    it('should upload file to local disk', async () => {
      const buffer = Buffer.from('test content');
      const result = await service.upload('u1', 'doc.pdf', buffer, 'application/pdf');

      expect(result.key).toMatch(/^kb\/u1\/.*\.pdf$/);
      expect(result.url).toMatch(/^\/uploads\/kb\/u1\/.*\.pdf$/);
      expect(mockedFs.mkdir).toHaveBeenCalled();
      expect(mockedFs.writeFile).toHaveBeenCalled();
    });

    it('should support private local uploads without a public URL', async () => {
      const buffer = Buffer.from('private content');
      const result = await service.upload('u1', 'secret.pdf', buffer, 'application/pdf', 'kb', {
        localDir: 'private-kb',
        publicUrlBase: null,
      });

      expect(result.url).toBe('');
      expect(result.localPath).toContain(path.join('private-kb', 'kb', 'u1'));
      expect(mockedFs.writeFile).toHaveBeenCalled();
    });

    it('should delete local file', async () => {
      await service.delete('kb/u1/test.pdf');

      expect(mockedFs.unlink).toHaveBeenCalled();
    });

    it('should not throw on delete of non-existent file', async () => {
      const err = new Error('ENOENT') as NodeJS.ErrnoException;
      err.code = 'ENOENT';
      mockedFs.unlink.mockRejectedValue(err);

      await expect(service.delete('kb/u1/missing.pdf')).resolves.not.toThrow();
    });
  });

  describe('strict production mode', () => {
    it('should throw when OSS is required but not configured', async () => {
      await expect(
        Test.createTestingModule({
          providers: [
            StorageService,
            {
              provide: ConfigService,
              useValue: {
                get: jest.fn((key: string, fallback?: any) => {
                  const map: Record<string, any> = {
                    NODE_ENV: 'production',
                    REQUIRE_OSS: 'true',
                  };
                  return map[key] ?? fallback ?? '';
                }),
              },
            },
          ],
        }).compile(),
      ).rejects.toThrow('OSS is required in this environment');
    });
  });
});
