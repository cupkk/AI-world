import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KbService } from './kb.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { StorageService } from '../../common/storage/storage.service';

// ── Mocks ──────────────────────────────────────────────────
const mockPrisma: any = {
  kbFile: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
};

const mockRedis = {
  client: { lpush: jest.fn().mockResolvedValue(1) },
};

const mockConfig = {
  get: jest.fn((key: string, fallback?: any) => fallback),
};

const mockStorage = {
  upload: jest.fn().mockResolvedValue({
    key: 'kb/u1/file.pdf',
    url: '/uploads/kb/u1/file.pdf',
    driver: 'local',
    localPath: 'uploads/kb/u1/file.pdf',
  }),
  delete: jest.fn().mockResolvedValue(undefined),
};

describe('KbService', () => {
  let service: KbService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KbService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: ConfigService, useValue: mockConfig },
        { provide: StorageService, useValue: mockStorage },
      ],
    }).compile();

    service = module.get(KbService);
  });

  // ── uploadFile ─────────────────────────────────────────────
  describe('uploadFile', () => {
    it('should upload to storage, create record, and queue processing', async () => {
      const fakeRecord = {
        id: 'kb1',
        ownerUserId: 'u1',
        fileName: 'paper.pdf',
        mimeType: 'application/pdf',
        sizeBytes: BigInt(1024),
        localPath: 'uploads/kb/u1/file.pdf',
        status: 'uploaded',
      };
      mockPrisma.kbFile.create.mockResolvedValue(fakeRecord);

      const mockFile = {
        originalname: 'paper.pdf',
        buffer: Buffer.concat([Buffer.from('%PDF-1.7'), Buffer.from('pdf-content')]),
        mimetype: 'application/pdf',
        size: 1024,
      } as Express.Multer.File;

      const result = await service.uploadFile('u1', mockFile);

      expect(result.id).toBe('kb1');
      expect(mockStorage.upload).toHaveBeenCalledWith(
        'u1',
        'paper.pdf',
        expect.any(Buffer),
        'application/pdf',
        'kb',
        expect.objectContaining({
          localDir: 'uploads-private',
          publicUrlBase: null,
        }),
      );
      expect(mockPrisma.kbFile.create).toHaveBeenCalled();
      expect(mockRedis.client.lpush).toHaveBeenCalledWith(
        'kb:process-queue',
        expect.stringContaining('"storageKey":"kb/u1/file.pdf"'),
      );
    });

    it('should throw BadRequestException when no file', async () => {
      await expect(service.uploadFile('u1', null as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject files whose extension does not match the detected signature', async () => {
      const mockFile = {
        originalname: 'spoofed.pdf',
        buffer: Buffer.concat([
          Buffer.from([0x50, 0x4b, 0x03, 0x04]),
          Buffer.from('word/document.xml'),
        ]),
        mimetype: 'application/pdf',
        size: 128,
      } as Express.Multer.File;

      await expect(service.uploadFile('u1', mockFile)).rejects.toThrow(
        'File contents do not match the provided extension .pdf. Expected .docx.',
      );
      expect(mockStorage.upload).not.toHaveBeenCalled();
    });
  });

  // ── listFiles ──────────────────────────────────────────────
  describe('listFiles', () => {
    it('should return files with sizeBytes as number', async () => {
      mockPrisma.kbFile.findMany.mockResolvedValue([
        {
          id: 'kb1',
          fileName: 'doc.pdf',
          mimeType: 'application/pdf',
          sizeBytes: BigInt(2048),
          status: 'READY',
          errorMessage: null,
          createdAt: new Date(),
        },
      ]);

      const result = await service.listFiles('u1');
      expect(result).toHaveLength(1);
      expect(result[0].sizeBytes).toBe(2048);
      expect(typeof result[0].sizeBytes).toBe('number');
    });

    it('should return empty list when no files', async () => {
      mockPrisma.kbFile.findMany.mockResolvedValue([]);

      const result = await service.listFiles('u1');
      expect(result).toEqual([]);
    });
  });

  // ── deleteFile ─────────────────────────────────────────────
  describe('deleteFile', () => {
    it('should delete storage file and DB record', async () => {
      mockPrisma.kbFile.findUnique.mockResolvedValue({
        id: 'kb1',
        ownerUserId: 'u1',
        localPath: 'uploads/kb/u1/file.pdf',
      });
      mockPrisma.kbFile.delete.mockResolvedValue({});

      const result = await service.deleteFile('kb1', 'u1');
      expect(result.success).toBe(true);
      expect(mockStorage.delete).toHaveBeenCalledWith('uploads/kb/u1/file.pdf');
      expect(mockPrisma.kbFile.delete).toHaveBeenCalledWith({ where: { id: 'kb1' } });
    });

    it('should throw NotFoundException for missing file', async () => {
      mockPrisma.kbFile.findUnique.mockResolvedValue(null);

      await expect(service.deleteFile('missing', 'u1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when userId mismatch', async () => {
      mockPrisma.kbFile.findUnique.mockResolvedValue({
        id: 'kb1',
        ownerUserId: 'other-user',
        localPath: 'kb/other/file.pdf',
      });

      await expect(service.deleteFile('kb1', 'u1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
