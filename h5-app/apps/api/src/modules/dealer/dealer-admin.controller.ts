// DealerAdminController — 独立 admin/dealers CRUD(P1-2 v1.4)
// 仅 admin 可访问
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { DealerAdminService } from './dealer-admin.service';

@Controller('admin/dealers')
@ApiTags('admin')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class DealerAdminController {
  constructor(private readonly svc: DealerAdminService) {}

  @Get()
  @ApiOperation({ summary: 'List dealers (admin only, paginated + searchable)' })
  async list(
    @CurrentUser() _user: AuthUser,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return {
      ok: true,
      ...this.svc.list({
        q, status,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      }),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Dealer detail (priceList + members)' })
  async get(@CurrentUser() _user: AuthUser, @Param('id') id: string) {
    return { ok: true, dealer: this.svc.getById(id) };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create dealer' })
  async create(
    @CurrentUser() user: AuthUser,
    @Body() body: {
      companyName: string; country: string;
      tier?: 'silver' | 'gold' | 'platinum';
      contactEmail?: string; contactPhone?: string; note?: string;
    },
  ) {
    if (!body.companyName || !body.country) {
      throw new BadRequestException('companyName 与 country 必填');
    }
    const dealer = this.svc.create(body, user.sub);
    return { ok: true, dealer };
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update dealer' })
  async update(
    @CurrentUser() _user: AuthUser,
    @Param('id') id: string,
    @Body() body: Partial<{
      companyName: string; country: string; tier: 'silver' | 'gold' | 'platinum';
      contactEmail: string; contactPhone: string; note: string;
    }>,
  ) {
    const dealer = this.svc.update(id, body);
    return { ok: true, dealer };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-suspend dealer (status=suspended)' })
  async suspend(@CurrentUser() _user: AuthUser, @Param('id') id: string) {
    const dealer = this.svc.suspend(id);
    return { ok: true, dealer };
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reactivate a suspended dealer' })
  async activate(@CurrentUser() _user: AuthUser, @Param('id') id: string) {
    const dealer = this.svc.activate(id);
    return { ok: true, dealer };
  }

  // 价格表子路由
  @Post(':id/prices')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a special price for a dealer on a SKU' })
  async addPrice(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: {
      skuId: string; priceCents: number; currency?: string;
      effectiveFrom?: string; effectiveTo?: string;
    },
  ) {
    if (!body.skuId || typeof body.priceCents !== 'number') {
      throw new BadRequestException('skuId 与 priceCents 必填');
    }
    const price = this.svc.addPrice(id, body, user.sub);
    return { ok: true, price };
  }

  @Delete(':id/prices/:priceId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a special price' })
  async removePrice(
    @CurrentUser() _user: AuthUser,
    @Param('id') id: string,
    @Param('priceId') priceId: string,
  ) {
    return this.svc.removePrice(id, priceId);
  }
}