import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
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

  /** 保修列表 — v1.5 #P1-5:增加 dealerId 过滤 */
  async listWarranties(opts: { q?: string; page?: number; pageSize?: number; status?: string; dealerId?: string } = {}): Promise<PageResult<any>> {
    const extraWhere: string[] = [];
    const extraParams: any[] = [];
    if (opts.status) { extraWhere.push('w.status = ?'); extraParams.push(opts.status); }
    if (opts.dealerId) { extraWhere.push('w.dealerId = ?'); extraParams.push(opts.dealerId); }
    return this.paginated(
      `SELECT w.*, u.phone AS user_phone, u.displayName AS user_displayName,
              s.sku AS s_sku, s.modelName AS s_modelName, s.serial AS s_serial,
              (SELECT companyName FROM Dealer d WHERE d.id = w.dealerId) AS dealer_companyName
       FROM Warranty w
       JOIN User u ON w.userId = u.id
       JOIN Sku s ON w.skuId = s.id`,
      {
        ...opts,
        extraWhere: extraWhere.length ? extraWhere.join(' AND ') : undefined,
        extraParams,
      },
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

  /** 用户列表（隐藏 GDPR 已删除的用户） */
  async listUsers(opts: { q?: string; page?: number; pageSize?: number; role?: string } = {}): Promise<PageResult<any>> {
    return this.paginated(
      `SELECT u.id, u.phone, u.email, u.role, u.displayName, u.createdAt, u.deletedAt,
              (SELECT COUNT(*) FROM Warranty w WHERE w.userId = u.id) AS warrantyCount,
              (SELECT COUNT(*) FROM Device d WHERE d.userId = u.id) AS deviceCount
       FROM User u`,
      {
        ...opts,
        extraWhere: [
          'u.deletedAt IS NULL',
          opts.role ? 'u.role = ?' : null,
        ].filter(Boolean).join(' AND ') || undefined,
        extraParams: opts.role ? [opts.role] : [],
      },
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

    // P1-1 v1.4:COUNT 用独立子查询内嵌 WHERE(避免 subquery 别名在外层不可见)
    // 把 extraWhere 内嵌到 inner SELECT 的 FROM/WHERE,搜索 LIKE 同样内嵌
    const innerWhere: string[] = [];
    if (q) {
      const like = `%${q}%`;
      innerWhere.push('(' + searchCols.map((c) => `${c} LIKE ?`).join(' OR ') + ')');
    }
    if (opts.extraWhere) innerWhere.push(opts.extraWhere);
    const innerWhereSql = innerWhere.length ? `WHERE ${innerWhere.join(' AND ')}` : '';
    const totalRow = this.db.get<{ c: number }>(
      `SELECT COUNT(*) AS c FROM (${baseSql} ${innerWhereSql})`,
      ...(q ? searchCols.map(() => `%${q}%`) : []),
      ...(opts.extraParams ?? []),
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
   * #P1-4 v1.5 增量:批量审核支持逐条 notes
   * - 旧调用传 string[] (从 controller 呼入 ids 转过来)
   * - 新调用传 Array<{ id, status?, notes? }>,可逐条覆盖 status + notes
   *   ↑ 某条 status/notes 缺失时 fallback 到顶层的 fallbackStatus / fallbackNotes
   * - 逐条复用 reviewWarranty 写入逻辑,保持审计/状态机一致
   */
  async bulkReviewWarranties(
    itemsOrIds: string[] | Array<{ id: string; status?: 'active' | 'pending' | 'expired' | 'rejected'; notes?: string }>,
    fallbackStatus: 'active' | 'pending' | 'expired' | 'rejected' | undefined,
    fallbackNotes: string | undefined,
    actorUserId: string,
  ): Promise<{ succeeded: Array<{ id: string; status: string }>; failed: Array<{ id: string; reason: string }>; total: number }> {
    const list: Array<{ id: string; status?: 'active' | 'pending' | 'expired' | 'rejected'; notes?: string }> =
      typeof itemsOrIds[0] === 'string'
        ? (itemsOrIds as string[]).map((id) => ({ id }))
        : (itemsOrIds as Array<{ id: string; status?: 'active' | 'pending' | 'expired' | 'rejected'; notes?: string }>);

    const succeeded: Array<{ id: string; status: string }> = [];
    const failed: Array<{ id: string; reason: string }> = [];
    for (const item of list) {
      const id = item.id;
      const status = item.status ?? fallbackStatus;
      const notes = item.notes ?? fallbackNotes;
      if (!status) {
        failed.push({ id, reason: '缺少 status(未提供顶层 status,逐条也未提供)' });
        continue;
      }
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
    return { succeeded, failed, total: list.length };
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

  /** 平台概览 — v1.5 扩展按缺陷修复报告(P0-5/P1-3/P2-2/P2-3) 拉宽 KPI */
  async overview() {
    const skuTotal = this.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM Sku')?.c ?? 0;
    const skuActivated = this.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM Sku WHERE activated = 1')?.c ?? 0;
    const userTotal = this.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM User WHERE deletedAt IS NULL')?.c ?? 0;
    const userDealer = this.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM User WHERE role = ? AND deletedAt IS NULL', 'dealer')?.c ?? 0;
    const userCustomer = this.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM User WHERE role = ? AND deletedAt IS NULL', 'customer')?.c ?? 0;
    const userSuspended = this.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM User WHERE isActive = 0 AND deletedAt IS NULL')?.c ?? 0;
    const warrantyActive = this.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM Warranty WHERE status = ?', 'active')?.c ?? 0;
    const warrantyPending = this.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM Warranty WHERE status = ?', 'pending')?.c ?? 0;
    const deviceTotal = this.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM Device')?.c ?? 0;
    const deviceOffline = this.db.get<{ c: number }>(
      "SELECT COUNT(*) AS c FROM Device WHERE (julianday('now') - julianday(lastSeenAt)) * 24 >= 7",
    )?.c ?? 0;
    const ticketOpen = this.db.get<{ c: number }>("SELECT COUNT(*) AS c FROM Ticket WHERE status IN ('open','in_progress','waiting_customer')")?.c ?? 0;
    const ticketUrgent = this.db.get<{ c: number }>("SELECT COUNT(*) AS c FROM Ticket WHERE severity IN ('high','urgent') AND status NOT IN ('resolved','closed')")?.c ?? 0;

    const firstOfMonth = new Date();
    firstOfMonth.setDate(1); firstOfMonth.setHours(0,0,0,0);
    const isoFirst = firstOfMonth.toISOString();
    const warrantyThisMonth = this.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM Warranty WHERE createdAt >= ?', isoFirst)?.c ?? 0;
    const deviceThisMonth = this.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM Device WHERE boundAt >= ?', isoFirst)?.c ?? 0;
    const ticketThisMonth = this.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM Ticket WHERE createdAt >= ?', isoFirst)?.c ?? 0;

    // 本月到期 + 超过 7 天的质保
    const monthEnd = new Date(firstOfMonth);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    const expiredThisMonth = this.db.get<{ c: number }>(
      'SELECT COUNT(*) AS c FROM Warranty WHERE endAtWhole >= ? AND endAtWhole < ? AND status = ?',
      isoFirst, monthEnd.toISOString(), 'active',
    )?.c ?? 0;
    const expiredThisMonthOver7d = this.db.get<{ c: number }>(
      "SELECT COUNT(*) AS c FROM Warranty WHERE endAtWhole < ? AND status = ? AND (julianday('now') - julianday(endAtWhole)) * 24 >= 24 * 7",
      isoFirst, 'active',
    )?.c ?? 0;

    // 工单 byType / bySource
    const ticketByTypeRows = this.db.all<{ type: string; c: number }>(
      "SELECT type, COUNT(*) AS c FROM Ticket GROUP BY type",
    ) ?? [];
    const ticketByType: Record<string, number> = { general: 0, warranty: 0, inquiry: 0, remote: 0 };
    for (const r of ticketByTypeRows) ticketByType[r.type] = r.c;

    const ticketBySourceRows = this.db.all<{ source: string | null; c: number }>(
      "SELECT source, COUNT(*) AS c FROM Ticket GROUP BY source",
    ) ?? [];
    const ticketBySource: Record<string, number> = { web: 0, h5: 0, dealer: 0, system: 0 };
    for (const r of ticketBySourceRows) ticketBySource[r.source ?? 'unknown'] = r.c;

    return {
      sku: { total: skuTotal, activated: skuActivated },
      user: { total: userTotal, dealer: userDealer, customer: userCustomer, suspended: userSuspended },
      warranty: {
        active: warrantyActive,
        activeThisMonth: warrantyThisMonth,
        expiredThisMonth,
        pending: warrantyPending,
        expiredThisMonthOver7d,
      },
      device: { total: deviceTotal, boundThisMonth: deviceThisMonth, offline: deviceOffline },
      ticket: {
        open: ticketOpen,
        urgent: ticketUrgent,
        newThisMonth: ticketThisMonth,
        byType: ticketByType as any,
        bySource: ticketBySource as any,
      },
    };
  }

  /** 单用户详情（含近 N 条保修） — GDPR 已删除用户返回 404 */
  async getUserDetail(id: string) {
    const user = this.db.get(
      // v1.5 #P1-3:加 isActive / suspendedAt / suspendedReason 返回,便于前端显示状态 chip
      `SELECT id, phone, email, role, displayName, createdAt, deletedAt,
              isActive, suspendedAt, suspendedReason
       FROM User WHERE id = ? AND deletedAt IS NULL`, id);
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

  /** 更新用户角色（admin 专用）— 不允许修改已 GDPR 删除的用户 */
  async updateUserRole(id: string, role: 'admin' | 'dealer' | 'customer') {
    const u = this.db.get<{ id: string; deletedAt: string | null }>('SELECT id, deletedAt FROM User WHERE id = ?', id);
    if (!u) throw new NotFoundException(`user ${id} 不存在`);
    if (u.deletedAt) throw new ConflictException(`user ${id} 已被 GDPR 删除,不可修改`);
    this.db.run('UPDATE User SET role = ? WHERE id = ?', role, id);
    return this.db.get(
      `SELECT id, phone, email, role, displayName, createdAt FROM User WHERE id = ?`, id);
  }

  /**
   * P1-1 v1.4 GDPR 软删:DELETE /admin/users/:id
   * - 不能物理删(Warranty/Device/Ticket/Session 等 FK 全部关联,破坏审计完整性)
   * - 软删 + 匿名化:phone/email/passwordHash/displayName 置 NULL,role='anonymous',deletedAt=now
   * - 脱敏备份:phone/email 哈希保存到 anonymizedPhone/anonymizedEmail,供审计追溯
   * - Session 一次性清空(避免持有已删除用户 token)
   * - AuditLog 写一行 user.gdpr_delete
   * - 限制:
   *   ① 不能删自己(actor === target) → 409
   *   ② 不能删最后一个 admin(剩余 admin 数 = 1 且 target 是 admin) → 409
   *   ③ 已删除的不能再删(幂等保护)
   */
  async gdprDeleteUser(id: string, actorUserId: string) {
    const target = this.db.get<{
      id: string;
      role: string;
      phone: string | null;
      email: string | null;
      deletedAt: string | null;
    }>(
      'SELECT id, role, phone, email, deletedAt FROM User WHERE id = ?',
      id,
    );
    if (!target) throw new NotFoundException(`user ${id} 不存在`);
    if (target.deletedAt) throw new ConflictException(`user ${id} 已被删除,无需重复操作`);

    // 最后一个 admin 检查:若是 admin 且总 admin 数 ≤ 1,拒绝
    //   优先于自删检查:即使你想"辞职"也必须先交接给另一个 admin
    if (target.role === 'admin') {
      const adminCount = this.db.get<{ c: number }>(
        "SELECT COUNT(*) AS c FROM User WHERE role = 'admin' AND deletedAt IS NULL",
      )?.c ?? 0;
      if (adminCount <= 1) {
        throw new ConflictException('不能删除最后一个管理员');
      }
    }

    if (actorUserId === id) {
      throw new ConflictException('不能删除当前登录账号');
    }

    // SHA256 哈希(用于审计追溯,不暴露明文)
    const phoneHash = target.phone
      ? crypto.createHash('sha256').update(target.phone).digest('hex')
      : null;
    const emailHash = target.email
      ? crypto.createHash('sha256').update(target.email.toLowerCase()).digest('hex')
      : null;

    // 一次性事务:匿名化 + 清 Session + 写 AuditLog
    this.db.run('BEGIN');
    try {
      this.db.run(
        `UPDATE User
         SET phone = NULL,
             email = NULL,
             passwordHash = NULL,
             displayName = NULL,
             role = 'anonymous',
             isActive = 0,
             anonymizedPhone = ?,
             anonymizedEmail = ?,
             deletedAt = CURRENT_TIMESTAMP
         WHERE id = ?`,
        phoneHash,
        emailHash,
        id,
      );
      // 清 Session(token 不可继续使用)
      this.db.run('DELETE FROM Session WHERE userId = ?', id);
      // AuditLog
      const auditId = 'aud-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
      this.db.run(
        `INSERT INTO AuditLog (id, actorUserId, actorRole, action, resource, payload, createdAt)
         VALUES (?, ?, 'admin', 'user.gdpr_delete', ?, ?, CURRENT_TIMESTAMP)`,
        auditId,
        actorUserId,
        `user:${id}`,
        JSON.stringify({ anonymizedPhone: phoneHash, anonymizedEmail: emailHash }),
      );
      this.db.run('COMMIT');
    } catch (e) {
      this.db.run('ROLLBACK');
      throw e;
    }

    return {
      ok: true,
      id,
      deletedAt: new Date().toISOString(),
      anonymizedPhone: phoneHash,
      anonymizedEmail: emailHash,
    };
  }

  /**
   * v1.5 #P1-3:用户 Suspension — admin 可临时停用违规用户
   * - isActive=0 → JwtStrategy 拒绝该用户后续任何请求
   * - suspend/unsuspend 都写 AuditLog(suspension 状态带原因)
   * - 限制:不能停用自己(避免误锁)
   */
  async suspendUser(id: string, reason: string, actorUserId: string) {
    if (actorUserId === id) {
      throw new ForbiddenException('不能停用当前登录账号');
    }
    const target = this.db.get<{ id: string; isActive: number; deletedAt: string | null }>(
      'SELECT id, isActive, deletedAt FROM User WHERE id = ?', id);
    if (!target) throw new NotFoundException(`user ${id} 不存在`);
    if (target.deletedAt) throw new ConflictException('用户已被 GDPR 删除,无法调整状态');
    if (target.isActive === 0) {
      return { ok: true, user: this.db.get('SELECT id, phone, email, role, displayName, isActive FROM User WHERE id = ?', id), alreadySuspended: true };
    }
    this.db.run(
      'UPDATE User SET isActive = 0, suspendedAt = CURRENT_TIMESTAMP, suspendedReason = ? WHERE id = ?',
      reason ?? null, id,
    );
    this.db.run(
      `INSERT INTO AuditLog (id, actorUserId, actorRole, action, resource, payload, createdAt)
       VALUES (?, ?, 'admin', 'user.suspend', ?, ?, CURRENT_TIMESTAMP)`,
      'aud-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      actorUserId,
      `user:${id}`,
      JSON.stringify({ reason: reason ?? null }),
    );
    return {
      ok: true,
      user: this.db.get('SELECT id, phone, email, role, displayName, isActive, suspendedAt, suspendedReason FROM User WHERE id = ?', id),
    };
  }

  async unsuspendUser(id: string, actorUserId: string) {
    const target = this.db.get<{ id: string; isActive: number; deletedAt: string | null }>(
      'SELECT id, isActive, deletedAt FROM User WHERE id = ?', id);
    if (!target) throw new NotFoundException(`user ${id} 不存在`);
    if (target.deletedAt) throw new ConflictException('用户已被 GDPR 删除,无法调整状态');
    if (target.isActive === 1) {
      return { ok: true, user: this.db.get('SELECT id, phone, email, role, displayName, isActive FROM User WHERE id = ?', id) };
    }
    this.db.run(
      'UPDATE User SET isActive = 1, suspendedAt = NULL, suspendedReason = NULL WHERE id = ?', id,
    );
    this.db.run(
      `INSERT INTO AuditLog (id, actorUserId, actorRole, action, resource, payload, createdAt)
       VALUES (?, ?, 'admin', 'user.unsuspend', ?, ?, CURRENT_TIMESTAMP)`,
      'aud-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      actorUserId,
      `user:${id}`,
      null,
    );
    return {
      ok: true,
      user: this.db.get('SELECT id, phone, email, role, displayName, isActive, suspendedAt, suspendedReason FROM User WHERE id = ?', id),
    };
  }

  /**
   * v1.5 #P2-1:工单审计轨迹 — GET /admin/audit/ticket/:id
   * - AuditLog:资源型动作(create/reply/update/review 等)
   * - TicketStatusLog:状态/严重度变更历史(包含 SLA 自动升级记录)
   *   注意:TicketStatusLog 表本身只有 status 列,SLA 升级将旧 severity 写入 fromStatus / 新 severity 写入 toStatus
   *   我们在返回前加 isSlaEscalation 标志帮前端区分展示
   */
  async getTicketAuditTrail(id: string) {
    const ticket = this.db.get<{ id: string }>('SELECT id FROM Ticket WHERE id = ?', id);
    if (!ticket) throw new NotFoundException(`ticket ${id} 不存在`);
    const audit = this.db.all<{
      id: string;
      actorUserId: string | null;
      actorRole: string | null;
      action: string;
      resource: string | null;
      payload: string | null;
      ip: string | null;
      userAgent: string | null;
      createdAt: string;
    }>(
      `SELECT id, actorUserId, actorRole, action, resource, payload, ip, userAgent, createdAt
       FROM AuditLog
       WHERE resource = ? OR action = 'ticket.reply'
       ORDER BY createdAt DESC LIMIT 50`,
      `ticket:${id}`,
    );
    const statusRows = this.db.all<{
      id: string;
      ticketId: string;
      actorUserId: string | null;
      fromStatus: string | null;
      toStatus: string | null;
      resolution: string | null;
      createdAt: string;
    }>(
      `SELECT id, ticketId, actorUserId, fromStatus, toStatus, resolution, createdAt
       FROM TicketStatusLog
       WHERE ticketId = ? ORDER BY createdAt DESC LIMIT 50`,
      id,
    );
    const statusLogs = statusRows.map((r) => ({
      id: r.id,
      ticketId: r.ticketId,
      actorUserId: r.actorUserId,
      actorRole: r.actorUserId === 'system-sla' ? 'system' : 'admin',
      fromStatus: r.fromStatus,
      toStatus: r.toStatus,
      fromSeverity: null,
      toSeverity: null,
      action: r.actorUserId === 'system-sla' ? 'sla.escalation' : 'status.update',
      notes: r.resolution,
      createdAt: r.createdAt,
    }));
    return { ok: true, audit, statusLogs };
  }

  /**
   * v1.5 #P2-5:SKU 质保月份设置 — PATCH /admin/sku/:id/warranty
   * - 改 warrantyMonthsWhole / Cell / Bms / Parts 任意子集
   * - 写 AuditLog('sku.warranty_update')
   * - 限制:月数必须为正整数(0=清零允许,负数/小数/NaN 拒绝)
   */
  async updateSkuWarranty(
    id: string,
    body: {
      warrantyMonthsWhole?: number;
      warrantyMonthsCell?: number | null;
      warrantyMonthsBms?: number | null;
      warrantyMonthsParts?: number | null;
    },
    actorUserId?: string,
  ) {
    const sku = this.db.get<{ id: string; sku: string }>('SELECT id, sku FROM Sku WHERE id = ?', id);
    if (!sku) throw new NotFoundException(`SKU ${id} 不存在`);

    // 校验
    const validPositiveInt = (n: unknown): n is number =>
      typeof n === 'number' && Number.isInteger(n) && n >= 0;
    const fields: string[] = [];
    const values: any[] = [];
    if (body.warrantyMonthsWhole !== undefined) {
      if (!validPositiveInt(body.warrantyMonthsWhole)) {
        throw new BadRequestException('warrantyMonthsWhole 必须为非负整数');
      }
      fields.push('warrantyMonthsWhole = ?');
      values.push(body.warrantyMonthsWhole);
    }
    if (body.warrantyMonthsCell !== undefined) {
      if (body.warrantyMonthsCell === null) {
        fields.push('warrantyMonthsCell = NULL');
      } else if (validPositiveInt(body.warrantyMonthsCell)) {
        fields.push('warrantyMonthsCell = ?');
        values.push(body.warrantyMonthsCell);
      } else {
        throw new BadRequestException('warrantyMonthsCell 必须为非负整数或 null');
      }
    }
    if (body.warrantyMonthsBms !== undefined) {
      if (body.warrantyMonthsBms === null) {
        fields.push('warrantyMonthsBms = NULL');
      } else if (validPositiveInt(body.warrantyMonthsBms)) {
        fields.push('warrantyMonthsBms = ?');
        values.push(body.warrantyMonthsBms);
      } else {
        throw new BadRequestException('warrantyMonthsBms 必须为非负整数或 null');
      }
    }
    if (body.warrantyMonthsParts !== undefined) {
      if (body.warrantyMonthsParts === null) {
        fields.push('warrantyMonthsParts = NULL');
      } else if (validPositiveInt(body.warrantyMonthsParts)) {
        fields.push('warrantyMonthsParts = ?');
        values.push(body.warrantyMonthsParts);
      } else {
        throw new BadRequestException('warrantyMonthsParts 必须为非负整数或 null');
      }
    }

    if (fields.length === 0) {
      throw new BadRequestException('至少提供一个质保月数字段');
    }

    this.db.run(
      `UPDATE Sku SET ${fields.join(', ')} WHERE id = ?`,
      ...values, id,
    );

    // 审计
    if (actorUserId) {
      this.db.run(
        `INSERT INTO AuditLog (id, actorUserId, actorRole, action, resource, payload, createdAt)
         VALUES (?, ?, 'admin', 'sku.warranty_update', ?, ?, CURRENT_TIMESTAMP)`,
        'aud-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        actorUserId,
        `sku:${id}`,
        JSON.stringify(body),
      );
    }

    const updated = this.db.get(
      `SELECT id, sku, warrantyMonthsWhole, warrantyMonthsCell, warrantyMonthsBms, warrantyMonthsParts
       FROM Sku WHERE id = ?`, id,
    );
    return { ok: true, sku: updated };
  }
}