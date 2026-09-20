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
  @ApiOperation({ summary: 'List all SKUs' })
  async listSkus(@CurrentUser() _user: AuthUser) {
    return { ok: true, items: await this.svc.listSkus() };
  }

  @Get('warranties')
  @ApiOperation({ summary: 'List all warranties' })
  async listWarranties(@CurrentUser() _user: AuthUser) {
    return { ok: true, items: await this.svc.listWarranties() };
  }

  @Get('devices')
  @ApiOperation({ summary: 'List all devices' })
  async listDevices(@CurrentUser() _user: AuthUser) {
    return { ok: true, items: await this.svc.listDevices() };
  }

  @Get('users')
  @ApiOperation({ summary: 'List all users' })
  async listUsers(@CurrentUser() _user: AuthUser) {
    return { ok: true, items: await this.svc.listUsers() };
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
  @ApiOperation({ summary: 'List all tickets (admin view)' })
  async listTickets(
    @CurrentUser() _user: AuthUser,
    @Query('status') status?: string,
    @Query('severity') severity?: string,
  ) {
    return { ok: true, items: this.ticketSvc.listAll(status, severity) };
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
}