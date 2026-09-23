// DealerAdminService — 独立 Dealer 实体管理(P1-2 v1.4)
// 与 dealer.service(经销商工作台)解耦,只服务于 admin 后台
// 表 Dealer / DealerPriceList

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DbService } from '../../common/db/db';

export interface DealerItem {
  id: string;
  companyName: string;
  country: string;
  tier: 'silver' | 'gold' | 'platinum';
  contactEmail: string | null;
  contactPhone: string | null;
  status: 'active' | 'suspended';
  note: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
  priceListCount?: number;
}

export interface DealerPriceListItem {
  id: string;
  dealerId: string;
  skuId: string;
  priceCents: number;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdByUserId: string | null;
  createdAt: string;
  skuSku?: string;
  skuSerial?: string;
}

const TIER_VALUES = ['silver', 'gold', 'platinum'] as const;
const STATUS_VALUES = ['active', 'suspended'] as const;

@Injectable()
export class DealerAdminService {
  constructor(private readonly db: DbService) {}

  /** 经销商列表(带分页 + 搜索 + 关联统计) */
  list(opts: { q?: string; status?: string; page?: number; pageSize?: number } = {}) {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    const where: string[] = [];
    const params: any[] = [];
    if (opts.q) {
      where.push('(companyName LIKE ? OR country LIKE ? OR contactEmail LIKE ?)');
      const like = `%${opts.q}%`;
      params.push(like, like, like);
    }
    if (opts.status) {
      where.push('status = ?');
      params.push(opts.status);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const total = this.db.get<{ c: number }>(
      `SELECT COUNT(*) AS c FROM Dealer ${whereSql}`,
      ...params,
    )?.c ?? 0;

    const items = this.db.all(
      `SELECT d.*,
              (SELECT COUNT(*) FROM User u WHERE u.dealerId = d.id AND u.deletedAt IS NULL) AS memberCount,
              (SELECT COUNT(*) FROM DealerPriceList p WHERE p.dealerId = d.id) AS priceListCount
       FROM Dealer d
       ${whereSql}
       ORDER BY d.createdAt DESC LIMIT ? OFFSET ?`,
      ...params, pageSize, offset,
    );
    return { items, total, page, pageSize };
  }

  /** 经销商详情(含 priceList + 关联 user 数) */
  getById(id: string): DealerItem & { priceList: DealerPriceListItem[]; members: Array<{ id: string; phone: string | null; email: string | null; displayName: string | null; role: string }> } {
    const dealer = this.db.get<DealerItem>('SELECT * FROM Dealer WHERE id = ?', id);
    if (!dealer) throw new NotFoundException(`dealer ${id} 不存在`);
    const priceList = this.db.all<DealerPriceListItem & { skuSku: string; skuSerial: string }>(
      `SELECT p.*, s.sku AS skuSku, s.serial AS skuSerial
       FROM DealerPriceList p JOIN Sku s ON p.skuId = s.id
       WHERE p.dealerId = ? ORDER BY p.createdAt DESC`, id);
    const members = this.db.all<{ id: string; phone: string | null; email: string | null; displayName: string | null; role: string }>(
      `SELECT id, phone, email, displayName, role FROM User WHERE dealerId = ? AND deletedAt IS NULL`, id);
    return { ...dealer, priceList, members };
  }

  /** 新建经销商 */
  create(body: {
    companyName: string;
    country: string;
    tier?: 'silver' | 'gold' | 'platinum';
    contactEmail?: string;
    contactPhone?: string;
    note?: string;
  }, actorUserId: string): DealerItem {
    if (!body.companyName?.trim()) throw new BadRequestException('companyName 不能为空');
    if (!body.country?.trim()) throw new BadRequestException('country 不能为空');
    const tier = body.tier ?? 'silver';
    if (!TIER_VALUES.includes(tier)) throw new BadRequestException(`tier 必须是 ${TIER_VALUES.join('/')}`);

    const id = 'dlr_' + Math.random().toString(36).slice(2, 12);
    this.db.run(
      `INSERT INTO Dealer (id, companyName, country, tier, contactEmail, contactPhone, status, note, createdByUserId)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
      id, body.companyName.trim(), body.country.trim().toUpperCase(), tier,
      body.contactEmail ?? null, body.contactPhone ?? null,
      body.note ?? null, actorUserId,
    );
    return this.db.get('SELECT * FROM Dealer WHERE id = ?', id) as DealerItem;
  }

  /** 更新经销商 */
  update(id: string, body: Partial<{
    companyName: string; country: string; tier: 'silver' | 'gold' | 'platinum';
    contactEmail: string; contactPhone: string; note: string;
  }>): DealerItem {
    const dealer = this.db.get<{ id: string }>('SELECT id FROM Dealer WHERE id = ?', id);
    if (!dealer) throw new NotFoundException(`dealer ${id} 不存在`);
    const sets: string[] = [];
    const params: any[] = [];
    if (body.companyName !== undefined) { sets.push('companyName = ?'); params.push(body.companyName.trim()); }
    if (body.country !== undefined) { sets.push('country = ?'); params.push(body.country.trim().toUpperCase()); }
    if (body.tier !== undefined) {
      if (!TIER_VALUES.includes(body.tier)) throw new BadRequestException(`tier 必须是 ${TIER_VALUES.join('/')}`);
      sets.push('tier = ?'); params.push(body.tier);
    }
    if (body.contactEmail !== undefined) { sets.push('contactEmail = ?'); params.push(body.contactEmail); }
    if (body.contactPhone !== undefined) { sets.push('contactPhone = ?'); params.push(body.contactPhone); }
    if (body.note !== undefined) { sets.push('note = ?'); params.push(body.note); }
    if (sets.length === 0) return this.db.get('SELECT * FROM Dealer WHERE id = ?', id) as DealerItem;
    sets.push('updatedAt = CURRENT_TIMESTAMP');
    params.push(id);
    this.db.run(`UPDATE Dealer SET ${sets.join(', ')} WHERE id = ?`, ...params);
    return this.db.get('SELECT * FROM Dealer WHERE id = ?', id) as DealerItem;
  }

  /** 暂停(软删)经销商 */
  suspend(id: string): DealerItem {
    const dealer = this.db.get<{ id: string; status: string }>('SELECT id, status FROM Dealer WHERE id = ?', id);
    if (!dealer) throw new NotFoundException(`dealer ${id} 不存在`);
    if (dealer.status === 'suspended') {
      throw new BadRequestException(`dealer ${id} 已处于 suspended 状态`);
    }
    this.db.run(`UPDATE Dealer SET status='suspended', updatedAt=CURRENT_TIMESTAMP WHERE id = ?`, id);
    return this.db.get('SELECT * FROM Dealer WHERE id = ?', id) as DealerItem;
  }

  /** 恢复经销商 */
  activate(id: string): DealerItem {
    const dealer = this.db.get<{ id: string; status: string }>('SELECT id, status FROM Dealer WHERE id = ?', id);
    if (!dealer) throw new NotFoundException(`dealer ${id} 不存在`);
    if (dealer.status === 'active') {
      throw new BadRequestException(`dealer ${id} 已处于 active 状态`);
    }
    this.db.run(`UPDATE Dealer SET status='active', updatedAt=CURRENT_TIMESTAMP WHERE id = ?`, id);
    return this.db.get('SELECT * FROM Dealer WHERE id = ?', id) as DealerItem;
  }

  /** 添加专属价 */
  addPrice(dealerId: string, body: {
    skuId: string; priceCents: number; currency?: string;
    effectiveFrom?: string; effectiveTo?: string;
  }, actorUserId: string): DealerPriceListItem {
    const dealer = this.db.get<{ id: string; status: string }>('SELECT id, status FROM Dealer WHERE id = ?', dealerId);
    if (!dealer) throw new NotFoundException(`dealer ${dealerId} 不存在`);
    if (dealer.status === 'suspended') throw new BadRequestException('已暂停的 dealer 不能添加价格');
    const sku = this.db.get<{ id: string }>('SELECT id FROM Sku WHERE id = ?', body.skuId);
    if (!sku) throw new NotFoundException(`sku ${body.skuId} 不存在`);
    if (!Number.isInteger(body.priceCents) || body.priceCents <= 0) {
      throw new BadRequestException('priceCents 必须为正整数');
    }
    const id = 'dpl_' + Math.random().toString(36).slice(2, 12);
    this.db.run(
      `INSERT INTO DealerPriceList (id, dealerId, skuId, priceCents, currency, effectiveFrom, effectiveTo, createdByUserId)
       VALUES (?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?, ?)`,
      id, dealerId, body.skuId, body.priceCents, body.currency ?? 'BDT',
      body.effectiveFrom ?? null, body.effectiveTo ?? null, actorUserId,
    );
    return this.db.get('SELECT * FROM DealerPriceList WHERE id = ?', id) as DealerPriceListItem;
  }

  /** 删除专属价 */
  removePrice(dealerId: string, priceId: string): { ok: true; id: string } {
    const r = this.db.get<{ id: string; dealerId: string }>(
      'SELECT id, dealerId FROM DealerPriceList WHERE id = ?', priceId);
    if (!r) throw new NotFoundException(`price ${priceId} 不存在`);
    if (r.dealerId !== dealerId) throw new BadRequestException('price 不属于该 dealer');
    this.db.run('DELETE FROM DealerPriceList WHERE id = ?', priceId);
    return { ok: true, id: priceId };
  }
}