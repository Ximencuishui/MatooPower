import { Body, Controller, Get, Header, HttpCode, HttpStatus, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { DealerService, Overview } from './dealer.service';
import { BulkActivateDto } from './dto/bulk-activate.dto';
import { toCsv, CSV_BOM } from '../../common/util/csv';

@Controller('dealer')
@ApiTags('dealer')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('dealer', 'admin')
export class DealerController {
  constructor(private readonly svc: DealerService) {}

  @Get('me')
  @ApiOperation({ summary: 'Dealer overview (warranties / devices / pending / this month)' })
  async me(@CurrentUser() user: AuthUser): Promise<{ ok: true; user: { id: string; role: string }; overview: Overview }> {
    const overview = this.svc.getOverview(user.sub);
    return { ok: true, user: { id: user.sub, role: user.role }, overview };
  }

  @Get('warranties')
  @ApiOperation({ summary: 'List warranties I triggered (as dealer)' })
  async warranties(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
  ) {
    const items = this.svc.listWarranties(user.sub, status);
    return { ok: true, items };
  }

  @Get('devices')
  @ApiOperation({ summary: 'List devices I triggered (as dealer)' })
  async devices(@CurrentUser() user: AuthUser) {
    const items = this.svc.listDevices(user.sub);
    return { ok: true, items };
  }

  /**
   * v1.5 #P1-9:H5 /dealer/price-list 入口 — 经销商专属价表
   * - 反查 dealer User.dealerId → DealerPriceList WHERE dealerId = ?
   * - 拼接 SKU 主数据(sku / modelName / imageUrls / guidePriceCents 折扣基准)
   * - 过滤:有效期需涵盖 today
   */
  @Get('price-list')
  @ApiOperation({ summary: 'Get my dedicated price list (joined with SKU info)' })
  async priceList(@CurrentUser() user: AuthUser) {
    const items = this.svc.getPriceList(user.sub);
    return { ok: true, items };
  }

  @Post('bulk-activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk activate multiple SKUs (auto-create customer, warranty, device)' })
  async bulkActivate(
    @CurrentUser() user: AuthUser,
    @Body() body: BulkActivateDto,
  ) {
    const r = this.svc.bulkActivate(user.sub, body);
    return r;
  }

  // ============================================================
  // v1.1 CSV exports
  // ============================================================
  @Get('warranties.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'Export warranties I triggered as CSV (dealer/admin)' })
  async exportWarrantiesCsv(
    @CurrentUser() user: AuthUser,
    @Query('status') status: string | undefined,
    @Res({ passthrough: false }) res: Response,
  ) {
    const items = this.svc.listWarranties(user.sub, status);
    res.setHeader('Content-Disposition', `attachment; filename="dealer-warranties-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(CSV_BOM + toCsv(items as unknown as Record<string, unknown>[]));
  }

  @Get('devices.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'Export devices I triggered as CSV (dealer/admin)' })
  async exportDevicesCsv(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: false }) res: Response,
  ) {
    const items = this.svc.listDevices(user.sub);
    res.setHeader('Content-Disposition', `attachment; filename="dealer-devices-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(CSV_BOM + toCsv(items as unknown as Record<string, unknown>[]));
  }
}