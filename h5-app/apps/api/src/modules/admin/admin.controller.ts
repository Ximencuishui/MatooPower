import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { TicketService } from '../ticket/ticket.service';
import { DeviceService } from '../device/device.service';
import { SkuService } from '../sku/sku.service';
import { toCsv, CSV_BOM } from '../../common/util/csv';
import {
  ReviewWarrantyDto,
  BulkReviewWarrantiesDto,
  ListWarrantiesQueryDto,
  WarrantyStatus,
} from './dto/warranty.dto';

@Controller('admin')
@ApiTags('admin')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(
    private readonly svc: AdminService,
    private readonly ticketSvc: TicketService,
    private readonly deviceSvc: DeviceService,
    private readonly skuSvc: SkuService,
  ) {}

  @Get('sku')
  @ApiOperation({ summary: 'List all SKUs (paginated + searchable)' })
  async listSkus(
    @CurrentUser() _user: AuthUser,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return {
      ok: true,
      ...await this.svc.listSkus({
        q, page: page ? Number(page) : undefined, pageSize: pageSize ? Number(pageSize) : undefined,
      }),
    };
  }

  // #P0-1:状态枚举收紧,白名单之外直接 400,避免 'review' 之类错拼写造成静默 0 结果
  // #P1-5:dealerId 过滤(后台能定位某经销商名下所有保修)
  @Get('warranties')
  @ApiOperation({ summary: 'List all warranties (paginated + searchable)' })
  async listWarranties(
    @CurrentUser() _user: AuthUser,
    @Query() qry: ListWarrantiesQueryDto,
    @Query('dealerId') dealerId?: string,
  ) {
    return {
      ok: true,
      ...await this.svc.listWarranties({
        q: qry.q,
        page: qry.page ? Number(qry.page) : undefined,
        pageSize: qry.pageSize ? Number(qry.pageSize) : undefined,
        status: qry.status,
        dealerId,
      }),
    };
  }

  @Get('devices')
  @ApiOperation({ summary: 'List all devices (paginated + searchable)' })
  async listDevices(
    @CurrentUser() _user: AuthUser,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return {
      ok: true,
      ...await this.svc.listDevices({
        q, page: page ? Number(page) : undefined, pageSize: pageSize ? Number(pageSize) : undefined,
      }),
    };
  }

  /**
   * Admin 视角：获取任意设备的实时遥测（跳过 owner 校验，不写入模拟 lastSeenAt）
   * 用于 /admin/devices 详情 Drawer
   */
  @Get('device/:id/health')
  @ApiOperation({ summary: 'Admin: get device health snapshot (any device, no owner check)' })
  async deviceHealth(@Param('id') id: string) {
    const snap = await this.deviceSvc.getHealth(id, '', { asAdmin: true });
    return { ok: true, device: snap };
  }

  @Get('users')
  @ApiOperation({ summary: 'List all users (paginated + searchable)' })
  async listUsers(
    @CurrentUser() _user: AuthUser,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('role') role?: string,
  ) {
    return {
      ok: true,
      ...await this.svc.listUsers({
        q, page: page ? Number(page) : undefined, pageSize: pageSize ? Number(pageSize) : undefined, role,
      }),
    };
  }

  // #P1-4 接受单 DTO,内部强制走白名单(由 class-validator class 保证)
  @Post('warranties/:id/review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Review / override warranty status' })
  async review(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: ReviewWarrantyDto,
  ) {
    const w = await this.svc.reviewWarranty(id, body.status, body.notes, user.sub);
    return { ok: true, warranty: w };
  }

  /**
   * #P1-4 v1.5 增量:批量审核
   * - 兼容旧用法 { ids, status, notes }
   * - 新用法 { items: [{ id, status?, notes? }] } 可逐条覆盖 status + notes
   *   ↑ 当某条不提供时,fallback 到顶层 status/notes
   * - 防御性校验:ids 与 items 不能同时为空
   */
  @Post('warranties/bulk-review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk review multiple warranties (admin only)' })
  async bulkReview(
    @CurrentUser() user: AuthUser,
    @Body() body: BulkReviewWarrantiesDto,
  ) {
    const idList: string[] = Array.isArray(body.items)
      ? body.items.map((it) => it.id)
      : Array.isArray(body.ids) ? body.ids : [];
    if (idList.length === 0) {
      throw new BadRequestException('ids 或 items 至少提供一个非空数组');
    }
    if (idList.length > 100) {
      throw new BadRequestException('单次批量上限 100 条');
    }
    if (Array.isArray(body.items) && body.items.length > 0 && !body.status) {
      // 逐条模式:每条需自带 status 或顶层提供 status;否则整体 400
      const allHave = body.items.every((it) => !!it.status);
      if (!allHave) {
        throw new BadRequestException('逐条模式时,需每条都提供 status,或在顶层提供公共 status');
      }
    }
    const result = await this.svc.bulkReviewWarranties(
      body.items ?? idList.map((id) => ({ id })),
      body.status,
      body.notes,
      user.sub,
    );
    return { ok: true, ...result };
  }

  @Get('tickets')
  @Roles('admin', 'support')
  @ApiOperation({ summary: 'List all tickets (admin view, paginated + searchable)' })
  async listTickets(
    @CurrentUser() _user: AuthUser,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('severity') severity?: string,
    @Query('source') source?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return {
      ok: true,
      ...this.ticketSvc.listAll(status, severity, { type, source, q, page: page ? Number(page) : undefined, pageSize: pageSize ? Number(pageSize) : undefined }),
    };
  }

  @Get('tickets/stats')
  @Roles('admin', 'support')
  @ApiOperation({ summary: 'Ticket KPIs (open / resolved / urgent / today)' })
  async ticketStats(@CurrentUser() _user: AuthUser) {
    return { ok: true, stats: this.ticketSvc.stats() };
  }

  // P1-3 v1.4:SLA 预警统计 — admin/support 可访问
  @Get('tickets/sla-stats')
  @Roles('admin', 'support')
  @ApiOperation({ summary: 'SLA breach stats (openOver2h / highOver4h)' })
  async slaStats(@CurrentUser() _user: AuthUser) {
    return { ok: true, ...this.ticketSvc.slaStats() };
  }

  // P1-3 v1.4:手动触发 SLA sweep(调试 + 冒烟)
  @Post('tickets/sla-sweep')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually trigger SLA escalation sweep (admin only)' })
  async slaSweep(@CurrentUser() _user: AuthUser) {
    return { ok: true, ...this.ticketSvc.runSlaSweep() };
  }

  @Get('overview')
  @ApiOperation({ summary: 'Platform overview KPIs' })
  async overview(@CurrentUser() _user: AuthUser) {
    return { ok: true, overview: await this.svc.overview() };
  }

  @Get('analytics/trends')
  @ApiOperation({ summary: 'Daily trends (warranty / device / ticket activations)' })
  async trends(@CurrentUser() _user: AuthUser, @Query('days') days?: string) {
    return { ok: true, ...await this.svc.trends(days ? Number(days) : 30) };
  }

  @Get('analytics/breakdown')
  @ApiOperation({ summary: 'Dimensional breakdown (warranty / device / ticket)' })
  async breakdown(
    @CurrentUser() _user: AuthUser,
    @Query('type') type?: string,
    @Query('groupBy') groupBy?: string,
  ) {
    const validTypes = ['warranty', 'device', 'ticket'] as const;
    const validGroups = ['sku', 'country', 'severity', 'role'] as const;
    const t = (validTypes as readonly string[]).includes(type ?? '') ? type! : 'warranty';
    const g = (validGroups as readonly string[]).includes(groupBy ?? '') ? groupBy! : 'sku';
    return { ok: true, items: await this.svc.breakdown(t as any, g as any) };
  }

  // ============================================================
  // v1.1 CSV exports — ?format=csv 直接在原端点判定,返回 text/csv
  // ============================================================
  @Get('sku.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'Export SKU list as CSV (admin only)' })
  async exportSkuCsv(
    @CurrentUser() _user: AuthUser,
    @Query('q') q: string | undefined,
    @Res({ passthrough: false }) res: Response,
  ) {
    const data = await this.svc.listSkus({ q, page: 1, pageSize: 100 });
    res.setHeader('Content-Disposition', `attachment; filename="admin-sku-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(CSV_BOM + toCsv(data.items as unknown as Record<string, unknown>[]));
  }

  @Get('warranties.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'Export warranties list as CSV (admin only)' })
  async exportWarrantiesCsv(
    @CurrentUser() _user: AuthUser,
    @Query('q') q: string | undefined,
    @Query('status') status: string | undefined,
    @Res({ passthrough: false }) res: Response,
  ) {
    const data = await this.svc.listWarranties({ q, status, page: 1, pageSize: 100 });
    res.setHeader('Content-Disposition', `attachment; filename="admin-warranties-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(CSV_BOM + toCsv(data.items));
  }

  @Get('devices.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'Export devices list as CSV (admin only)' })
  async exportDevicesCsv(
    @CurrentUser() _user: AuthUser,
    @Query('q') q: string | undefined,
    @Res({ passthrough: false }) res: Response,
  ) {
    const data = await this.svc.listDevices({ q, page: 1, pageSize: 100 });
    res.setHeader('Content-Disposition', `attachment; filename="admin-devices-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(CSV_BOM + toCsv(data.items));
  }

  @Get('users.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'Export users list as CSV (admin only)' })
  async exportUsersCsv(
    @CurrentUser() _user: AuthUser,
    @Query('q') q: string | undefined,
    @Query('role') role: string | undefined,
    @Res({ passthrough: false }) res: Response,
  ) {
    const data = await this.svc.listUsers({ q, role, page: 1, pageSize: 100 });
    res.setHeader('Content-Disposition', `attachment; filename="admin-users-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(CSV_BOM + toCsv(data.items));
  }

  @Get('tickets.csv')
  @Roles('admin', 'support')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'Export tickets list as CSV (admin/support)' })
  async exportTicketsCsv(
    @CurrentUser() _user: AuthUser,
    @Query('status') status: string | undefined,
    @Query('severity') severity: string | undefined,
    @Query('q') q: string | undefined,
    @Res({ passthrough: false }) res: Response,
  ) {
    const data = this.ticketSvc.listAll(status, severity, { q, page: 1, pageSize: 100 });
    res.setHeader('Content-Disposition', `attachment; filename="admin-tickets-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(CSV_BOM + toCsv(data.items as unknown as Record<string, unknown>[]));
  }

  // ============================================================
  // A1/B1: 单条详情 + 用户角色更新
  // ============================================================
  @Get('users/:id')
  @ApiOperation({ summary: 'Get user detail (with recent warranties)' })
  async getUser(@CurrentUser() _user: AuthUser, @Param('id') id: string) {
    return { ok: true, user: await this.svc.getUserDetail(id) };
  }

  @Get('warranties/:id')
  @ApiOperation({ summary: 'Get warranty detail (with audit logs)' })
  async getWarranty(@CurrentUser() _user: AuthUser, @Param('id') id: string) {
    return { ok: true, warranty: await this.svc.getWarrantyDetail(id) };
  }

  @Patch('users/:id/role')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update user role (admin only)' })
  async updateUserRole(
    @CurrentUser() _user: AuthUser,
    @Param('id') id: string,
    @Body() body: { role: 'admin' | 'dealer' | 'customer' },
  ) {
    const validRoles = ['admin', 'dealer', 'customer'] as const;
    if (!validRoles.includes(body.role)) {
      throw new BadRequestException('role 必须是 admin / dealer / customer');
    }
    const user = await this.svc.updateUserRole(id, body.role);
    return { ok: true, user };
  }

  // ============================================================
  // P1-1 v1.4:GDPR 软删 — DELETE /admin/users/:id
  // 匿名化字段 + 写 AuditLog + 清 Session
  // ============================================================
  @Delete('users/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'GDPR soft-delete + anonymize user (admin only)' })
  async gdprDeleteUser(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return await this.svc.gdprDeleteUser(id, user.sub);
  }

  // ============================================================
  // v1.5 #P1-3:用户 Suspension — POST /admin/users/:id/suspend
  // 体止:isActive=0 → JwtStrategy 拒绝后续请求
  // ============================================================
  @Post('users/:id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspend user (admin only) — sets isActive=0' })
  async suspendUser(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return await this.svc.suspendUser(id, body?.reason ?? '', user.sub);
  }

  @Post('users/:id/unsuspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unsuspend user (admin only) — sets isActive=1' })
  async unsuspendUser(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return await this.svc.unsuspendUser(id, user.sub);
  }

  // ============================================================
  // v1.5 #P1-2:根据序列号反查 SKU(经销商 H5 提货粘贴 SKU/Serial 时回填用)
  // ============================================================
  @Get('sku/by-serial/:serial')
  @ApiOperation({ summary: 'Admin: lookup Sku by serial number (returns sku + batch + skuId)' })
  async skuBySerial(@Param('serial') serial: string) {
    const row = this.skuSvc.findBySerial(serial);
    if (!row) throw new NotFoundException(`serial ${serial} 未找到对应 SKU`);
    return { ok: true, sku: row };
  }

  // ============================================================
  // v1.5 #P2-1:工单审计轨迹 — GET /admin/audit/ticket/:id
  // 返回 AuditLog（资源型动作） + TicketStatusLog（状态/严重度变更）
  // ============================================================
  @Get('audit/ticket/:id')
  @ApiOperation({ summary: 'Ticket audit trail (admin/support)' })
  async ticketAuditTrail(
    @CurrentUser() _user: AuthUser,
    @Param('id') id: string,
  ) {
    return await this.svc.getTicketAuditTrail(id);
  }

  // ============================================================
  // v1.5 #P2-5:SKU 质保月份设置 — PATCH /admin/sku/:id/warranty
  // 允许后台修改 warrantyMonthsWhole / Cell / Bms / Parts
  // ============================================================
  @Patch('sku/:id/warranty')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update SKU warranty months (admin only)' })
  async updateSkuWarranty(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: {
      warrantyMonthsWhole?: number;
      warrantyMonthsCell?: number | null;
      warrantyMonthsBms?: number | null;
      warrantyMonthsParts?: number | null;
    },
  ) {
    return await this.svc.updateSkuWarranty(id, body, user.sub);
  }
}