import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
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
}