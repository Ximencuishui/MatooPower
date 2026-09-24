// v1.5 #P0-2:配件商城 Controller
// - 公开 GET /parts / GET /parts/:id(H5 /shop 用)
// - H5 / dealer POST /parts/orders(下单)
// - admin CRUD /admin/parts + /admin/parts/orders
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard, Public } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PartsService } from './parts.service';
import { CreatePartDto, UpdatePartDto, CreatePartOrderDto } from './dto/parts.dto';

@Controller('parts')
@ApiTags('parts')
@ApiBearerAuth('jwt')
export class PartsController {
  constructor(private readonly svc: PartsService) {}

  /** H5 / dealer 浏览 */
  @Public()
  @Get()
  @ApiOperation({ summary: 'List parts (public, active only)' })
  async list(
    @Query('family') family?: string,
    @Query('q') q?: string,
  ) {
    return { ok: true, items: this.svc.list({ family, q, activeOnly: true }) };
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get part detail (public)' })
  async detail(@Param('id') id: string) {
    return { ok: true, part: this.svc.get(id) };
  }

  /**
   * 提交订单 — H5 / dealer 都可用
   * - 后端校验每个 partId 存在 + 库存充足
   * - 写 PartOrder + PartOrderItem 事务
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer', 'dealer', 'admin', 'support')
  @Post('orders')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create part order (any logged-in user)' })
  async createOrder(
    @CurrentUser() user: AuthUser,
    @Body() body: CreatePartOrderDto,
  ) {
    // #P0-2 dealer 工作台发起则 source='dealer'
    if (!body.source && user.role === 'dealer') body.source = 'dealer';
    return await this.svc.createOrder(body, user.sub);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer', 'dealer', 'admin', 'support')
  @Get('orders/mine')
  @ApiOperation({ summary: 'List my part orders' })
  async myOrders(@CurrentUser() user: AuthUser) {
    return { ok: true, items: this.svc.listMyOrders(user.sub) };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer', 'dealer', 'admin', 'support')
  @Get('orders/:id')
  @ApiOperation({ summary: 'Get my order detail' })
  async myOrder(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    const order = this.svc.getOrder(id);
    if (order.userId !== user.sub && user.role !== 'admin' && user.role !== 'support') {
      // 非本人订单且非 staff → 403(简化返回 404 防止枚举)
      return { ok: false, code: 'NOT_FOUND' as const };
    }
    return { ok: true, order };
  }
}

@Controller('admin/parts')
@ApiTags('admin')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminPartsController {
  constructor(private readonly svc: PartsService) {}

  @Get()
  @ApiOperation({ summary: 'Admin: list all parts (incl. inactive)' })
  async list(
    @Query('family') family?: string,
    @Query('q') q?: string,
  ) {
    return { ok: true, items: this.svc.list({ family, q, activeOnly: false }) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Admin: get part detail' })
  async detail(@Param('id') id: string) {
    return { ok: true, part: this.svc.get(id) };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Admin: create part' })
  async create(
    @CurrentUser() user: AuthUser,
    @Body() body: CreatePartDto,
  ) {
    return { ok: true, part: this.svc.create(body, user.sub) };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Admin: update part' })
  async update(@Param('id') id: string, @Body() body: UpdatePartDto) {
    return { ok: true, part: this.svc.update(id, body) };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Admin: soft-delete part (set active=0)' })
  async remove(@Param('id') id: string) {
    return await this.svc.remove(id);
  }

  @Get('orders/all')
  @ApiOperation({ summary: 'Admin: list all part orders' })
  async listOrders(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return {
      ok: true,
      ...this.svc.listAllOrders({
        status,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      }),
    };
  }

  @Put('orders/:id/status')
  @ApiOperation({ summary: 'Admin: update part order status (paid|shipped|completed|cancelled)' })
  async updateOrderStatus(
    @Param('id') id: string,
    @Body() body: { status: 'paid' | 'shipped' | 'completed' | 'cancelled' },
  ) {
    return { ok: true, order: this.svc.updateOrderStatus(id, body.status) };
  }
}
