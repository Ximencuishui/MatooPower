import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { DealerService, Overview } from './dealer.service';
import { BulkActivateDto } from './dto/bulk-activate.dto';

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
}