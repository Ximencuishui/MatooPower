// v1.4 P2-3:SKU 详情图片集服务
// - 上传(校验 MIME + 大小 + sha256 去重 + 写文件)
// - 列表(按 lang + sortOrder)
// - 更新元数据(alt / caption / sortOrder / isCover)
// - 删除(软删除 + 物理清理 storageKey)
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { DbService } from '../../../common/db/db';
import { StorageService } from '../../storage/storage.service';
import { DOC_LANGS, DocLang } from '../../storage/dto/upload.dto';

export interface SkuImageRow {
  id: string;
  skuId: string;
  lang: string;
  storageKey: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  alt: string | null;
  caption: string | null;
  sortOrder: number;
  isCover: number;
  sha256: string;
  uploadedByUserId: string | null;
  uploadedAt: string;
  deprecatedAt: string | null;
}

/** 允许的图片 MIME + 上限 8MB(产品图通常 < 2MB;放宽到 8MB 留出 4K 余量) */
const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const IMAGE_MAX_BYTES = 8 * 1024 * 1024;

@Injectable()
export class SkuImageService {
  private readonly log = new Logger(SkuImageService.name);

  constructor(
    private readonly db: DbService,
    private readonly storage: StorageService,
  ) {}

  /** 列表(按 skuId + lang 可选,默认仅 active,含 cover 优先) */
  list(opts: { skuId: string; lang?: DocLang; includeDeprecated?: boolean }): SkuImageRow[] {
    const where: string[] = ['skuId = ?'];
    const params: any[] = [opts.skuId];
    if (opts.lang) { where.push('lang = ?'); params.push(opts.lang); }
    if (!opts.includeDeprecated) { where.push('deprecatedAt IS NULL'); }
    return this.db.all<SkuImageRow>(
      `SELECT * FROM SkuImage WHERE ${where.join(' AND ')}
       ORDER BY isCover DESC, sortOrder ASC, uploadedAt DESC`,
      ...params,
    );
  }

  async get(id: string): Promise<SkuImageRow> {
    const row = this.db.get<SkuImageRow>('SELECT * FROM SkuImage WHERE id = ?', id);
    if (!row) throw new NotFoundException(`图片 ${id} 不存在`);
    return row;
  }

