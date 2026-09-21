import { Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../../common/db/db';

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class AdminService {
  constructor(private readonly db: DbService) {}

  /** SKU 列表（带搜索 + 分页） */
  async listSkus(opts: { q?: string; page?: number; pageSize?: number } = {}): Promise<PageResult<any>> {
    return this.paginated('SELECT * FROM Sku', opts, ['sku', 'modelName', 'serial', 'batch']);
  }

  /** 保修列表 */
  async listWarranties(opts: { q?: string; page?: number; pageSize?: number; status?: string } = {}): Promise<PageResult<any>> {
    return this.paginated(
      `SELECT w.*, u.phone AS user_phone, u.displayName AS user_displayName,
              s.sku AS s_sku, s.modelName AS s_modelName, s.serial AS s_serial
       FROM Warranty w
       JOIN User u ON w.userId = u.id
       JOIN Sku s ON w.skuId = s.id`,
      { ...opts, extraWhere: opts.status ? 'w.status = ?' : undefined, extraParams: opts.status ? [opts.status] : [] },
      ['s_sku', 's_serial', 'user_phone', 'user_displayName'],
      'w.createdAt DESC',
    );
  }

  /** 设备列表 */
  async listDevices(opts: { q?: string; page?: number; pageSize?: number } = {}): Promise<PageResult<any>> {
    return this.paginated(
      `SELECT d.*, u.phone AS user_phone,
              s.sku AS s_sku, s.modelName AS s_modelName, s.serial AS s_serial
       FROM Device d
       JOIN User u ON d.userId = u.id
       JOIN Sku s ON d.skuId = s.id`,
      opts,
      ['s_sku', 's_serial', 'user_phone'],
      'd.boundAt DESC',
    );
  }

  /** 用户列表 */
  async listUsers(opts: { q?: string; page?: number; pageSize?: number; role?: string } = {}): Promise<PageResult<any>> {
    return this.paginated(
      `SELECT u.id, u.phone, u.email, u.role, u.displayName, u.createdAt,
              (SELECT COUNT(*) FROM Warranty w WHERE w.userId = u.id) AS warrantyCount,
              (SELECT COUNT(*) FROM Device d WHERE d.userId = u.id) AS deviceCount
       FROM User u`,
      { ...opts, extraWhere: opts.role ? 'u.role = ?' : undefined, extraParams: opts.role ? [opts.role] : [] },
      ['phone', 'email', 'displayName', 'id'],
      'u.createdAt ASC',
    );
  }

  /**
   * 通用分页 + 搜索
   * @param baseSql    SELECT 子句 + FROM（含 JOIN）
   * @param opts       q / page / pageSize / extraWhere / extraParams
   * @param searchCols LIKE 搜索的列名
   * @param orderBy    排序
   */
  private paginated(
    baseSql: string,
    opts: { q?: string; page?: number; pageSize?: number; extraWhere?: string; extraParams?: any[] },
    searchCols: string[],
    orderBy = 'createdAt DESC',
  ): PageResult<any> {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
    const offset = (page - 1) * pageSize;
    const q = opts.q?.trim() ?? '';

    const where: string[] = [];
    const params: any[] = [];
    if (q) {
      const like = `%${q}%`;
      where.push('(' + searchCols.map((c) => `${c} LIKE ?`).join(' OR ') + ')');
      params.push(...searchCols.map(() => like));
    }
    if (opts.extraWhere) {
      where.push(`(${opts.extraWhere})`);
      params.push(...(opts.extraParams ?? []));
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const totalRow = this.db.get<{ c: number }>(
      `SELECT COUNT(*) AS c FROM (${baseSql}) ${whereSql}`,
      ...params,
    );
    const total = totalRow?.c ?? 0;

    const items = this.db.all(
      `${baseSql} ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      ...params, pageSize, offset,
    );

    return { items, total, page, pageSize };
  }

  async reviewWarranty(id: string, status: 'active' | 'pending' | 'expired' | 'rejected', notes?: string, actorUserId?: string) {
    const w = this.db.get<{ id: string; status: string; reviewNotes: string | null }>(
      'SELECT id, status, reviewNotes FROM Warranty WHERE id = ?', id);
    if (!w) throw new NotFoundException(`warranty ${id} 不存在`);
    const fromStatus = w.status;
    this.db.run('UPDATE Warranty SET status = ?, reviewNotes = ? WHERE id = ?', status, notes ?? w.reviewNotes, id);

    // v1.1 audit: 写 WarrantyReviewLog
    if (actorUserId && fromStatus !== status) {
      const logId = `wrl-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      this.db.run(
        `INSERT INTO WarrantyReviewLog (id, warrantyId, actorUserId, fromStatus, toStatus, notes, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        logId, id, actorUserId, fromStatus, status, notes ?? null,
      );
    }

    return this.db.get('SELECT * FROM Warranty WHERE id = ?', id);
  }

  /**
   * 趋势分析（最近 N 天）
   * @param days 默认 30
   */
  async trends(days = 30) {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);

    const warrantyRows = this.db.all<{ day: string; c: number }>(
      `SELECT substr(createdAt, 1, 10) AS day, COUNT(*) AS c
       FROM Warranty WHERE createdAt >= ?
       GROUP BY substr(createdAt, 1, 10) ORDER BY day`,
      start.toISOString(),
    );
    const deviceRows = this.db.all<{ day: string; c: number }>(
      `SELECT substr(boundAt, 1, 10) AS day, COUNT(*) AS c
       FROM Device WHERE boundAt >= ?
       GROUP BY substr(boundAt, 1, 10) ORDER BY day`,
      start.toISOString(),
    );
    const ticketRows = this.db.all<{ day: string; c: number }>(
      `SELECT substr(createdAt, 1, 10) AS day, COUNT(*) AS c
       FROM Ticket WHERE createdAt >= ?
       GROUP BY substr(createdAt, 1, 10) ORDER BY day`,
      start.toISOString(),
    );

    // 补齐缺失日期（让图表连续）
    const fillDays = (rows: { day: string; c: number }[]) => {
      const map = new Map(rows.map((r) => [r.day, r.c]));
      const out: { day: string; c: number }[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const k = d.toISOString().slice(0, 10);
        out.push({ day: k, c: map.get(k) ?? 0 });
      }
      return out;
    };

    return {
      days,
      warranty: fillDays(warrantyRows),
      device: fillDays(deviceRows),
      ticket: fillDays(ticketRows),
    };
  }

  /**
   * 维度分布
   * @param type warranty | device | ticket
   * @param groupBy sku | country | severity | role
   */
  async breakdown(type: 'warranty' | 'device' | 'ticket', groupBy: 'sku' | 'country' | 'severity' | 'role') {
    if (type === 'warranty') {
      if (groupBy === 'sku') {
        return this.db.all<{ key: string; c: number }>(
          `SELECT s.sku AS key, COUNT(*) AS c FROM Warranty w
           JOIN Sku s ON w.skuId = s.id GROUP BY s.sku ORDER BY c DESC LIMIT 20`,
        );
      }
      return this.db.all<{ key: string; c: number }>(
        `SELECT country AS key, COUNT(*) AS c FROM Warranty GROUP BY country ORDER BY c DESC`,
      );
    }
    if (type === 'device') {
      if (groupBy === 'sku') {
        return this.db.all<{ key: string; c: number }>(
          `SELECT s.sku AS key, COUNT(*) AS c FROM Device d
           JOIN Sku s ON d.skuId = s.id GROUP BY s.sku ORDER BY c DESC LIMIT 20`,
        );
      }
      return this.db.all<{ key: string; c: number }>(
        `SELECT role AS key, COUNT(*) AS c FROM User GROUP BY role ORDER BY c DESC`,
      );
    }
    // ticket
    if (groupBy === 'severity') {
      return this.db.all<{ key: string; c: number }>(
        `SELECT severity AS key, COUNT(*) AS c FROM Ticket GROUP BY severity ORDER BY c DESC`,
      );
    }
    return this.db.all<{ key: string; c: number }>(
      `SELECT status AS key, COUNT(*) AS c FROM Ticket GROUP BY status ORDER BY c DESC`,
    );
  }

  /** 平台概览 */
  async overview() {
    const skuTotal = this.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM Sku')?.c ?? 0;
    const skuActivated = this.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM Sku WHERE activated = 1')?.c ?? 0;
    const userTotal = this.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM User')?.c ?? 0;
    const userDealer = this.db.get<{ c: number }>("SELECT COUNT(*) AS c FROM User WHERE role = 'dealer'")?.c ?? 0;
    const warrantyActive = this.db.get<{ c: number }>("SELECT COUNT(*) AS c FROM Warranty WHERE status = 'active'")?.c ?? 0;
    const deviceTotal = this.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM Device')?.c ?? 0;
    const ticketOpen = this.db.get<{ c: number }>("SELECT COUNT(*) AS c FROM Ticket WHERE status IN ('open','in_progress','waiting_customer')")?.c ?? 0;
    const ticketUrgent = this.db.get<{ c: number }>("SELECT COUNT(*) AS c FROM Ticket WHERE severity IN ('high','urgent') AND status NOT IN ('resolved','closed')")?.c ?? 0;

    const firstOfMonth = new Date();
    firstOfMonth.setDate(1); firstOfMonth.setHours(0,0,0,0);
    const warrantyThisMonth = this.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM Warranty WHERE createdAt >= ?', firstOfMonth.toISOString())?.c ?? 0;
    const deviceThisMonth = this.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM Device WHERE boundAt >= ?', firstOfMonth.toISOString())?.c ?? 0;
    const ticketThisMonth = this.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM Ticket WHERE createdAt >= ?', firstOfMonth.toISOString())?.c ?? 0;

    return {
      sku: { total: skuTotal, activated: skuActivated },
      user: { total: userTotal, dealer: userDealer },
      warranty: { active: warrantyActive, activeThisMonth: warrantyThisMonth },
      device: { total: deviceTotal, boundThisMonth: deviceThisMonth },
      ticket: { open: ticketOpen, urgent: ticketUrgent, newThisMonth: ticketThisMonth },
    };
  }
}