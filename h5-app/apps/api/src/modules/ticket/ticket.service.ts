import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { DbService } from '../../common/db/db';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';

export interface TicketRow {
  id: string;
  userId: string;
  skuId: string | null;
  deviceId: string | null;
  type: string;
  severity: string;
  subject: string;
  description: string;
  contactPhone: string | null;
  status: string;
  assigneeUserId: string | null;
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketListItem extends TicketRow {
  sku?: string;
  modelName?: string;
  serial?: string;
  authorName?: string;
  assigneeName?: string;
  messageCount: number;
  lastMessageAt?: string;
}

@Injectable()
export class TicketService {
  constructor(private readonly db: DbService) {}

  create(userId: string, dto: CreateTicketDto) {
    // 验证 skuId / deviceId 存在
    if (dto.skuId) {
      const s = this.db.get<any>('SELECT id FROM Sku WHERE id = ?', dto.skuId);
      if (!s) throw new BadRequestException(`SKU ${dto.skuId} 不存在`);
    }
    if (dto.deviceId) {
      const d = this.db.get<any>('SELECT id FROM Device WHERE id = ?', dto.deviceId);
      if (!d) throw new BadRequestException(`Device ${dto.deviceId} 不存在`);
    }

    const id = `ticket-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const now = new Date().toISOString();
    this.db.run(
      `INSERT INTO Ticket (id, userId, skuId, deviceId, type, severity, subject, description, contactPhone, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
      id, userId, dto.skuId ?? null, dto.deviceId ?? null, dto.type, dto.severity, dto.subject, dto.description, dto.contactPhone ?? null, now, now,
    );

    // 系统首条消息
    this.db.run(
      `INSERT INTO TicketMessage (id, ticketId, senderRole, body, createdAt) VALUES (?, ?, 'system', ?, ?)`,
      `tm-sys-${id}`, id, `工单已创建（${this.typeLabel(dto.type)}，${this.severityLabel(dto.severity)}）`, now,
    );

    return this.db.get('SELECT * FROM Ticket WHERE id = ?', id);
  }

  listForUser(userId: string, status?: string): TicketListItem[] {
    let sql = `
      SELECT t.*,
             s.sku AS sku, s.modelName AS modelName, s.serial AS serial,
             ua.displayName AS authorName,
             uas.displayName AS assigneeName,
             (SELECT COUNT(*) FROM TicketMessage m WHERE m.ticketId = t.id) AS messageCount,
             (SELECT MAX(createdAt) FROM TicketMessage m WHERE m.ticketId = t.id) AS lastMessageAt
      FROM Ticket t
      LEFT JOIN Sku s ON t.skuId = s.id
      LEFT JOIN User ua ON t.userId = ua.id
      LEFT JOIN User uas ON t.assigneeUserId = uas.id
      WHERE t.userId = ?
    `;
    const args: any[] = [userId];
    if (status) {
      sql += ' AND t.status = ?';
      args.push(status);
    }
    sql += ' ORDER BY t.updatedAt DESC';
    return this.db.all(sql, ...args) as TicketListItem[];
  }

