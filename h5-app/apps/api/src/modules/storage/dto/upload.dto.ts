import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { CONTENT_LANGS, type DocLang } from '@matoo/shared';

/** 文档类型枚举(对应需求 §3.1 + §3.7) */
export const DOC_TYPES = ['manual', 'video', 'specsheet', 'faq'] as const;
export type DocType = (typeof DOC_TYPES)[number];

/** 支持的多语言(对应需求 §5 + §3.1) — 统一从 @matoo/shared 导入，避免与 SKU_IMAGE_LANGS 等重复定义 */
export const DOC_LANGS = CONTENT_LANGS;
export type { DocLang };

/** 版本号格式:v\d+(\.\d+)? 例 v1 / v1.0 / v2.3 */
const VERSION_REGEX = /^v\d+(\.\d+)?$/;

/** 单文档上传元数据 DTO(配合 multer 文件字段) */
export class UploadDocumentMetaDto {
  @IsEnum(DOC_TYPES, { message: 'type 必须为 manual/video/specsheet/faq 之一' })
  type!: DocType;

  @IsEnum(DOC_LANGS, { message: 'lang 必须为 zh/en/bn/hi/ur 之一' })
  lang!: DocLang;

  @IsString()
  @Matches(VERSION_REGEX, { message: '版本号格式: v1 / v1.0 / v2.3' })
  version!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  batchId?: string;
}

/** 文档类型 → MIME 白名单 + 最大字节数 */
export const TYPE_RULES: Record<DocType, { mimes: string[]; maxBytes: number }> = {
  manual: { mimes: ['application/pdf'], maxBytes: 30 * 1024 * 1024 },
  video: { mimes: ['video/mp4', 'video/webm', 'video/quicktime'], maxBytes: 200 * 1024 * 1024 },
  specsheet: { mimes: ['application/pdf'], maxBytes: 30 * 1024 * 1024 },
  faq: { mimes: ['application/pdf', 'text/plain'], maxBytes: 10 * 1024 * 1024 },
};

/** 扩展名按 type 推断 */
export function extFor(type: DocType, mime: string): string {
  if (type === 'manual' || type === 'specsheet' || type === 'faq') {
    if (mime === 'application/pdf') return 'pdf';
    if (mime === 'text/plain') return 'txt';
  }
  if (type === 'video') {
    if (mime === 'video/mp4') return 'mp4';
    if (mime === 'video/webm') return 'webm';
    if (mime === 'video/quicktime') return 'mov';
  }
  return 'bin';
}