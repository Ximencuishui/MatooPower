import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { DbService } from '../../common/db/db';
import { StorageService } from '../storage/storage.service';
import { DocLang, DocType, TYPE_RULES } from '../storage/dto/upload.dto';

export interface SkuDocumentRow {
  id: string;
  skuId: string;
  batchId: string | null;
  type: string;
  lang: string;
  version: string;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  sha256: string;
  uploadedByUserId: string | null;
  uploadedAt: string;
  deprecatedAt: string | null;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class SkuDocumentService {
  private readonly log = new Logger(SkuDocumentService.name);

  constructor(
    private readonly db: DbService,
    private readonly storage: StorageService,
  ) {}

  async list(opts: {
    skuId?: string;
    type?: DocType;
    lang?: DocLang;
    includeDeprecated?: boolean;
    q?: string;
    page?: number;
    pageSize?: number;
    /** #P2-4: 'type' = 按文档类型预排; 默认 = 按上传时间 */
    sortBy?: 'type' | 'time';
  } = {}): Promise<PageResult<SkuDocumentRow>> {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
    const offset = (page - 1) * pageSize;
    // #P2-4:sortBy 默认 undefined=按上传时间排; 'type' = 按文档类型预排(manual → video → specsheet → faq)
    const sortBy = opts.sortBy ?? 'time';

    const where: string[] = [];
    const params: any[] = [];
    if (opts.skuId) { where.push('skuId = ?'); params.push(opts.skuId); }
    if (opts.type) { where.push('type = ?'); params.push(opts.type); }
    if (opts.lang) { where.push('lang = ?'); params.push(opts.lang); }
    if (!opts.includeDeprecated) { where.push('deprecatedAt IS NULL'); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // #P2-4:支持 sortBy=type 让文档 Tab 按类型预排(manual → video → specsheet → faq)
    const orderSql = sortBy === 'type'
      ? `ORDER BY CASE type
            WHEN 'manual' THEN 0
            WHEN 'video' THEN 1
            WHEN 'specsheet' THEN 2
            WHEN 'faq' THEN 3
            ELSE 4
          END, uploadedAt DESC`
      : `ORDER BY uploadedAt DESC`;

    const total = this.db.get<{ c: number }>(`SELECT COUNT(*) AS c FROM SkuDocument ${whereSql}`, ...params)?.c ?? 0;
    const items = this.db.all<SkuDocumentRow>(
      `SELECT * FROM SkuDocument ${whereSql} ${orderSql} LIMIT ? OFFSET ?`,
      ...params, pageSize, offset);

    return { items, total, page, pageSize };
  }

  async get(id: string): Promise<SkuDocumentRow> {
    const d = this.db.get<SkuDocumentRow>('SELECT * FROM SkuDocument WHERE id = ?', id);
    if (!d) throw new NotFoundException(`文档 ${id} 不存在`);
    return d;
  }

  /** 公开端点：扫码页根据 skuId+lang+type 取最新版本 */
  async findCurrent(skuId: string, type: DocType, lang: DocLang): Promise<SkuDocumentRow | null> {
    return this.db.get<SkuDocumentRow>(
      `SELECT * FROM SkuDocument
       WHERE skuId = ? AND type = ? AND lang = ? AND deprecatedAt IS NULL
       ORDER BY uploadedAt DESC LIMIT 1`,
      skuId, type, lang) ?? null;
  }

  async upload(input: {
    skuId: string;
    type: DocType;
    lang: DocLang;
    version: string;
    title: string;
    batchId?: string | null;
    fileBuffer: Buffer;
    fileName: string;
    mimeType: string;
  }, actorUserId?: string): Promise<SkuDocumentRow> {
    const sku = this.db.get<{ id: string }>('SELECT id FROM Sku WHERE id = ?', input.skuId);
    if (!sku) throw new NotFoundException(`SKU ${input.skuId} 不存在`);

    const rules = TYPE_RULES[input.type];
    if (!rules.mimes.includes(input.mimeType)) {
      throw new BadRequestException(`MIME ${input.mimeType} 不在 ${input.type} 白名单: ${rules.mimes.join(', ')}`);
    }
    if (input.fileBuffer.length > rules.maxBytes) {
      throw new BadRequestException(`文件大小 ${input.fileBuffer.length}B 超过 ${input.type} 上限 ${rules.maxBytes}B`);
    }

    const sha256 = createHash('sha256').update(input.fileBuffer).digest('hex');

    const dupSha = this.db.get<{ id: string }>(
      'SELECT id FROM SkuDocument WHERE skuId = ? AND sha256 = ?',
      input.skuId, sha256);
    if (dupSha) {
      throw new ConflictException(`该内容已上传过(documentId=${dupSha.id})，sha256=${sha256.slice(0, 12)}...`);
    }

    const dupVer = this.db.get<{ id: string }>(
      'SELECT id FROM SkuDocument WHERE skuId = ? AND type = ? AND lang = ? AND version = ?',
      input.skuId, input.type, input.lang, input.version);
    if (dupVer) {
      throw new ConflictException(`版本 ${input.version} 已存在(documentId=${dupVer.id})，请使用新版本号`);
    }

    const storageKey = this.storage.buildKey({
      skuId: input.skuId,
      type: input.type,
      lang: input.lang,
      version: input.version,
      mimeType: input.mimeType,
    });

    await this.storage.put(storageKey, input.fileBuffer, { mimeType: input.mimeType });

    const id = `doc-${Date.now()}-${randomBytes(4).toString('hex')}`;
    this.db.run(
      `INSERT INTO SkuDocument (id, skuId, batchId, type, lang, version, title, fileName, mimeType, sizeBytes, storageKey, sha256, uploadedByUserId, uploadedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      id,
      input.skuId,
      input.batchId ?? null,
      input.type,
      input.lang,
      input.version,
      input.title,
      input.fileName,
      input.mimeType,
      input.fileBuffer.length,
      storageKey,
      sha256,
      actorUserId ?? null,
    );

    this.log.log(`uploaded doc ${id} ${input.skuId}/${input.type}/${input.lang}/${input.version} (${input.fileBuffer.length}B)`);
    return this.get(id);
  }

  /** 软删除 */
  async deprecate(id: string, actorUserId?: string): Promise<SkuDocumentRow> {
    const d = await this.get(id);
    if (d.deprecatedAt) {
      throw new ConflictException(`文档已弃用(${d.deprecatedAt})`);
    }
    this.db.run(`UPDATE SkuDocument SET deprecatedAt = CURRENT_TIMESTAMP WHERE id = ?`, id);
    this.log.log(`deprecated doc ${id} by ${actorUserId ?? 'unknown'}`);
    return this.get(id);
  }

  /** 物理删除（演示期工具） */
  async hardDelete(id: string): Promise<{ ok: true; id: string }> {
    const d = await this.get(id);
    await this.storage.delete(d.storageKey);
    this.db.run('DELETE FROM SkuDocument WHERE id = ?', id);
    return { ok: true, id };
  }

  /** admin 下载：返回文件 buffer */
  async readFile(id: string): Promise<{ doc: SkuDocumentRow; buffer: Buffer }> {
    const doc = await this.get(id);
    const buffer = await this.storage.get(doc.storageKey);
    return { doc, buffer };
  }

  /** 公开端点：扫码页拿文件流 */
  async readPublic(skuId: string, type: DocType, lang: DocLang): Promise<{ doc: SkuDocumentRow; stream: NodeJS.ReadableStream }> {
    const doc = await this.findCurrent(skuId, type, lang);
    if (!doc) throw new NotFoundException(`${skuId} ${type} ${lang} 无可用文档`);
    if (!(await this.storage.exists(doc.storageKey))) {
      throw new NotFoundException(`文件已丢失 storageKey=${doc.storageKey}`);
    }
    const stream = await this.storage.getStream(doc.storageKey);
    return { doc, stream };
  }
}