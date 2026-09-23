// AuditController — P0-4 v1.2 增量:暴露审计日志查询端点
// 路径前缀 /admin/audit(挂 Controller('admin/audit')),与 admin 路由同前缀
// 仅 admin 角色可访问(参考 admin.controller.ts 的 @Roles('admin') 默认守卫)
// - GET /admin/audit?resource=...&limit=50  → 单资源审计轨迹
// - GET /admin/audit?limit=50               → 全局最近审计
// - GET /admin/audit/review/:warrantyId    → 某保修的审核日志(joined WarrantyReviewLog)

import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from './audit.service';
import { DbService } from '../../common/db/db';

@Controller('admin/audit')
@ApiTags('admin')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AuditController {
  constructor(
    private readonly audit: AuditService,
    private readonly db: DbService,
  ) {}

  /**
   * 列出最近审计行；可按 resource 过滤（与 AuditInterceptor 写入的 resource 字符串完全匹配）
   */
  @Get()
  @ApiOperation({ summary: 'List audit log entries (filter by resource, paginated)' })
  list(
    @CurrentUser() _user: AuthUser,
    @Query('resource') resource?: string,
    @Query('limit') limit?: string,
  ) {
    const n = limit ? Math.min(500, Math.max(1, Number(limit))) : 100;
    const items = resource
      ? this.audit.listByResource(resource, n)
      : this.db.all<any[]>(
          `SELECT * FROM AuditLog ORDER BY createdAt DESC LIMIT ?`,
          n,
        );
    return { ok: true, total: items.length, items };
  }

  /**
   * 某保修的全部审核轨迹（审计 + 显式 WarrantyReviewLog 双路并表）
   */
  @Get('warranty/:warrantyId')
  @ApiOperation({ summary: 'Get full audit trail for a warranty (AuditLog + WarrantyReviewLog)' })
  warrantyTrail(
    @CurrentUser() _user: AuthUser,
    @Param('warrantyId') warrantyId: string,
  ) {
    const audit = this.db.all(
      `SELECT * FROM AuditLog WHERE resource LIKE ? ORDER BY createdAt DESC LIMIT 200`,
      `%${warrantyId}%`,
    );
    const reviewLogs = this.db.all(
      `SELECT * FROM WarrantyReviewLog WHERE warrantyId = ? ORDER BY createdAt DESC LIMIT 200`,
      warrantyId,
    );
    return { ok: true, audit, reviewLogs };
  }
}