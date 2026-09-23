import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
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
import { toCsv, CSV_BOM } from '../../common/util/csv';

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

  @Get('warranties')
  @ApiOperation({ summary: 'List all warranties (paginated + searchable)' })
  async listWarranties(
    @CurrentUser() _user: AuthUser,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
  ) {
    return {
      ok: true,
      ...await this.svc.listWarranties({
        q, page: page ? Number(page) : undefined, pageSize: pageSize ? Number(pageSize) : undefined, status,
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

  @Post('warranties/:id/review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Review / override warranty status' })
  async review(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { status: 'active' | 'pending' | 'expired' | 'rejected'; notes?: string },
  ) {
    const w = await this.svc.reviewWarranty(id, body.status, body.notes, user.sub);
    return { ok: true, warranty: w };
  }

  // P0-6 v1.2 增量:批量审核 — admin 批量场景(如批量拒绝伪造批次)
  // 接受 ids[] 与统一 status/notes,逐条复用 reviewWarranty 写入逻辑
  // 返回 succeeded/failed 两条,前端按需提示重试
  @Post('warranties/bulk-review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk review multiple warranties (admin only)' })
  async bulkReview(
    @CurrentUser() user: AuthUser,
    @Body() body: { ids: string[]; status: 'active' | 'pending' | 'expired' | 'rejected'; notes?: string },
  ) {
    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      throw new BadRequestException('ids 必须为非空数组');
    }
    if (body.ids.length > 100) {
      throw new BadRequestException('单次批量上限 100 条');
    }
    const result = await this.svc.bulkReviewWarranties(body.ids, body.status, body.notes, user.sub);
    return { ok: true, ...result };
  }

  @Get('tickets')
  @Roles('admin', 'support')
  @ApiOperation({ summary: 'List all tickets (admin view, paginated + searchable)' })
  async listTickets(
    @CurrentUser() _user: AuthUser,
    @Query('status') status?: string,
    @Query('severity') severity?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return {
      ok: true,
      ...this.ticketSvc.listAll(status, severity, {
        q, page: page ? Number(page) : undefined, pageSize: pageSize ? Number(pageSize) : undefined,
      }),
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
}