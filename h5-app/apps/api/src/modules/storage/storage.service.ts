import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import { STORAGE_DRIVER, StorageDriver } from './drivers/storage.driver';
import { DocType, DocLang, extFor } from './dto/upload.dto';

export interface BuildKeyInput {
  skuId: string;
  type: DocType;
  lang: DocLang;
  version: string;
  mimeType: string;
}

/**
 * v1.3 P0:文件存储服务（驱动无关的薄包装）
 * - 构造 storageKey(skuId/type/lang/version/uuid.ext,避免冲突)
 * - put/get/delete 转给底层 driver
 * - getPublicUrl 用于在响应里返回给前端(扫码页消费)
 */
@Injectable()
export class StorageService {
  constructor(@Inject(STORAGE_DRIVER) private readonly driver: StorageDriver) {}

  buildKey(input: BuildKeyInput): string {
    const uuid = randomBytes(6).toString('hex');
    const ext = extFor(input.type, input.mimeType);
    // sanitize skuId 防止路径穿越(仅保留字母数字-_)
    const safeSku = input.skuId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${safeSku}/${input.type}/${input.lang}/${input.version}-${uuid}.${ext}`;
  }

  put(key: string, data: Buffer | Readable, opts?: { mimeType?: string }): Promise<void> {
    return this.driver.put(key, data, opts);
  }

  get(key: string): Promise<Buffer> {
    return this.driver.get(key);
  }

  getStream(key: string): Promise<Readable> {
    return this.driver.getStream(key);
  }

  delete(key: string): Promise<void> {
    return this.driver.delete(key);
  }

  exists(key: string): Promise<boolean> {
    return this.driver.exists(key);
  }

  getPublicUrl(key: string): string {
    return this.driver.getPublicUrl(key);
  }
}