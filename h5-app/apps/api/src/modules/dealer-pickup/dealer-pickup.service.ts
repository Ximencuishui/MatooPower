// v1.5 #P0-3:经销商提货批次 Service
// - 多设备(A/B)统一看到同一份批次记录(演示期 localStorage 升级)
// - 与 dealer.bulkActivate 通过 (pickupItem.sku + pickupItem.serial) 关联激活
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../../common/db/db';
import { CreateDealerPickupDto } from './dto/dealer-pickup.dto';

function nowId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

@Injectable()
export class DealerPickupService {
  constructor(private readonly db: DbService) {}

  /**
   * dealer 角色登记提货批次 — 自动绑定到用户所属 Dealer
   * - 如果 user 暂未挂 dealerId(老经销商 user),则要求 adminspec 中 dealerId 由外部传参
   * - 演示期 user.dealerId 缺失会 400
   */
  async create(body: CreateDealerPickupDto, userId: string, dealerId: string) {
    if (!dealerId) throw new BadRequestException('当前账号未绑定经销商,无法登记提货');
    if (!body.items || body.items.length === 0) {
      throw new BadRequestException('items 不能为空');
    }
    const id = nowId('dpk');
    this.db.run('BEGIN');
    try {
      this.db.run(
        `INSERT INTO DealerPickup (id, dealerId, shipmentInvoiceNo, shipmentDate, createdByUserId, note, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        id,
        dealerId,
        body.shipmentInvoiceNo,
        body.shipmentDate,
        userId,
        body.note ?? null,
      );
      const items: Array<{ id: string; sku: string; serial: string }> = [];
      for (const it of body.items) {
        const itemId = nowId('dpi');
        this.db.run(
          `INSERT INTO DealerPickupItem (id, pickupId, sku, serial, activated, createdAt)
           VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)`,
          itemId, id, it.sku, it.serial,
        );
        items.push({ id: itemId, sku: it.sku, serial: it.serial });
      }
      this.db.run('COMMIT');
      return this.get(id, dealerId);
    } catch (e) {
      this.db.run('ROLLBACK');
      throw e;
    }
  }

  get(id: string, dealerId: string) {
    const p = this.db.get('SELECT * FROM DealerPickup WHERE id = ?', id);
    if (!p) throw new NotFoundException(`pickup ${id} 不存在`);
    if (p.dealerId !== dealerId) {
      // 隔离:防止经销商互看
      throw new NotFoundException(`pickup ${id} 不存在`);
    }
    const items = this.db.all('SELECT * FROM DealerPickupItem WHERE pickupId = ? ORDER BY createdAt ASC', id);
    return { ...p, items };
  }

  list(dealerId: string, opts: { invoiceNo?: string } = {}) {
    const where: string[] = ['dealerId = ?'];
    const params: any[] = [dealerId];
    if (opts.invoiceNo) { where.push('shipmentInvoiceNo LIKE ?'); params.push(`%${opts.invoiceNo}%`); }
    const pickups = this.db.all(
      `SELECT * FROM DealerPickup WHERE ${where.join(' AND ')} ORDER BY createdAt DESC LIMIT 200`,
      ...params,
    );
    // 批量 group items 减少 N+1
    const ids = pickups.map((p) => p.id);
    const itemsMap = new Map<string, any[]>();
    if (ids.length) {
      const placeholders = ids.map(() => '?').join(',');
      const items = this.db.all(
        `SELECT * FROM DealerPickupItem WHERE pickupId IN (${placeholders}) ORDER BY createdAt ASC`,
        ...ids,
      );
      for (const it of items) {
        const arr = itemsMap.get(it.pickupId) ?? [];
        arr.push(it);
        itemsMap.set(it.pickupId, arr);
      }
    }
    return pickups.map((p) => ({ ...p, items: itemsMap.get(p.id) ?? [] }));
  }

  remove(id: string, dealerId: string) {
    const p = this.db.get('SELECT id, dealerId FROM DealerPickup WHERE id = ?', id);
    if (!p || p.dealerId !== dealerId) {
      throw new NotFoundException(`pickup ${id} 不存在`);
    }
    // 仅允许删除「尚未激活」批次
    const stillActive = this.db.get<{ c: number }>(
      "SELECT COUNT(*) AS c FROM DealerPickupItem WHERE pickupId = ? AND activated = 1", id)?.c ?? 0;
    if (stillActive > 0) {
      throw new BadRequestException(`批次已有 ${stillActive} 件激活,无法删除`);
    }
    this.db.run('DELETE FROM DealerPickupItem WHERE pickupId = ?', id);
    this.db.run('DELETE FROM DealerPickup WHERE id = ?', id);
    return { ok: true, id };
  }

  /**
   * 给 DealerPickupItem 关联激活后的 Warranty
   * - 由 dealer.bulkActivate 在激活成功后调用
   * - 不暴露为 HTTP 端点,仅供 internal 调用
   */
  async markSerialActivated(pickupItemId: string, warrantyId: string) {
    this.db.run(
      'UPDATE DealerPickupItem SET activated = 1, warrantyId = ? WHERE id = ?',
      warrantyId, pickupItemId,
    );
  }

  /**
   * 由 dealer.bulkActivate 在激活前反查 sku/serial → pickupItemId
   * 用于把 Warranty ↔ DealerPickupItem 反向关联
   * v1.5 #C1 修复:加 ORDER BY dpi.createdAt DESC — 优先匹配最新登记的 DPI,
   * 否则冒烟/演示中重复登记同一 serial 会随机命中老 DPI,导致最新 DPI 永远 activated=0
   */
  findItemBySerial(sku: string, serial: string, dealerId: string): { pickupItemId: string; pickupId: string } | null {
    const r = this.db.get<{ id: string; pickupId: string }>(
      `SELECT dpi.id, dpi.pickupId
       FROM DealerPickupItem dpi
       JOIN DealerPickup dp ON dp.id = dpi.pickupId
       WHERE dpi.sku = ? AND dpi.serial = ? AND dp.dealerId = ? AND dpi.activated = 0
       ORDER BY dpi.createdAt DESC
       LIMIT 1`,
      sku, serial, dealerId,
    );
    return r ? { pickupItemId: r.id, pickupId: r.pickupId } : null;
  }
}
