// AuditService — 通用审计日志写入器
// 调用方:audit.interceptor.ts(自动) + admin.service/ticket.service(显式 warranty/ticket 状态变更)
import { Injectable, Logger } from '@nestjs/common';
import { DbService } from '../../common/db/db';

export interface AuditInput {
  actorUserId: string | null;
  actorRole: string | null;
  action: string;            // 'warranty.review' | 'ticket.update' | 'admin.user.list' | ...
  resource?: string | null;  // 'warranty:abc' | 'ticket:def'
  payload?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  constructor(private readonly db: DbService) {}

  write(input: AuditInput) {
    try {
      const id = `audit-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
      this.db.run(
        `INSERT INTO AuditLog (id, actorUserId, actorRole, action, resource, payload, ip, userAgent, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        id,
        input.actorUserId,
        input.actorRole,
        input.action,
        input.resource ?? null,
        input.payload == null ? null : JSON.stringify(input.payload),
        input.ip ?? null,
        input.userAgent ?? null,
      );
    } catch (e) {
      // 审计失败不应阻塞业务 — 仅记日志
      this.logger.warn(`audit write failed: ${(e as Error).message}`);
    }
  }

  /** 查询某资源的审计轨迹（仅 admin 可调用，未在本期暴露端点，供 v1.2 /admin/audit 用） */
  listByResource(resource: string, limit = 100) {
    return this.db.all(
      `SELECT * FROM AuditLog WHERE resource = ? ORDER BY createdAt DESC LIMIT ?`,
      resource,
      Math.min(500, Math.max(1, limit)),
    );
  }
}