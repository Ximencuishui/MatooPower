// v1.3 P0:本地磁盘存储驱动（演示期）
// 文件布局:<root>/<key>
// key 形如 "{skuId}/{type}/{lang}/{version}-{uuid}.{ext}"

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Readable } from 'node:stream';
import { PutOptions, StorageDriver } from './storage.driver';

@Injectable()
export class LocalStorageDriver implements StorageDriver {
  private readonly log = new Logger(LocalStorageDriver.name);
  private readonly root: string;
  /** 对外暴露的 URL 前缀（与 main.ts 静态托管一致） */
  private readonly publicPrefix: string;

  constructor(cfg: ConfigService) {
    // 演示期默认 <cwd>/storage；生产期可通过 STORAGE_LOCAL_ROOT 覆盖
    this.root = path.resolve(
      cfg.get<string>('STORAGE_LOCAL_ROOT') ?? path.join(process.cwd(), 'storage'),
    );
    this.publicPrefix = cfg.get<string>('STORAGE_PUBLIC_PREFIX') ?? '/storage';
    fs.mkdirSync(this.root, { recursive: true });
    this.log.log(`LocalStorageDriver ready, root=${this.root}, prefix=${this.publicPrefix}`);
  }

  /** 安全解析：拒绝 ../ 路径穿越 */
  private resolveSafe(key: string): string {
    const sanitized = key.replace(/\\/g, '/').replace(/^\/+/, '');
    const full = path.resolve(this.root, sanitized);
    if (!full.startsWith(this.root + path.sep) && full !== this.root) {
      throw new Error(`storage key unsafe: ${key}`);
    }
    return full;
  }

  async put(key: string, data: Buffer | Readable, _opts?: PutOptions): Promise<void> {
    const full = this.resolveSafe(key);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    if (Buffer.isBuffer(data)) {
      await fs.promises.writeFile(full, data);
    } else {
      const chunks: Buffer[] = [];
      for await (const chunk of data) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      await fs.promises.writeFile(full, Buffer.concat(chunks));
    }
  }

  async get(key: string): Promise<Buffer> {
    const full = this.resolveSafe(key);
    return fs.promises.readFile(full);
  }

  async getStream(key: string): Promise<Readable> {
    const full = this.resolveSafe(key);
    return fs.createReadStream(full);
  }

  async delete(key: string): Promise<void> {
    const full = this.resolveSafe(key);
    await fs.promises.rm(full, { force: true });
  }

  async exists(key: string): Promise<boolean> {
    const full = this.resolveSafe(key);
    try {
      await fs.promises.access(full, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  getPublicUrl(key: string): string {
    const sanitized = key.replace(/\\/g, '/').replace(/^\/+/, '');
    return `${this.publicPrefix}/${sanitized}`;
  }
}