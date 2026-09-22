import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHmac, randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import { DbService } from '../../common/db/db';
import { StorageService } from '../storage/storage.service';
import { QrSignerService } from '../sku/qr-signer.service';
import { generateQrPng } from './qr-png.util';

export interface QrBatchRow {
  id: string;
  batchId: string;
  totalQuantity: number;
  generatedCount: number;
  status: string;
  zipStorageKey: string | null;
  errorMessage: string | null;
  generatedByUserId: string;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

const MAX_QUANTITY = 5000;
const DEFAULT_SIZE = 512;

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class QrBatchService {
  private readonly log = new Logger(QrBatchService.name);

  constructor(
    private readonly db: DbService,
    private readonly storage: StorageService,
    private readonly qr: QrSignerService,
  ) {}

  async list(opts: { page?: number; pageSize?: number } = {}): Promise<PageResult<QrBatchRow>> {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
    const offset = (page - 1) * pageSize;
    const total = this.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM QrBatch')?.c ?? 0;
    const items = this.db.all<QrBatchRow>(
      `SELECT * FROM QrBatch ORDER BY createdAt DESC LIMIT ? OFFSET ?`, pageSize, offset);
    return { items, total, page, pageSize };
  }

  async get(id: string): Promise<QrBatchRow> {
    const b = this.db.get<QrBatchRow>('SELECT * FROM QrBatch WHERE id = ?', id);
    if (!b) throw new NotFoundException(`QrBatch ${id} 不存在`);
    return b;
  }

  /** 触发批量生成(同步阻塞直到完成,适合演示期 5k 以内) */
  async trigger(input: { batchId: string; quantity?: number }, actorUserId: string): Promise<QrBatchRow> {
    const batch = this.db.get<{ id: string; batchCode: string }>('SELECT id, batchCode FROM SkuBatch WHERE id = ?', input.batchId);
    if (!batch) throw new NotFoundException(`SkuBatch ${input.batchId} 不存在`);

    const skus = this.db.all<{ id: string; serial: string }>('SELECT id, serial FROM Sku WHERE batchId = ?', input.batchId);
    if (skus.length === 0) throw new BadRequestException(`批次 ${batch.batchCode} 未关联任何 SKU`);

    const quantity = input.quantity ?? skus.length;
    if (quantity < 1) throw new BadRequestException('quantity 至少 1');
    if (quantity > MAX_QUANTITY) throw new BadRequestException(`quantity 至多 ${MAX_QUANTITY}`);

    const id = `qb-${Date.now()}-${randomBytes(4).toString('hex')}`;
    const startedAt = new Date().toISOString();

    this.db.run(
      `INSERT INTO QrBatch (id, batchId, totalQuantity, generatedCount, status, generatedByUserId, startedAt, createdAt)
       VALUES (?, ?, ?, 0, 'running', ?, ?, CURRENT_TIMESTAMP)`,
      id, input.batchId, quantity, actorUserId, startedAt);

    // 同步生成(演示期 5000 个约 5-10s)
    try {
      const { zipKey, generatedCount } = await this.generate(id, input.batchId, batch.batchCode, skus, quantity);
      this.db.run(
        `UPDATE QrBatch SET status = 'done', generatedCount = ?, zipStorageKey = ?, finishedAt = CURRENT_TIMESTAMP WHERE id = ?`,
        generatedCount, zipKey, id);
      this.log.log(`QrBatch ${id} done: ${generatedCount} PNGs`);
    } catch (e) {
      this.db.run(
        `UPDATE QrBatch SET status = 'failed', errorMessage = ?, finishedAt = CURRENT_TIMESTAMP WHERE id = ?`,
        (e as Error).message ?? 'unknown', id);
      throw e;
    }

    return this.get(id);
  }

  /** 实际生成流程:签名 → 写 QrSignature → 生成 PNG → ZIP → 上传 */
  private async generate(
    qbId: string, batchId: string, batchCode: string,
    skus: { id: string; serial: string }[], quantity: number,
  ): Promise<{ zipKey: string; generatedCount: number }> {
    const zipKey = `qr-batch/${batchCode}/${qbId}.zip`;

    // 直接调用 storage.put,但 zip 是流;用 adm-zip(CommonJS 友好) 构建 Buffer 后 put
    const AdmZip = require('adm-zip');
    const zip = new AdmZip();
    let generatedCount = 0;

    // 按 SKU 均分 quantity（演示期策略：先取 quantity 个 SKU，不足则循环复用）
    for (let i = 0; i < quantity; i++) {
      const sku = skus[i % skus.length]!;
      const nonce = randomBytes(6).toString('hex');
      const payload = `${sku.id}|${sku.serial}|${batchCode}|${nonce}`;
      const sig = this.qr.signRaw(payload);
      const qrText = `${payload}|${sig}`;

      // 落 QrSignature 行(便于 revoke 查找)
      const qrId = `${sku.id}:${nonce}`;
      try {
        this.db.run(
          `INSERT INTO QrSignature (id, qrId, skuId, signature) VALUES (?, ?, ?, ?)`,
          `qrsig-${Date.now()}-${randomBytes(4).toString('hex')}`,
          qrId, sku.id, sig);
      } catch (e) {
        // 唯一冲突（极小概率）跳过
        this.log.warn(`QrSignature dup qrId=${qrId}: ${(e as Error).message}`);
        continue;
      }

      const png = await generateQrPng(qrText, { width: DEFAULT_SIZE });
      // 文件名：<sku.sku>-<serial>-<4位序号>.png 便于贴标员识别
      const filename = `${sku.id}-${String(i + 1).padStart(4, '0')}.png`;
      zip.addFile(filename, png);
      generatedCount++;
    }

    // 写 manifest.csv(batchCode / skuId / serial / qrId / signature / index)
    const lines = ['batchCode,skuId,serial,qrId,signature,index'];
    const sigRows = this.db.all<{ qrId: string; skuId: string; signature: string }>(
      `SELECT qrId, skuId, signature FROM QrSignature
       WHERE qrId IN (SELECT qrId FROM QrSignature WHERE skuId IN (SELECT id FROM Sku WHERE batchId = ?) ORDER BY createdAt DESC LIMIT ?)
       ORDER BY createdAt ASC`,
      batchId, quantity);
    sigRows.forEach((row, idx) => {
      const sku = skus.find((s) => s.id === row.skuId);
      const safeSig = row.signature.replace(/[\r\n,"]/g, '');
      lines.push(`${batchCode},${row.skuId},${sku?.serial ?? ''},${row.qrId},${safeSig},${idx + 1}`);
    });
    zip.addFile('manifest.csv', Buffer.from(lines.join('\n'), 'utf8'));

    const zipBuffer = zip.toBuffer();

    await this.storage.put(zipKey, zipBuffer, { mimeType: 'application/zip' });
    return { zipKey, generatedCount };
  }

  async getZipStream(id: string): Promise<{ batch: QrBatchRow; stream: Readable; filename: string }> {
    const b = await this.get(id);
    if (b.status !== 'done' || !b.zipStorageKey) {
      throw new BadRequestException(`QrBatch ${id} 状态=${b.status}，无 ZIP 可下载`);
    }
    const exists = await this.storage.exists(b.zipStorageKey);
    if (!exists) throw new NotFoundException(`ZIP 文件丢失 storageKey=${b.zipStorageKey}`);
    const stream = await this.storage.getStream(b.zipStorageKey);
    const batch = this.db.get<{ batchCode: string }>('SELECT batchCode FROM SkuBatch WHERE id = ?', b.batchId);
    const filename = `${batch?.batchCode ?? b.batchId}-qr-${b.totalQuantity}.zip`;
    return { batch: b, stream, filename };
  }

  /** 撤销单个 QR */
  async revokeQr(qrId: string, actorUserId: string): Promise<{ ok: true; qrId: string }> {
    const row = this.db.get<{ qrId: string; revoked: number }>(
      'SELECT qrId, revoked FROM QrSignature WHERE qrId = ?', qrId);
    if (!row) throw new NotFoundException(`QR ${qrId} 不存在`);
    if (row.revoked) throw new ConflictException(`QR ${qrId} 已撤销`);
    this.db.run('UPDATE QrSignature SET revoked = 1 WHERE qrId = ?', qrId);
    this.log.log(`revoked QR ${qrId} by ${actorUserId}`);
    return { ok: true, qrId };
  }

  /** 列出已撤销 QR */
  async listRevoked(opts: { page?: number; pageSize?: number } = {}): Promise<PageResult<{ qrId: string; skuId: string; signature: string; createdAt: string }>> {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
    const offset = (page - 1) * pageSize;
    const total = this.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM QrSignature WHERE revoked = 1')?.c ?? 0;
    const items = this.db.all<{ qrId: string; skuId: string; signature: string; createdAt: string }>(
      `SELECT qrId, skuId, signature, createdAt FROM QrSignature WHERE revoked = 1
       ORDER BY createdAt DESC LIMIT ? OFFSET ?`, pageSize, offset);
    return { items, total, page, pageSize };
  }
}