  listAll(status?: string, severity?: string, opts: { q?: string; page?: number; pageSize?: number } = {}): { items: TicketListItem[]; total: number; page: number; pageSize: number } {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
    const offset = (page - 1) * pageSize;
    const q = opts.q?.trim() ?? '';

    const where: string[] = [];
    const args: any[] = [];
    if (status) { where.push('t.status = ?'); args.push(status); }
    if (severity) { where.push('t.severity = ?'); args.push(severity); }
    if (q) {
      where.push('(t.subject LIKE ? OR t.description LIKE ? OR t.id LIKE ?)');
      args.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const totalRow = this.db.get<{ c: number }>(`SELECT COUNT(*) AS c FROM Ticket t ${whereSql}`, ...args);
    const total = totalRow?.c ?? 0;

    let sql = `
      SELECT t.*,
             s.sku AS sku, s.modelName AS modelName, s.serial AS serial,
             ua.displayName AS authorName,
             uas.displayName AS assigneeName,
             (SELECT COUNT(*) FROM TicketMessage m WHERE m.ticketId = t.id) AS messageCount,
             (SELECT MAX(createdAt) FROM TicketMessage m WHERE m.ticketId = t.id) AS lastMessageAt
      FROM Ticket t
      LEFT JOIN Sku s ON t.skuId = s.id
      LEFT JOIN User ua ON t.userId = ua.id
      LEFT JOIN User uas ON t.assigneeUserId = uas.id
      ${whereSql}
      ORDER BY t.updatedAt DESC
      LIMIT ? OFFSET ?
    `;
    const items = this.db.all(sql, ...args, pageSize, offset) as TicketListItem[];
    return { items, total, page, pageSize };
  }

  getById(id: string) {
    const t = this.db.get<TicketRow>('SELECT * FROM Ticket WHERE id = ?', id);
    if (!t) throw new NotFoundException(`工单 ${id} 不存在`);
    return t;
  }

  /** 用户看自己的工单 / 客服看所有人；返回带 sku 关联 */
  getDetail(id: string, userId: string, role: string) {
    const t = this.getById(id);
    if (role !== 'admin' && role !== 'support' && t.userId !== userId) {
      throw new ForbiddenException('无权访问此工单');
    }
    const messages = this.db.all(
      `SELECT m.*, u.displayName AS senderName
       FROM TicketMessage m LEFT JOIN User u ON m.senderUserId = u.id
       WHERE m.ticketId = ? ORDER BY m.createdAt ASC`,
      id,
    );
    const sku = t.skuId ? this.db.get<any>('SELECT sku, modelName, serial FROM Sku WHERE id = ?', t.skuId) : null;
    const author = this.db.get<any>('SELECT displayName, phone FROM User WHERE id = ?', t.userId);
    const assignee = t.assigneeUserId ? this.db.get<any>('SELECT displayName FROM User WHERE id = ?', t.assigneeUserId) : null;
    return { ...t, sku, author, assignee, messages };
  }

  /** 用户回复工单 */
  reply(id: string, userId: string, role: string, body: string) {
    const t = this.getById(id);
    if (role !== 'admin' && role !== 'support' && t.userId !== userId) {
      throw new ForbiddenException('无权回复此工单');
    }
    const now = new Date().toISOString();
    const msgId = `tm-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    this.db.run(
      `INSERT INTO TicketMessage (id, ticketId, senderUserId, senderRole, body, createdAt) VALUES (?, ?, ?, ?, ?, ?)`,
      msgId, id, userId, (role === 'admin' || role === 'support') ? 'support' : 'customer', body, now,
    );
    this.db.run(
      `UPDATE Ticket SET updatedAt = ?, status = CASE WHEN status = 'waiting_customer' THEN 'in_progress' ELSE status END WHERE id = ?`,
      now, id,
    );
    return this.db.get('SELECT * FROM TicketMessage WHERE id = ?', msgId);
  }

  /** 客服 / admin 更新工单状态 */
  update(id: string, dto: UpdateTicketDto, actorUserId: string) {
    const t = this.getById(id);
    const fromStatus = t.status;
    const now = new Date().toISOString();
    const resolvedAt = dto.status === 'resolved' ? (t.resolvedAt ?? now) : t.resolvedAt;
    this.db.run(
      `UPDATE Ticket SET status = ?, resolution = COALESCE(?, resolution), assigneeUserId = COALESCE(?, assigneeUserId), resolvedAt = ?, updatedAt = ? WHERE id = ?`,
      dto.status, dto.resolution ?? null, dto.assigneeUserId ?? null, resolvedAt, now, id,
    );

    // v1.1 audit: 写 TicketStatusLog（状态变化才记录）
    if (fromStatus !== dto.status) {
      const logId = `tsl-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      this.db.run(
        `INSERT INTO TicketStatusLog (id, ticketId, actorUserId, fromStatus, toStatus, resolution, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        logId, id, actorUserId, fromStatus, dto.status, dto.resolution ?? null, now,
      );
    }

    // 系统消息
    const sysMsgId = `tm-sys-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    this.db.run(
      `INSERT INTO TicketMessage (id, ticketId, senderUserId, senderRole, body, createdAt) VALUES (?, ?, ?, 'system', ?, ?)`,
      sysMsgId, id, actorUserId, `状态更新为 ${this.statusLabel(dto.status)}${dto.resolution ? '，处理：' + dto.resolution : ''}`, now,
    );

    return this.getById(id);
  }

  /** 统计 — 用于 admin 概览 */
  stats() {
    const open = this.db.get<{ c: number }>("SELECT COUNT(*) AS c FROM Ticket WHERE status IN ('open','in_progress','waiting_customer')")?.c ?? 0;
    const resolved = this.db.get<{ c: number }>("SELECT COUNT(*) AS c FROM Ticket WHERE status IN ('resolved','closed')")?.c ?? 0;
    const urgent = this.db.get<{ c: number }>("SELECT COUNT(*) AS c FROM Ticket WHERE severity IN ('high','urgent') AND status NOT IN ('resolved','closed')")?.c ?? 0;
    const today = new Date(); today.setHours(0,0,0,0);
    const todayNew = this.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM Ticket WHERE createdAt >= ?', today.toISOString())?.c ?? 0;
    return { open, resolved, urgent, todayNew };
  }

  private typeLabel(t: string) {
    return ({ general: '一般咨询', warranty: '保修服务', inquiry: '售前咨询', remote: '远程诊断' } as any)[t] ?? t;
  }
  private severityLabel(s: string) {
    return ({ low: '一般', normal: '普通', high: '高', urgent: '紧急' } as any)[s] ?? s;
  }
  private statusLabel(s: string) {
    return ({ open: '待处理', in_progress: '处理中', waiting_customer: '等待客户', resolved: '已解决', closed: '已关闭' } as any)[s] ?? s;
  }
}