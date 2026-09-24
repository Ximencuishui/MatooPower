// v1.5 #P0-3:经销商提货 Controller(dealer 视角)
// 仅已登录的 dealer 角色可访问,自动从 user.dealerId 限定范围
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { DealerPickupService } from './dealer-pickup.service';
import { CreateDealerPickupDto } from './dto/dealer-pickup.dto';

@Controller('dealer/pickups')
@ApiTags('dealer-pickup')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('dealer', 'admin')
export class DealerPickupController {
  constructor(private readonly svc: DealerPickupService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Dealer: register a shipment pickup batch' })
  async create(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateDealerPickupDto,
  ) {
    // admin 临时让任意 dealer 登记的灵活性可后续加 dealerId 显式传参;演示期统一用自己归属 Dealer
    return await this.svc.create(body, user.sub, user.dealerId ?? '');
  }

  @Get()
  @ApiOperation({ summary: 'Dealer: list my pickup batches' })
  async list(
    @CurrentUser() user: AuthUser,
    @Query('invoiceNo') invoiceNo?: string,
  ) {
    return { ok: true, items: this.svc.list(user.dealerId ?? '', { invoiceNo }) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Dealer: get pickup batch detail' })
  async detail(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return { ok: true, pickup: this.svc.get(id, user.dealerId ?? '') };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Dealer: delete pickup batch (only if no items activated yet)' })
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return await this.svc.remove(id, user.dealerId ?? '');
  }
}
