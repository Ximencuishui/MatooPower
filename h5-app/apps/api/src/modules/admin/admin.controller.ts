import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { TicketService } from '../ticket/ticket.service';

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
    @Param('id') id: string,
    @Body() body: { status: 'active' | 'pending' | 'expired' | 'rejected'; notes?: string },
  ) {
    const w = await this.svc.reviewWarranty(id, body.status, body.notes);
    return { ok: true, warranty: w };
  }

  @Get('tickets')
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
}