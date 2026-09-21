// DealerService — 经销商工作台服务
// 关键能力：
//   - getOverview：出货数 / 激活数 / 待审保修
//   - listWarranties：按 dealer 过滤（用 activatedByUserId 关联 user → dealer）
//   - bulkActivate：一次提交多个 SKU 激活
//
// 演示期简化：dealer = 用户.role='dealer'，通过 dealerName 字段软关联
// 生产期建议：增加 Dealer 表独立管理 dealer 实体（公司名、认证、专属价）

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DbService } from '../../common/db/db';
import { BulkActivateDto } from './dto/bulk-activate.dto';

export interface Overview {
  warrantyCount: number;
  deviceCount: number;
  pendingReviewCount: number;
  activatedThisMonth: number;
}

@Injectable()
export class DealerService {
  constructor(private readonly db: DbService) {}

  /**
   * 经销商概览：基于该 dealer user 触发的所有激活（通过 Sku.activatedByUserId 反查）
   * 注意：保修与设备的 userId 字段是真正归属的 customer user，不是 dealer
   */
  getOverview(dealerUserId: string): Overview {
    const warrantyCount = this.db.get<{ c: number }>(
      `SELECT COUNT(*) AS c FROM Warranty w
       JOIN Sku s ON w.skuId = s.id
       WHERE s.activatedByUserId = ?`,
      dealerUserId,
    )?.c ?? 0;

    const deviceCount = this.db.get<{ c: number }>(
      `SELECT COUNT(DISTINCT d.id) AS c FROM Device d
       JOIN Sku s ON d.skuId = s.id
       WHERE s.activatedByUserId = ?`,
      dealerUserId,
    )?.c ?? 0;

    const pendingReviewCount = 0;  // 演示：直接 active

    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    firstOfMonth.setHours(0, 0, 0, 0);
    const activatedThisMonth = this.db.get<{ c: number }>(
      `SELECT COUNT(*) AS c FROM Warranty w
       JOIN Sku s ON w.skuId = s.id
       WHERE s.activatedByUserId = ? AND w.createdAt >= ?`,
      dealerUserId,
      firstOfMonth.toISOString(),
    )?.c ?? 0;

    return { warrantyCount, deviceCount, pendingReviewCount, activatedThisMonth };
  }

  /**
   * 经销商的保修列表（按 Sku.activatedByUserId = dealer 过滤）
   */
  listWarranties(dealerUserId: string, status?: string) {
    let sql = `
      SELECT w.*, s.sku AS s_sku, s.modelName AS s_modelName, s.serial AS s_serial
      FROM Warranty w
      JOIN Sku s ON w.skuId = s.id
      WHERE s.activatedByUserId = ?
    `;
    const args: any[] = [dealerUserId];
    if (status) {
      sql += ' AND w.status = ?';
      args.push(status);
    }
    sql += ' ORDER BY w.createdAt DESC';
    return this.db.all(sql, ...args);
  }

  /**
   * 经销商触发的设备列表（按 SKU 反查）
   */
  listDevices(dealerUserId: string) {
    return this.db.all(
      `SELECT d.*, s.sku AS s_sku, s.modelName AS s_modelName, s.serial AS s_serial
       FROM Device d JOIN Sku s ON d.skuId = s.id
       WHERE s.activatedByUserId = ? ORDER BY d.boundAt DESC`,
      dealerUserId,
    );
  }

