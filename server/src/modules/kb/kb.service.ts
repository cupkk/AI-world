import { exec as execCallback } from 'child_process';
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { StorageService } from '../../common/storage/storage.service';
import { parseBooleanFlag } from '../../common/config/runtime.util';
import { normalizeKbUpload } from './kb-upload-security';

const execAsync = promisify(execCallback);

@Injectable()
export class KbService {
  private readonly logger = new Logger(KbService.name);
  private readonly queueName: string;
  private readonly localKbUploadDir: string;
  private readonly avScanCommand: string;
  private readonly avScanFailOpen: boolean;
  private readonly avScanTimeoutMs: number;

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private config: ConfigService,
    private storage: StorageService,
  ) {
    this.queueName = this.config.get<string>('KB_QUEUE_NAME', 'kb:process-queue');
    this.localKbUploadDir = this.config.get<string>('KB_UPLOAD_DIR', 'uploads-private');
    this.avScanCommand = this.config.get<string>('KB_AV_SCAN_COMMAND', '').trim();
    this.avScanFailOpen = parseBooleanFlag(
      this.config.get<string>('KB_AV_SCAN_FAIL_OPEN'),
      false,
    );
    this.avScanTimeoutMs = Number(this.config.get<string>('KB_AV_SCAN_TIMEOUT_MS', '15000'));
  }

  /**
   * Direct file upload — save to local disk and create DB record
   */
  async uploadFile(userId: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    const normalizedFile = normalizeKbUpload(file);

    await this.runAntivirusScan(file.buffer, normalizedFile.fileName);

    // Upload via StorageService (OSS or local fallback)
    const stored = await this.storage.upload(
      userId,
      normalizedFile.fileName,
      file.buffer,
      normalizedFile.mimeType,
      'kb',
      {
        localDir: this.localKbUploadDir,
        publicUrlBase: null,
      },
    );

    // Create DB record
    const record = await this.prisma.kbFile.create({
      data: {
        ownerUserId: userId,
        fileName: normalizedFile.fileName,
        mimeType: normalizedFile.mimeType,
        sizeBytes: BigInt(file.size),
        ossKey: stored.driver === 'oss' ? stored.key : null,
        localPath: stored.driver === 'local' ? stored.localPath : null,
        fileUrl: stored.url,
        status: 'uploaded',
        errorMessage: null,
      },
    });

    // Queue async processing task via Redis so the worker consumes the same source of truth.
    await this.redis.client.lpush(
      this.queueName,
      JSON.stringify({
        fileId: record.id,
        storageKey: stored.key,
        localPath: stored.driver === 'local' ? stored.localPath : undefined,
        userId,
        fileName: normalizedFile.fileName,
        mimeType: normalizedFile.mimeType,
      }),
    );

    this.logger.log(`KB file uploaded: ${record.id} (${normalizedFile.fileName})`);

    return record;
  }

  /**
   * List my files
   */
  async listFiles(userId: string) {
    const files = await this.prisma.kbFile.findMany({
      where: { ownerUserId: userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        status: true,
        errorMessage: true,
        createdAt: true,
      },
    });

    return files.map((f) => ({
      ...f,
      sizeBytes: f.sizeBytes ? Number(f.sizeBytes) : null,
    }));
  }

  /**
   * Delete file and associated chunks
   */
  async deleteFile(fileId: string, userId: string) {
    const file = await this.prisma.kbFile.findUnique({ where: { id: fileId } });
    if (!file) throw new NotFoundException('File not found');
    if (file.ownerUserId !== userId) throw new NotFoundException('File not found');

    // Delete storage file
    const storageLocator = file.localPath || file.ossKey;
    if (storageLocator) {
      await this.storage.delete(storageLocator).catch((err) =>
        this.logger.warn(`Failed to delete storage file ${storageLocator}: ${err.message}`),
      );
    }

    // Cascade delete chunks (configured in schema)
    await this.prisma.kbFile.delete({ where: { id: fileId } });
    this.logger.log(`KB file deleted: ${fileId}`);

    return { success: true };
  }

  private async runAntivirusScan(buffer: Buffer, fileName: string): Promise<void> {
    if (!this.avScanCommand) {
      return;
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aiworld-kb-scan-'));
    const tempFilePath = path.join(tempDir, fileName);

    try {
      await fs.writeFile(tempFilePath, buffer);
      const quotedFile = process.platform === 'win32'
        ? `"${tempFilePath.replace(/"/g, '""')}"`
        : `'${tempFilePath.replace(/'/g, `'\\''`)}'`;
      const command = this.avScanCommand.includes('{file}')
        ? this.avScanCommand.replaceAll('{file}', quotedFile)
        : `${this.avScanCommand} ${quotedFile}`;

      await execAsync(command, {
        timeout: this.avScanTimeoutMs,
        windowsHide: true,
      });
    } catch (error: any) {
      const message = error?.stderr || error?.message || 'Unknown antivirus scan failure';
      if (this.avScanFailOpen) {
        this.logger.warn(`KB AV scan failed open for ${fileName}: ${message}`);
        return;
      }

      this.logger.warn(`KB upload rejected by AV scan for ${fileName}: ${message}`);
      throw new BadRequestException('File rejected by security scan');
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
