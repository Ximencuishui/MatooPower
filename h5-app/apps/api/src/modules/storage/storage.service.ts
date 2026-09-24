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

export interface BuildImageKeyInput {
  skuId: string;
  lang: DocLang;
  sha256: string;
  mimeType: string;
}

export function extForImage(mimeType: string): string {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  // v1.5 #C5 修复:iOS 拍照的 HEIC/HEIF 显式映射到正确后缀,不再落入 bin
  // iOS 17+ 也可能上传 AVIF,顺便一起处理
  if (mimeType === 'image/heic' || mimeType === 'image/heif') return 'heic';
  if (mimeType === 'image/avif') return 'avif';
  return 'bin';
}

/** sanitize skuId 防止路径穿越(仅保留字母数字-_)，供 buildKey / buildImageKey 共用 */
export function safeSkuSegment(skuId: string): string {
  return skuId.replace(/[^a-zA-Z0-9_-]/g, '_');
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
    return `${safeSkuSegment(input.skuId)}/${input.type}/${input.lang}/${input.version}-${uuid}.${ext}`;
  }

  /**
   * SKU 详情图片 storageKey 构造（v1.4）
   * - 命名规则：<safeSku>/images/<lang>/<sha8>-<rand4>.<ext>
   * - sha256 段用于内容寻址（同名文件不同 lang 也不冲突）
   * - randomBytes(2) 用于同 sha256 重传时的去重容错（保留旧 record 不会被覆盖）
   */
  buildImageKey(input: BuildImageKeyInput): string {
    const ext = extForImage(input.mimeType);
    return `${safeSkuSegment(input.skuId)}/images/${input.lang}/${input.sha256.slice(0, 8)}-${randomBytes(2).toString('hex')}.${ext}`;
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