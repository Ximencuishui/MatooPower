import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkuService } from './sku.service';
import { Public } from '../../common/guards/jwt-auth.guard';

@Controller('sku')
@ApiTags('sku')
export class SkuController {
  constructor(private readonly sku: SkuService) {}

  /** 公开：根据 id 查 SKU + 二维码签名（前端扫码页用） */
  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get SKU by id (public)' })
  async findOne(@Param('id') id: string) {
    const data = await this.sku.findOne(id);
    return { ok: true, ...data };
  }

  /** 演示用：seed SKU */
  @Public()
  @Post('admin/seed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Seed demo SKU (public demo endpoint)' })
  async seed(@Body() body: any) {
    const data = await this.sku.seedDemoSku(body);
    return { ok: true, ...data };
  }
}