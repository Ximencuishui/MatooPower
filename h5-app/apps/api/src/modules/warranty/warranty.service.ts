// 保修期计算：策略 A（发票日优先）+ 策略 C（MFG+60 天兜底）

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { DbService } from '../../common/db/db';

const DAY_MS = 24 * 60 * 60 * 1000;
const MFG_FALLBACK_DAYS = 60;

export interface ActivateWarrantyInput {
  skuId: string;
  country: string;
  city: string;
  dealerName?: string;
  invoiceNo?: string;
  invoiceDate?: string;
  invoiceAmount?: number;
  invoicePhotoUrl?: string;
}

export interface ActivateWarrantyResult {
  warranty: any;
  policy: 'INVOICE' | 'MFG_FALLBACK';
  startAt: Date;
  endAtWhole: Date;
  endAtCell: Date | null;
  endAtBms: Date | null;
  endAtParts: Date | null;
}

@Injectable()
export class WarrantyService {
  constructor(private readonly db: DbService) {}

  async activate(
    userId: string,
    input: ActivateWarrantyInput,
  ): Promise<ActivateWarrantyResult> {
    const sku = this.db.get<any>('SELECT * FROM Sku WHERE id = ?', input.skuId);
    if (!sku) throw new NotFoundException(`SKU ${input.skuId} 不存在`);

    const dup = this.db.get<{ id: string }>('SELECT id FROM Warranty WHERE skuId = ? AND userId = ?', input.skuId, userId);
    if (dup) {
      throw new ConflictException('该 SKU 已激活过保修，不可重复激活');
    }

    const { startAt, policy } = this.resolveStartAt(sku.mfgDate, input.invoiceDate);

    const endAtWhole = this.addMonths(startAt, sku.warrantyMonthsWhole);
    const endAtCell = sku.warrantyMonthsCell ? this.addMonths(startAt, sku.warrantyMonthsCell) : null;
    const endAtBms = sku.warrantyMonthsBms ? this.addMonths(startAt, sku.warrantyMonthsBms) : null;
    const endAtParts = sku.warrantyMonthsParts ? this.addMonths(startAt, sku.warrantyMonthsParts) : null;

    const id = 'war_' + randomBytes(8).toString('hex');
    this.db.run(
      `INSERT INTO Warranty (id, skuId, userId, country, city, dealerName, invoiceNo, invoiceDate, invoiceAmount, invoicePhotoUrl, status, startAt, endAtWhole, endAtCell, endAtBms, endAtParts, reviewNotes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)`,
      id,
      sku.id, userId,
      input.country, input.city,
      input.dealerName ?? null,
      input.invoiceNo ?? null,
      input.invoiceDate ?? null,
      input.invoiceAmount ?? null,
      input.invoicePhotoUrl ?? null,
      startAt.toISOString(),
      endAtWhole.toISOString(),
      endAtCell?.toISOString() ?? null,
      endAtBms?.toISOString() ?? null,
      endAtParts?.toISOString() ?? null,
      `策略来源: ${policy}${policy === 'MFG_FALLBACK' ? `（${MFG_FALLBACK_DAYS} 天兜底）` : ''}`,
    );

    this.db.run(
      'UPDATE Sku SET activated = 1, activatedAt = CURRENT_TIMESTAMP, activatedByUserId = ? WHERE id = ?',
      userId, sku.id,
    );

    const w = this.db.get<any>('SELECT * FROM Warranty WHERE id = ?', id);
    return { warranty: w, policy, startAt, endAtWhole, endAtCell, endAtBms, endAtParts };
  }

  async findOne(id: string, userId?: string) {
    const w = this.db.get<any>('SELECT * FROM Warranty WHERE id = ?', id);
    if (!w) throw new NotFoundException(`warranty ${id} 不存在`);
    if (userId && w.userId !== userId) {
      throw new NotFoundException(`warranty ${id} 不存在`);
    }
    const sku = this.db.get<any>('SELECT * FROM Sku WHERE id = ?', w.skuId);
    return { ...w, sku };
  }

  /** P0-1:按 skuId 查最新保修,owner/admin 校验 */
  async findBySku(skuId: string, userId?: string) {
    const w = this.db.get<any>(
      'SELECT * FROM Warranty WHERE skuId = ? ORDER BY createdAt DESC LIMIT 1',
      skuId,
    );
    if (!w) return null;
    if (userId && w.userId !== userId) {
      throw new NotFoundException(`warranty for sku ${skuId} 不存在`);
    }
    const sku = this.db.get<any>('SELECT * FROM Sku WHERE id = ?', w.skuId);
    return { ...w, sku };
  }

  async listMine(userId: string) {
    const rows = this.db.all<any>(
      'SELECT w.*, s.sku AS s_sku, s.modelName AS s_modelName FROM Warranty w JOIN Sku s ON w.skuId = s.id WHERE w.userId = ? ORDER BY w.createdAt DESC',
      userId,
    );
    return rows;
  }

  async listAll() {
    const rows = this.db.all<any>(
      `SELECT w.*, u.phone AS user_phone, u.displayName AS user_displayName,
              s.sku AS s_sku, s.modelName AS s_modelName, s.serial AS s_serial
       FROM Warranty w
       JOIN User u ON w.userId = u.id
       JOIN Sku s ON w.skuId = s.id
       ORDER BY w.createdAt DESC`,
    );
    return rows;
  }

  async review(id: string, status: 'active' | 'pending' | 'expired' | 'rejected', notes?: string) {
    const w = this.db.get<{ id: string; reviewNotes: string | null }>('SELECT id, reviewNotes FROM Warranty WHERE id = ?', id);
    if (!w) throw new NotFoundException(`warranty ${id} 不存在`);
    this.db.run('UPDATE Warranty SET status = ?, reviewNotes = ? WHERE id = ?', status, notes ?? w.reviewNotes, id);
    return this.db.get('SELECT * FROM Warranty WHERE id = ?', id);
  }

  private resolveStartAt(
    mfgDate: string | Date,
    invoiceDateIso?: string,
  ): { startAt: Date; policy: 'INVOICE' | 'MFG_FALLBACK' } {
    const mfg = new Date(mfgDate);
    if (invoiceDateIso) {
      const invoice = new Date(invoiceDateIso);
      if (Number.isNaN(invoice.getTime())) {
        throw new BadRequestException('invoiceDate 格式不合法');
      }
      const start = invoice < mfg ? new Date(mfg.getTime()) : invoice;
      return { startAt: start, policy: 'INVOICE' };
    }
    return {
      startAt: new Date(mfg.getTime() + MFG_FALLBACK_DAYS * DAY_MS),
      policy: 'MFG_FALLBACK',
    };
  }

  private addMonths(d: Date, months: number): Date {
    const out = new Date(d.getTime());
    const day = out.getUTCDate();
    out.setUTCMonth(out.getUTCMonth() + months);
    if (out.getUTCDate() < day) out.setUTCDate(0);
    return out;
  }
}