// v1.3 P0:存储驱动抽象（演示期 LocalDriver,生产期可换 S3Driver/R2Driver）
// 接口语义保持最简：put/get/getStream/delete/getSignedUrl/exists

import { Readable } from 'node:stream';

export interface PutOptions {
  mimeType?: string;
  metadata?: Record<string, string>;
}

export interface StorageDriver {
  /** 写入字节流或 buffer,返回 storageKey（驱动内部生成的相对路径） */
  put(key: string, data: Buffer | Readable, opts?: PutOptions): Promise<void>;
  /** 读取整个文件到 buffer（小文件用,大文件请用 getStream） */
  get(key: string): Promise<Buffer>;
  /** 读取为可读流（用于 HTTP Response 流式输出,节省内存） */
  getStream(key: string): Promise<Readable>;
  /** 删除文件（不存在不报错） */
  delete(key: string): Promise<void>;
  /** 检查文件是否存在 */
  exists(key: string): Promise<boolean>;
  /** 生成对外可访问的 URL（local driver 用相对路径,s3/r2 driver 用预签名 URL） */
  getPublicUrl(key: string): string;
}

export const STORAGE_DRIVER = Symbol.for('STORAGE_DRIVER');