  /**
   * 上传单张图片
   * - MIME 白名单:image/jpeg | image/png | image/webp | image/gif
   * - 大小上限:8MB
   * - sha256 去重(同 skuId + lang 范围内)
   * - 写 storageKey 到 LocalStorageDriver
   * - isCover 标记:同 skuId + lang 仅允许一张主图(冲突时把旧主图降级)
   */
  async upload(input: {
    skuId: string;
    lang: DocLang;
    fileBuffer: Buffer;
    fileName: string;
    mimeType: string;
    alt?: string;
    caption?: string;
    isCover?: boolean;
  }, actorUserId?: string): Promise<SkuImageRow> {
    if (!DOC_LANGS.includes(input.lang)) {
      throw new BadRequestException(`lang 必须为 ${DOC_LANGS.join('/')}`);
    }
    if (!IMAGE_MIMES.includes(input.mimeType)) {
      throw new BadRequestException(`MIME ${input.mimeType} 不在白名单: ${IMAGE_MIMES.join(', ')}`);
    }
    if (input.fileBuffer.length > IMAGE_MAX_BYTES) {
      throw new BadRequestException(`图片大小 ${input.fileBuffer.length}B 超过 ${IMAGE_MAX_BYTES}B 上限`);
    }
    const sku = this.db.get<{ id: string }>('SELECT id FROM Sku WHERE id = ?', input.skuId);
    if (!sku) throw new NotFoundException(`SKU ${input.skuId} 不存在`);

    const sha256 = createHash('sha256').update(input.fileBuffer).digest('hex');

    // 去重:同 skuId + sha256 已存在则直接复用
    const dup = this.db.get<{ id: string }>(
      'SELECT id FROM SkuImage WHERE skuId = ? AND sha256 = ? AND deprecatedAt IS NULL',
      input.skuId, sha256,
    );
    if (dup) {
      throw new ConflictException(`该图片内容已存在(imageId=${dup.id})，sha256=${sha256.slice(0, 12)}...`);
    }

    // storageKey 命名规则集中在 StorageService.buildImageKey，避免各 service 重复
    const storageKey = this.storage.buildImageKey({
      skuId: input.skuId,
      lang: input.lang,
      sha256,
      mimeType: input.mimeType,
    });
    await this.storage.put(storageKey, input.fileBuffer, { mimeType: input.mimeType });

    // 计算 sortOrder:同 skuId + lang 内最大 sortOrder + 1
    const maxOrder = this.db.get<{ c: number }>(
      'SELECT COALESCE(MAX(sortOrder), 0) AS c FROM SkuImage WHERE skuId = ? AND lang = ?',
      input.skuId, input.lang,
    )?.c ?? 0;

    const id = `img-${Date.now()}-${randomBytes(4).toString('hex')}`;

    // isCover 处理:同 lang 内若有旧主图则降级
    if (input.isCover) {
      this.db.run(
        `UPDATE SkuImage SET isCover = 0 WHERE skuId = ? AND lang = ? AND deprecatedAt IS NULL`,
        input.skuId, input.lang,
      );
    }

    this.db.run(
      `INSERT INTO SkuImage (id, skuId, lang, storageKey, url, mimeType, sizeBytes, alt, caption, sortOrder, isCover, sha256, uploadedByUserId, uploadedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      id,
      input.skuId,
      input.lang,
      storageKey,
      this.storage.getPublicUrl(storageKey),
      input.mimeType,
      input.fileBuffer.length,
      input.alt ?? null,
      input.caption ?? null,
      maxOrder + 1,
      input.isCover ? 1 : 0,
      sha256,
      actorUserId ?? null,
    );

    this.log.log(`uploaded image ${id} ${storageKey} (${input.fileBuffer.length}B)`);
    return this.get(id);
  }

  /** 更新元数据(alt/caption/sortOrder/isCover) */
  async update(id: string, body: { alt?: string; caption?: string; sortOrder?: number; isCover?: boolean }): Promise<SkuImageRow> {
    const img = await this.get(id);
    const sets: string[] = [];
    const params: any[] = [];
    if (body.alt !== undefined) { sets.push('alt = ?'); params.push(body.alt); }
    if (body.caption !== undefined) { sets.push('caption = ?'); params.push(body.caption); }
    if (body.sortOrder !== undefined) { sets.push('sortOrder = ?'); params.push(body.sortOrder); }
    if (body.isCover !== undefined) {
      if (body.isCover) {
        // 把同 lang 内的其他图降级
        this.db.run(
          `UPDATE SkuImage SET isCover = 0 WHERE skuId = ? AND lang = ? AND id != ? AND deprecatedAt IS NULL`,
          img.skuId, img.lang, id,
        );
      }
      sets.push('isCover = ?'); params.push(body.isCover ? 1 : 0);
    }
    if (sets.length === 0) return img;
    params.push(id);
    this.db.run(`UPDATE SkuImage SET ${sets.join(', ')} WHERE id = ?`, ...params);
    return this.get(id);
  }

  /** 软删除(保留记录,前端隐藏) */
  async deprecate(id: string): Promise<SkuImageRow> {
    const img = await this.get(id);
    if (img.deprecatedAt) throw new ConflictException(`图片已下架(${img.deprecatedAt})`);
    this.db.run('UPDATE SkuImage SET deprecatedAt = CURRENT_TIMESTAMP, isCover = 0 WHERE id = ?', id);
    return this.get(id);
  }

  /** 物理删除(同时清理 storage 文件) — 演示期工具 */
  async hardDelete(id: string): Promise<{ ok: true; id: string }> {
    const img = await this.get(id);
    await this.storage.delete(img.storageKey);
    this.db.run('DELETE FROM SkuImage WHERE id = ?', id);
    return { ok: true, id };
  }

  /**
   * 批量上传（v1.4 扩展）：
   * - 并行上传多张，单张失败不影响其他
   * - 返回 results(按输入顺序、与输入等长、按 fileName 一一对应)+ items(成功子集) + failures(失败子集)
   * - results[] 是与输入对齐的主数据源；items/failures 仅供聚合统计使用
   */
  async bulkUpload(
    inputs: Array<{
      skuId: string;
      lang: DocLang;
      fileBuffer: Buffer;
      fileName: string;
      mimeType: string;
      alt?: string;
      caption?: string;
      isCover?: boolean;
    }>,
    actorUserId?: string,
  ): Promise<{
    results: Array<
      | { fileName: string; ok: true; image: SkuImageRow }
      | { fileName: string; ok: false; error: string }
    >;
    items: SkuImageRow[];
    failures: Array<{ fileName: string; error: string }>;
  }> {
    const results = await Promise.all(
      inputs.map(async (input) => {
        try {
          const image = await this.upload(input, actorUserId);
          return { fileName: input.fileName, ok: true as const, image };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          this.log.warn(`bulk upload skipped ${input.fileName}: ${msg}`);
          return { fileName: input.fileName, ok: false as const, error: msg };
        }
      }),
    );
    return {
      results,
      items: results.filter((r): r is { fileName: string; ok: true; image: SkuImageRow } => r.ok).map((r) => r.image),
      failures: results.filter((r): r is { fileName: string; ok: false; error: string } => !r.ok).map((r) => ({ fileName: r.fileName, error: r.error })),
    };
  }
}