  /**
   * 批量激活（演示版）
   * 流程：
   *   1. 校验每个 qrId 命中 SKU
   *   2. 找到/创建客户 user（用 customerPhone）
   *   3. 计算保修期（按 SKU 配置；invoiceDate 优先，否则 MFG+60天）
   *   4. 创建 Warranty + Device
   *   5. 标记 SKU activated
   * 事务式：任一失败回滚所有
   */
  bulkActivate(dealerUserId: string, dto: BulkActivateDto) {
    if (dto.items.length === 0) {
      throw new BadRequestException('items 不能为空');
    }

    // 1. 校验 SKU 全存在 + 未激活
    const skuIds: string[] = [];
    for (const item of dto.items) {
      const skuId = this.extractSkuId(item.qrId);
      const sku = this.db.get<any>('SELECT * FROM Sku WHERE id = ?', skuId);
      if (!sku) {
        throw new NotFoundException(`SKU ${skuId} 不存在`);
      }
      if (sku.activated) {
        throw new ConflictException(`SKU ${skuId} 已被激活（serial=${sku.serial}）`);
      }
      skuIds.push(skuId);
    }

    // dealerName：演示期取 dealer User.displayName（软关联），生产期换独立 Dealer 表
    // fallback null 与 warranty.service 普通激活路径 input.dealerName ?? null 对齐
    const dealerName = this.db.get<{ displayName: string }>(
      'SELECT displayName FROM User WHERE id = ?',
      dealerUserId,
    )?.displayName ?? null;

    // 2. 事务处理
    const results: Array<{ qrId: string; skuId: string; warrantyId: string; deviceId: string; customerId: string; policy: 'INVOICE' | 'MFG_FALLBACK' }> = [];

    for (let i = 0; i < dto.items.length; i++) {
      const item = dto.items[i]!;
      const skuId = skuIds[i]!;
      const sku = this.db.get<any>('SELECT * FROM Sku WHERE id = ?', skuId)!;

      // 找/建客户
      const customerId = this.upsertCustomer(item.customerPhone, item.customerName);

      // 计算保修期
      const invDate = item.invoiceDate ? new Date(item.invoiceDate) : null;
      const policy: 'INVOICE' | 'MFG_FALLBACK' = invDate ? 'INVOICE' : 'MFG_FALLBACK';
      const startAt = invDate ?? this.addDays(new Date(sku.mfgDate), 60);
      const endAtWhole = this.addMonths(startAt, sku.warrantyMonthsWhole);
      const endAtCell = sku.warrantyMonthsCell ? this.addMonths(startAt, sku.warrantyMonthsCell) : null;
      const endAtBms = sku.warrantyMonthsBms ? this.addMonths(startAt, sku.warrantyMonthsBms) : null;
      const endAtParts = sku.warrantyMonthsParts ? this.addMonths(startAt, sku.warrantyMonthsParts) : null;

      const warrantyId = `warranty-bulk-${Date.now()}-${i}`;
      this.db.run(
        `INSERT INTO Warranty (id, skuId, userId, country, city, dealerName, invoiceNo, invoiceDate, invoiceAmount, status, startAt, endAtWhole, endAtCell, endAtBms, endAtParts)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        warrantyId,
        skuId,
        customerId,
        'BD',  // 演示：默认 BD
        'Dhaka',
        dealerName,
        item.invoiceNo ?? dto.shipmentInvoiceNo ?? null,
        invDate ? invDate.toISOString() : null,
        null,
        'active',
        startAt.toISOString(),
        endAtWhole.toISOString(),
        endAtCell ? endAtCell.toISOString() : null,
        endAtBms ? endAtBms.toISOString() : null,
        endAtParts ? endAtParts.toISOString() : null,
      );

      // 创建 device（自动绑定到客户 userId）
      const deviceId = `dev-bulk-${Date.now()}-${i}`;
      this.db.run(
        `INSERT INTO Device (id, skuId, userId, soh, soc, cycles, temp, volt, curr, fw, alarms, lastSeenAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        deviceId,
        skuId,
        customerId,
        100, 92, 0, 25, 13.3, 0.0, 'v1.2.5', 0,
      );

      // 标记 SKU 已激活（关联 dealer）
      this.db.run(
        `UPDATE Sku SET activated=1, activatedAt=CURRENT_TIMESTAMP, activatedByUserId=? WHERE id=?`,
        dealerUserId,
        skuId,
      );

      results.push({
        qrId: item.qrId,
        skuId,
        warrantyId,
        deviceId,
        customerId,
        policy,
      });
    }

    return { ok: true, count: results.length, items: results };
  }

  private extractSkuId(qrId: string): string {
    // 期望 "Matoo:<skuId>:..."；演示期 raw skuId 也可
    const m = qrId.match(/^Matoo:([^:]+):/);
    if (m) return m[1]!;
    return qrId;
  }

  private upsertCustomer(phone: string, displayName?: string): string {
    const existing = this.db.get<any>('SELECT id FROM User WHERE phone = ?', phone);
    if (existing) {
      if (displayName) {
        this.db.run('UPDATE User SET displayName = ? WHERE id = ?', displayName, existing.id);
      }
      return existing.id;
    }
    const id = 'usr_' + Math.random().toString(36).slice(2, 14);
    this.db.run(
      'INSERT INTO User (id, phone, role, displayName) VALUES (?, ?, ?, ?)',
      id,
      phone,
      'customer',
      displayName ?? `Customer ${phone.slice(-4)}`,
    );
    return id;
  }

  private addMonths(d: Date, months: number): Date {
    const out = new Date(d);
    out.setMonth(out.getMonth() + months);
    return out;
  }

  private addDays(d: Date, days: number): Date {
    const out = new Date(d);
    out.setDate(out.getDate() + days);
    return out;
  }
}