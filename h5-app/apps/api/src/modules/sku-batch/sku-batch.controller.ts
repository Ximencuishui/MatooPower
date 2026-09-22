import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateSkuBatchDto, UpdateSkuBatchDto } from './dto/sku-batch.dto';
import { SkuBatchService } from './sku-batch.service';

@Controller('admin/sku-batch')
@ApiTags('admin')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class SkuBatchController {
  constructor(private readonly svc: SkuBatchService) {}

  @Get()
  @ApiOperation({ summary: 'List SKU batches (paginated + searchable)' })
  async list(
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return {
      ok: true,
      ...await this.svc.list({
        q, page: page ? Number(page) : undefined, pageSize: pageSize ? Number(pageSize) : undefined,
      }),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one SKU batch with stats' })
  async get(@Param('id') id: string) {
    return { ok: true, batch: await this.svc.get(id) };
  }

  @Post()
  @ApiOperation({ summary: 'Create a SKU batch' })
  async create(@Body() body: CreateSkuBatchDto, @CurrentUser() user: AuthUser) {
    return { ok: true, batch: await this.svc.create(body, user.sub) };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a SKU batch' })
  async update(@Param('id') id: string, @Body() body: UpdateSkuBatchDto) {
    return { ok: true, batch: await this.svc.update(id, body) };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a SKU batch (only when no Sku/Document/QrBatch linked)' })
  async remove(@Param('id') id: string) {
    return await this.svc.remove(id);
  }
}