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
      this.writeReviewLog(id, actorUserId, fromStatus, status, notes);
    }

    return this.db.get('SELECT * FROM Warranty WHERE id = ?', id);
  }

  /**
   * P0-6 v1.2 增量:批量审核（admin 批量操作场景，如批量拒绝伪造批次）
   * - 逐条复用 reviewWarranty 写入逻辑,保持审计/状态机一致
   * - 任一条失败抛出 BadRequest,事务已写入行不回滚(演示期 sqlite 简化),调用方按失败列表重试
   * - 返回值含 succeeded/failed 两条,便于前端展示
   */
  async bulkReviewWarranties(
    ids: string[],
    status: 'active' | 'pending' | 'expired' | 'rejected',
    notes: string | undefined,
    actorUserId: string,
  ): Promise<{ succeeded: Array<{ id: string; status: string }>; failed: Array<{ id: string; reason: string }>; total: number }> {
    const succeeded: Array<{ id: string; status: string }> = [];
    const failed: Array<{ id: string; reason: string }> = [];
    for (const id of ids) {
      try {
        const w = this.db.get<{ id: string; status: string; reviewNotes: string | null }>(
          'SELECT id, status, reviewNotes FROM Warranty WHERE id = ?', id);
        if (!w) {
          failed.push({ id, reason: 'warranty 不存在' });
          continue;
        }
        const fromStatus = w.status;
        this.db.run('UPDATE Warranty SET status = ?, reviewNotes = ? WHERE id = ?', status, notes ?? w.reviewNotes, id);
        if (fromStatus !== status) this.writeReviewLog(id, actorUserId, fromStatus, status, notes);
        succeeded.push({ id, status });
      } catch (e) {
        failed.push({ id, reason: (e as Error).message ?? 'unknown' });
      }
    }
    return { succeeded, failed, total: ids.length };
  }

  /** 写 WarrantyReviewLog（reviewWarranty/bulkReviewWarranties 共用） */
  private writeReviewLog(warrantyId: string, actorUserId: string, fromStatus: string, toStatus: string, notes?: string) {
    const logId = `wrl-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    this.db.run(
      `INSERT INTO WarrantyReviewLog (id, warrantyId, actorUserId, fromStatus, toStatus, notes, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      logId, warrantyId, actorUserId, fromStatus, toStatus, notes ?? null,
    );
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

  /** 单用户详情（含近 N 条保修） */
  async getUserDetail(id: string) {
    const user = this.db.get(
      `SELECT id, phone, email, role, displayName, createdAt FROM User WHERE id = ?`, id);
    if (!user) throw new NotFoundException(`user ${id} 不存在`);
    const warrantyCount = this.db.get<{ c: number }>(
      'SELECT COUNT(*) AS c FROM Warranty WHERE userId = ?', id)?.c ?? 0;
    const warranties = this.db.all(
      `SELECT w.id, w.skuId, w.status, w.country, w.createdAt, w.reviewNotes,
              s.sku AS s_sku, s.modelName AS s_modelName, s.serial AS s_serial
       FROM Warranty w JOIN Sku s ON w.skuId = s.id
       WHERE w.userId = ? ORDER BY w.createdAt DESC LIMIT 20`, id);
    return { ...user, warrantyCount, warranties };
  }

  /** 单保修详情（含审计轨迹） */
  async getWarrantyDetail(id: string) {
    const w = this.db.get(
      `SELECT w.*, u.phone AS user_phone, u.displayName AS user_displayName,
              s.sku AS s_sku, s.modelName AS s_modelName, s.serial AS s_serial
       FROM Warranty w
       JOIN User u ON w.userId = u.id
       JOIN Sku s ON w.skuId = s.id
       WHERE w.id = ?`, id);
    if (!w) throw new NotFoundException(`warranty ${id} 不存在`);
    const logs = this.db.all<{ id: string; actorUserId: string; fromStatus: string; toStatus: string; notes: string | null; createdAt: string }>(
      `SELECT id, actorUserId, fromStatus, toStatus, notes, createdAt
       FROM WarrantyReviewLog WHERE warrantyId = ? ORDER BY createdAt DESC LIMIT 20`, id);
    const auditLogs = logs.map((l) => ({
      at: l.createdAt,
      by: l.actorUserId,
      action: `${l.fromStatus} → ${l.toStatus}`,
      notes: l.notes ?? undefined,
    }));
    return { ...w, auditLogs };
  }

  /** 更新用户角色（admin 专用） */
  async updateUserRole(id: string, role: 'admin' | 'dealer' | 'customer') {
    const u = this.db.get<{ id: string }>('SELECT id FROM User WHERE id = ?', id);
    if (!u) throw new NotFoundException(`user ${id} 不存在`);
    this.db.run('UPDATE User SET role = ? WHERE id = ?', role, id);
    return this.db.get(
      `SELECT id, phone, email, role, displayName, createdAt FROM User WHERE id = ?`, id);
  }
}