// v1.5 #P0-2:配件商城 Service
// - admin CRUD Part(后台商品库)
// - 公开 GET /parts(H5 商城使用)
// - H5/dealer 提交订单 (PartOrder + PartOrderItem,事务)
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../../common/db/db';
import { CreatePartDto, UpdatePartDto, CreatePartOrderDto } from './dto/parts.dto';

function nowId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

@Injectable()
export class PartsService {
  constructor(private readonly db: DbService) {}

  /** H5 / dealer 公共浏览列表 */
  list(opts: { family?: string; q?: string; activeOnly?: boolean } = {}) {
    const where: string[] = [];
    const params: any[] = [];
    if (opts.activeOnly !== false) where.push('active = 1');
    if (opts.family) { where.push('family = ?'); params.push(opts.family); }
    if (opts.q) {
      where.push('(sku LIKE ? OR name LIKE ? OR modelName LIKE ?)');
      const like = `%${opts.q}%`;
      params.push(like, like, like);
    }
    const sql = `SELECT * FROM Part ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY createdAt DESC LIMIT 200`;
    return this.db.all(sql, ...params);
  }

  get(id: string) {
    const p = this.db.get('SELECT * FROM Part WHERE id = ?', id);
    if (!p) throw new NotFoundException(`part ${id} 不存在`);
    return p;
  }

