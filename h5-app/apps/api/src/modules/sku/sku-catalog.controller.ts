// v1.4 P2-3:SKU 商品库管理 controller(仅 admin)
// - GET    /admin/sku-catalog/:id           读取商品资料
// - PATCH  /admin/sku-catalog/:id           编辑商品资料
// 与现有 /admin/sku 列表查询解耦,职责单一
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { SkuCatalogService } from './sku-catalog.service';
import { UpdateSkuCatalogDto } from './entities/update-sku-catalog.dto';

@Controller('admin/sku-catalog')
@ApiTags('admin')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class SkuCatalogController {
  constructor(private readonly svc: SkuCatalogService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get SKU catalog (description / images / video / guide price)' })
  async get(@Param('id') id: string) {
    return { ok: true, catalog: this.svc.getCatalog(id) };
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update SKU catalog (description / images / video / guide price)' })
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: UpdateSkuCatalogDto,
  ) {
    return { ok: true, catalog: this.svc.updateCatalog(id, body, user.sub) };
  }
}