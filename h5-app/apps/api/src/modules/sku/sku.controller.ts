import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkuService } from './sku.service';
import { Public } from '../../common/guards/jwt-auth.guard';
import { parseStringArray } from '../../common/util/json-array';

/** 解析 SKU_IMAGE_SLUG_MAP 环境变量
 *  格式: "MAT-12V200Ah=power01,MAT-12V300Ah=power02"
 *  未配映射则用 defaultImageSlug() 从 sku 字符串生成 */
function parseSlugMap(raw: string | undefined): Record<string, string> {
  const map: Record<string, string> = {};
  if (!raw) return map;
  for (const pair of raw.split(',')) {
    const [k, v] = pair.split('=').map((s) => s.trim());
    if (k && v) map[k] = v;
  }
  return map;
}

/** 默认 imageSlug:把 SKU 字符串转 URL-friendly slug
 *  例:MAT-12V200Ah → mat-12v200ah(运营方可在 SKU_IMAGE_SLUG_MAP 里覆盖) */
function defaultImageSlug(sku: string): string {
  return sku.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

@Controller('sku')
@ApiTags('sku')
export class SkuController {
  private readonly log = new Logger(SkuController.name);

  constructor(private readonly sku: SkuService) {}

  /** 公开:返回 SKU 精简 manifest(供 website 同步使用,无敏感字段)
   *  - 只返公开字段:sku/modelName/family/capacity/voltage/chemistry/cycles
   *  - 不含 serial/batchId/QR signature/warranty userId(与 admin/裂开解耦)
   *  - 带 SKU_IMAGE_SLUG_MAP 环境变量可选映射到 brand 站图片 slug(默认原样返回) */
  @Public()
  @Get('manifest')
  @ApiOperation({ summary: 'Get public SKU manifest (for website sync)' })
  async manifest(): Promise<{
    ok: true;
    generatedAt: string;
    count: number;
    items: Array<{
      sku: string;
      id: string;
      modelName: string;
      family: string;
      capacity: string;
      voltage: string;
      chemistry: string;
      cycles: string;
      imageSlug: string;
      warrantyMonthsWhole: number;
      // v1.4 P2-3:商品库同步字段
      description: string;
      imageUrls: string[];
      videoTrailerUrl: string;
      guidePriceCents: number | null;
      guidePriceCurrency: string;
      guidePriceNote: string;
    }>;
  }> {
    const rows = (this.sku as any).db.all(
      `SELECT id, sku, modelName, family, capacity, voltage, chemistry, cycles, warrantyMonthsWhole,
              description, imageUrls, videoTrailerUrl,
              guidePriceCents, guidePriceCurrency, guidePriceNote
       FROM Sku ORDER BY createdAt ASC`,
    ) as Array<{
      id: string;
      sku: string;
      modelName: string;
      family: string;
      capacity: string;
      voltage: string;
      chemistry: string;
      cycles: string;
      warrantyMonthsWhole: number;
      description: string | null;
      imageUrls: string | null;
      videoTrailerUrl: string | null;
      guidePriceCents: number | null;
      guidePriceCurrency: string | null;
      guidePriceNote: string | null;
    }>;
    const slugMap = parseSlugMap(process.env.SKU_IMAGE_SLUG_MAP);
    const items = rows.map((r) => {
      const urls = parseStringArray(r.imageUrls);
      if (r.imageUrls && urls.length === 0) {
        this.log.warn(`SKU ${r.id} imageUrls 列损坏或非数组,已降级返回空数组`);
      }
      return {
        sku: r.sku,
        id: r.id,
        modelName: r.modelName,
        family: r.family,
        capacity: r.capacity,
        voltage: r.voltage,
        chemistry: r.chemistry,
        cycles: r.cycles,
        imageSlug: slugMap[r.sku] ?? defaultImageSlug(r.sku),
        warrantyMonthsWhole: r.warrantyMonthsWhole,
        description: r.description ?? '',
        imageUrls: urls,
        videoTrailerUrl: r.videoTrailerUrl ?? '',
        guidePriceCents: r.guidePriceCents,
        guidePriceCurrency: r.guidePriceCurrency ?? 'BDT',
        guidePriceNote: r.guidePriceNote ?? '',
      };
    });
    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      count: items.length,
      items,
    };
  }

  /** 公开:根据 id 查 SKU + 二维码签名(前端扫码页用) */
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