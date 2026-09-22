import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../../common/db/db';
import { CreateSkuBatchDto, UpdateSkuBatchDto } from './dto/sku-batch.dto';

export interface SkuBatchRow {
  id: string;
  batchCode: string;
  mfgDate: string;
  factory: string | null;
  destinationCountry: string | null;
  totalQuantity: number;
  note: string | null;
  createdByUserId: string | null;
  createdAt: string;
}

export interface SkuBatchWithStats extends SkuBatchRow {
  skuCount: number;
  documentCount: number;
  qrBatchCount: number;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class SkuBatchService {
  constructor(private readonly db: DbService) {}

  async list(opts: { q?: string; page?: number; pageSize?: number } = {}): Promise<PageResult<SkuBatchWithStats>> {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
    const offset = (page - 1) * pageSize;
    const q = opts.q?.trim() ?? '';

    const where: string[] = [];
    const params: any[] = [];
    if (q) {
      const like = `%${q}%`;
      where.push('(batchCode LIKE ? OR factory LIKE ? OR destinationCountry LIKE ? OR note LIKE ?)');
      params.push(like, like, like, like);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const totalRow = this.db.get<{ c: number }>(
      `SELECT COUNT(*) AS c FROM SkuBatch ${whereSql}`, ...params);
    const total = totalRow?.c ?? 0;

    const rows = this.db.all<SkuBatchRow>(
      `SELECT * FROM SkuBatch ${whereSql} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
      ...params, pageSize, offset);

    // 关联统计（每批次的 SKU / Document / QrBatch 数）
    const items = rows.map((b) => this.withStats(b));

    return { items, total, page, pageSize };
  }

  async get(id: string): Promise<SkuBatchWithStats> {
    const b = this.db.get<SkuBatchRow>('SELECT * FROM SkuBatch WHERE id = ?', id);
    if (!b) throw new NotFoundException(`批次 ${id} 不存在`);
    return this.withStats(b);
  }

  async create(input: CreateSkuBatchDto, actorUserId?: string): Promise<SkuBatchRow> {
    if (new Date(input.mfgDate).getTime() > Date.now() + 24 * 3600 * 1000) {
      throw new BadRequestException('mfgDate 不允许为未来日期');
    }
    const dup = this.db.get<{ id: string }>('SELECT id FROM SkuBatch WHERE batchCode = ?', input.batchCode);
    if (dup) throw new ConflictException(`批次号 ${input.batchCode} 已存在`);
    const id = `sb-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    this.db.run(
      `INSERT INTO SkuBatch (id, batchCode, mfgDate, factory, destinationCountry, totalQuantity, note, createdByUserId, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      id,
      input.batchCode,
      new Date(input.mfgDate).toISOString(),
      input.factory ?? null,
      input.destinationCountry ?? null,
      input.totalQuantity ?? 0,
      input.note ?? null,
      actorUserId ?? null,
    );
    return this.db.get<SkuBatchRow>('SELECT * FROM SkuBatch WHERE id = ?', id)!;
  }

  async update(id: string, patch: UpdateSkuBatchDto): Promise<SkuBatchRow> {
    const b = this.db.get<SkuBatchRow>('SELECT * FROM SkuBatch WHERE id = ?', id);
    if (!b) throw new NotFoundException(`批次 ${id} 不存在`);

    if (patch.batchCode && patch.batchCode !== b.batchCode) {
      const dup = this.db.get<{ id: string }>('SELECT id FROM SkuBatch WHERE batchCode = ? AND id <> ?', patch.batchCode, id);
      if (dup) throw new ConflictException(`批次号 ${patch.batchCode} 已被占用`);
    }

    const fields: string[] = [];
    const params: any[] = [];
    for (const [key, col] of [
      ['batchCode', 'batchCode'],
      ['mfgDate', 'mfgDate'],
      ['factory', 'factory'],
      ['destinationCountry', 'destinationCountry'],
      ['totalQuantity', 'totalQuantity'],
      ['note', 'note'],
    ] as const) {
      if ((patch as any)[key] !== undefined) {
        fields.push(`${col} = ?`);
        params.push(key === 'mfgDate' ? new Date((patch as any)[key]).toISOString() : (patch as any)[key]);
      }
    }
    if (fields.length === 0) return b;
    params.push(id);
    this.db.run(`UPDATE SkuBatch SET ${fields.join(', ')} WHERE id = ?`, ...params);
    return this.db.get<SkuBatchRow>('SELECT * FROM SkuBatch WHERE id = ?', id)!;
  }

  /**
   * 删除：仅当未关联 SKU / Document / QrBatch 时允许
   */
  async remove(id: string): Promise<{ ok: true; id: string }> {
    const b = this.db.get<{ id: string }>('SELECT id FROM SkuBatch WHERE id = ?', id);
    if (!b) throw new NotFoundException(`批次 ${id} 不存在`);

    const skuCount = this.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM Sku WHERE batchId = ?', id)?.c ?? 0;
    if (skuCount > 0) {
      throw new BadRequestException(`批次已关联 ${skuCount} 个 SKU，无法删除`);
    }
    const docCount = this.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM SkuDocument WHERE batchId = ?', id)?.c ?? 0;
    if (docCount > 0) {
      throw new BadRequestException(`批次已关联 ${docCount} 个文档，无法删除`);
    }
    const qrCount = this.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM QrBatch WHERE batchId = ?', id)?.c ?? 0;
    if (qrCount > 0) {
      throw new BadRequestException(`批次已关联 ${qrCount} 个 QR 任务，无法删除`);
    }

    this.db.run('DELETE FROM SkuBatch WHERE id = ?', id);
    return { ok: true, id };
  }

  private withStats(b: SkuBatchRow): SkuBatchWithStats {
    const skuCount = this.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM Sku WHERE batchId = ?', b.id)?.c ?? 0;
    const documentCount = this.db.get<{ c: number }>(
      'SELECT COUNT(*) AS c FROM SkuDocument WHERE batchId = ? AND deprecatedAt IS NULL', b.id)?.c ?? 0;
    const qrBatchCount = this.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM QrBatch WHERE batchId = ?', b.id)?.c ?? 0;
    return { ...b, skuCount, documentCount, qrBatchCount };
  }
}