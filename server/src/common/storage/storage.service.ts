import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { isProductionEnv, parseBooleanFlag } from '../config/runtime.util';

export interface StorageFile {
  key: string;
  url: string;
  driver: 'oss' | 'local';
  localPath?: string;
}

export interface StorageUploadOptions {
  localDir?: string;
  publicUrlBase?: string | null;
}

/**
 * Abstraction over file storage.
 *
 * - When OSS_BUCKET is configured → delegates to Alibaba Cloud OSS via
 *   pre-signed PUT/GET (uses the OSS HTTP API directly; no extra SDK needed).
 * - Otherwise → falls back to local disk storage.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly useOss: boolean;
  private readonly bucket: string;
  private readonly region: string;
  private readonly endpoint: string;
  private readonly accessKeyId: string;
  private readonly accessKeySecret: string;
  private readonly localDir: string;
  private readonly requireOss: boolean;
  private readonly publicBaseUrl: string;

  constructor(private readonly config: ConfigService) {
    const nodeEnv = config.get<string>('NODE_ENV', 'development');
    this.bucket = config.get<string>('OSS_BUCKET', '');
    this.region = config.get<string>('OSS_REGION', 'oss-cn-shanghai');
    this.endpoint = config.get<string>('OSS_ENDPOINT', 'oss-cn-shanghai.aliyuncs.com');
    this.accessKeyId = config.get<string>('OSS_ACCESS_KEY_ID', '');
    this.accessKeySecret = config.get<string>('OSS_ACCESS_KEY_SECRET', '');
    this.useOss = !!(this.bucket && this.accessKeyId && this.accessKeySecret);
    this.localDir = config.get<string>('UPLOAD_DIR', 'uploads');
    this.requireOss = parseBooleanFlag(
      config.get<string>('REQUIRE_OSS'),
      isProductionEnv(nodeEnv),
    );
    this.publicBaseUrl = config
      .get<string>('OSS_PUBLIC_BASE_URL', '')
      .trim()
      .replace(/\/$/, '');

    if (!this.useOss && this.requireOss) {
      throw new Error(
        'OSS is required in this environment. Configure OSS_BUCKET, OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, and optionally OSS_PUBLIC_BASE_URL.',
      );
    }
  }

  async onModuleInit() {
    if (this.useOss) {
      this.logger.log(`OSS storage enabled: ${this.bucket} (${this.region})`);
    } else {
      this.logger.warn('OSS not configured — using local disk storage (NOT recommended for production)');
      await fs.mkdir(this.localDir, { recursive: true });
    }
  }

  /**
   * Upload a file buffer and return the storage key + retrieval URL.
   * @param prefix Optional key prefix (defaults to 'kb')
   */
  async upload(
    userId: string,
    fileName: string,
    buffer: Buffer,
    mimeType: string,
    prefix = 'kb',
    options?: StorageUploadOptions,
  ): Promise<StorageFile> {
    const ext = path.extname(fileName);
    const key = `${prefix}/${userId}/${crypto.randomUUID()}${ext}`;

    if (this.useOss) {
      return this.uploadToOss(key, buffer, mimeType);
    }
    return this.uploadToLocal(key, buffer, options);
  }

  /**
   * Delete a file by its storage key.
   */
  async delete(key: string): Promise<void> {
    if (this.useOss) {
      return this.deleteFromOss(key);
    }
    return this.deleteFromLocal(key);
  }

  // ── OSS helpers ──────────────────────────────────────────

  private async uploadToOss(key: string, buffer: Buffer, contentType: string): Promise<StorageFile> {
    const date = new Date().toUTCString();
    const signature = this.signOss('PUT', key, contentType, date);

    const url = `https://${this.bucket}.${this.endpoint}/${key}`;
    const resp = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        Date: date,
        Authorization: `OSS ${this.accessKeyId}:${signature}`,
      },
      body: new Uint8Array(buffer),
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`OSS upload failed (${resp.status}): ${body}`);
    }

    this.logger.log(`OSS upload: ${key}`);
    return { key, url: this.getOssPublicUrl(key), driver: 'oss' };
  }

  private async deleteFromOss(key: string): Promise<void> {
    const date = new Date().toUTCString();
    const signature = this.signOss('DELETE', key, '', date);

    const url = `https://${this.bucket}.${this.endpoint}/${key}`;
    const resp = await fetch(url, {
      method: 'DELETE',
      headers: {
        Date: date,
        Authorization: `OSS ${this.accessKeyId}:${signature}`,
      },
    });

    if (!resp.ok && resp.status !== 404) {
      const body = await resp.text();
      throw new Error(`OSS delete failed (${resp.status}): ${body}`);
    }

    this.logger.log(`OSS delete: ${key}`);
  }

  private signOss(verb: string, key: string, contentType: string, date: string): string {
    const stringToSign = `${verb}\n\n${contentType}\n${date}\n/${this.bucket}/${key}`;
    return crypto
      .createHmac('sha1', this.accessKeySecret)
      .update(stringToSign)
      .digest('base64');
  }

  // ── Local helpers ────────────────────────────────────────

  private async uploadToLocal(
    key: string,
    buffer: Buffer,
    options?: StorageUploadOptions,
  ): Promise<StorageFile> {
    const localDir = options?.localDir ?? this.localDir;
    const publicUrlBase =
      options?.publicUrlBase === undefined ? '/uploads' : options.publicUrlBase;
    const filePath = path.join(localDir, key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
    this.logger.log(`Local upload: ${filePath}`);
    return {
      key,
      url: publicUrlBase ? `${publicUrlBase.replace(/\/$/, '')}/${key}` : '',
      driver: 'local',
      localPath: filePath,
    };
  }

  private async deleteFromLocal(keyOrPath: string): Promise<void> {
    const filePath = path.isAbsolute(keyOrPath)
      ? keyOrPath
      : keyOrPath.startsWith(this.localDir)
        ? keyOrPath
        : path.join(this.localDir, keyOrPath);
    try {
      await fs.unlink(filePath);
      this.logger.log(`Local delete: ${filePath}`);
    } catch (err: any) {
      if (err.code !== 'ENOENT') throw err;
    }
  }

  private getOssPublicUrl(key: string): string {
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl}/${key}`;
    }
    return `https://${this.bucket}.${this.endpoint}/${key}`;
  }
}