  /** admin 创建 */
  create(body: CreatePartDto, userId: string) {
    const id = nowId('part');
    this.db.run(
      `INSERT INTO Part
       (id, sku, name, modelName, family, capacity, voltage, compatibleSkus, description, imageUrls, priceCents, currency, stock, active, createdByUserId, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      id,
      body.sku,
      body.name,
      body.modelName,
      body.family,
      body.capacity ?? null,
      body.voltage ?? null,
      body.compatibleSkus ? JSON.stringify(body.compatibleSkus) : null,
      body.description ?? null,
      body.imageUrls ? JSON.stringify(body.imageUrls) : null,
      body.priceCents,
      body.currency ?? 'BDT',
      body.stock ?? 0,
      userId,
    );
    return this.get(id);
  }

  update(id: string, body: UpdatePartDto) {
    const exists = this.db.get('SELECT id FROM Part WHERE id = ?', id);
    if (!exists) throw new NotFoundException(`part ${id} 不存在`);
    const set: string[] = [];
    const params: any[] = [];
    const fields = ['name', 'modelName', 'family', 'capacity', 'voltage', 'description'];
    for (const k of fields) {
      if ((body as Record<string, unknown>)[k] !== undefined) {
        set.push(`${k} = ?`);
        params.push((body as Record<string, unknown>)[k]);
      }
    }
    if (body.compatibleSkus !== undefined) {
      set.push('compatibleSkus = ?');
      params.push(JSON.stringify(body.compatibleSkus));
    }
    if (body.imageUrls !== undefined) {
      set.push('imageUrls = ?');
      params.push(JSON.stringify(body.imageUrls));
    }
    for (const k of ['priceCents', 'currency', 'stock', 'active'] as const) {
      if ((body as Record<string, unknown>)[k] !== undefined) {
        set.push(`${k} = ?`);
        params.push((body as Record<string, unknown>)[k]);
      }
    }
    if (set.length === 0) return this.get(id);
    set.push('updatedAt = CURRENT_TIMESTAMP');
    this.db.run(`UPDATE Part SET ${set.join(', ')} WHERE id = ?`, ...params, id);
    return this.get(id);
  }

  remove(id: string) {
    // 软下架(置 active=0),保留历史订单可追溯
    this.db.run('UPDATE Part SET active = 0, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', id);
    return { ok: true, id };
  }

  /**
   * H5 / dealer 提交订单 — 事务包裹:
   * 1. 校验每个 partId 存在 + active=1
   * 2. 库存校验(stock 暂只校验不扣减,演示期简化)
   * 3. 写 PartOrder 总单 + 多条 PartOrderItem
   * 4. 同步扣减库存(生产期可挪到出货后扣减更安全)
   */
  createOrder(body: CreatePartOrderDto, userId: string) {
    if (!body.items || body.items.length === 0) {
      throw new BadRequestException('items 不能为空');
    }
    const lines: Array<{ partId: string; sku: string; name: string; priceCents: number; currency: string; quantity: number }> = [];
    let total = 0;
    // v1.5 #H2 修复:订单币种一致性校验 — 第一行锁定 currency,后续不一致立即 400
    // 避免循环内 `currency = p.currency` 反复覆盖导致 totalCents 用错币种
    let orderCurrency: string | null = null;
    this.db.run('BEGIN');
    try {
      for (const it of body.items) {
        const p = this.db.get<{ id: string; sku: string; name: string; priceCents: number; currency: string; active: number; stock: number }>(
          'SELECT id, sku, name, priceCents, currency, active, stock FROM Part WHERE id = ?',
          it.partId,
        );
        if (!p) {
          throw new BadRequestException(`part ${it.partId} 不存在`);
        }
        if (p.active !== 1) {
          throw new BadRequestException(`part ${p.sku} 已下架`);
        }
        if (p.stock < it.quantity) {
          throw new BadRequestException(`part ${p.sku} 库存不足(剩 ${p.stock},要 ${it.quantity})`);
        }
        if (orderCurrency === null) {
          orderCurrency = p.currency;
        } else if (orderCurrency !== p.currency) {
          throw new BadRequestException(
            `订单币种不一致:已锁定 ${orderCurrency},part ${p.sku} 为 ${p.currency}(同一订单只允许一种币种)`,
          );
        }
        lines.push({
          partId: p.id,
          sku: p.sku,
          name: p.name,
          priceCents: p.priceCents,
          currency: p.currency,
          quantity: it.quantity,
        });
        total += p.priceCents * it.quantity;
      }
      // orderCurrency 在循环里必被赋值(items.length >= 1 已被上面 if 守卫);tsc 仍需 null check
      const finalCurrency = orderCurrency ?? 'BDT';
      const orderId = nowId('por');
      this.db.run(
        `INSERT INTO PartOrder
         (id, userId, status, totalCents, currency, contactPhone, shipName, shipCountry, shipCity, shipAddress, note, source, createdAt, updatedAt)
         VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        orderId,
        userId,
        total,
        finalCurrency,
        body.contactPhone ?? null,
        body.shipName ?? null,
        body.shipCountry ?? null,
        body.shipCity ?? null,
        body.shipAddress ?? null,
        body.note ?? null,
        body.source ?? 'h5',
      );
      for (const it of lines) {
        this.db.run(
          `INSERT INTO PartOrderItem (id, orderId, partId, sku, name, priceCents, currency, quantity, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          nowId('poi'),
          orderId,
          it.partId,
          it.sku,
          it.name,
          it.priceCents,
          it.currency,
          it.quantity,
        );
        this.db.run('UPDATE Part SET stock = stock - ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', it.quantity, it.partId);
      }
      this.db.run('COMMIT');
      return { ok: true, order: this.getOrder(orderId) };
    } catch (e) {
      this.db.run('ROLLBACK');
      throw e;
    }
  }

  getOrder(id: string) {
    const order = this.db.get('SELECT * FROM PartOrder WHERE id = ?', id);
    if (!order) throw new NotFoundException(`order ${id} 不存在`);
    const items = this.db.all('SELECT * FROM PartOrderItem WHERE orderId = ?', id);
    return { ...order, items };
  }

  listMyOrders(userId: string) {
    return this.db.all('SELECT * FROM PartOrder WHERE userId = ? ORDER BY createdAt DESC', userId);
  }

  /** admin 视角:全部订单 + 状态流转 */
  listAllOrders(opts: { status?: string; page?: number; pageSize?: number } = {}) {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, opts.pageSize ?? 20);
    const offset = (page - 1) * pageSize;
    const where: string[] = [];
    const params: any[] = [];
    if (opts.status) { where.push('status = ?'); params.push(opts.status); }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const total = this.db.get<{ c: number }>(`SELECT COUNT(*) AS c FROM PartOrder ${whereSql}`, ...params)?.c ?? 0;
    const items = this.db.all(
      `SELECT * FROM PartOrder ${whereSql} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
      ...params, pageSize, offset,
    );
    return { items, total, page, pageSize };
  }

  updateOrderStatus(id: string, status: 'paid' | 'shipped' | 'completed' | 'cancelled') {
    const o = this.db.get('SELECT id, status FROM PartOrder WHERE id = ?', id);
    if (!o) throw new NotFoundException(`order ${id} 不存在`);
    const nowField = status === 'paid' ? 'paidAt' : status === 'shipped' ? 'shippedAt' : status === 'completed' ? 'completedAt' : 'cancelledAt';
    this.db.run(
      `UPDATE PartOrder SET status = ?, ${nowField} = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
      status, id,
    );
    return this.getOrder(id);
  }
}
