// v1.4 P2-3:SKU 商品库扩展字段读写服务
// - updateCatalog:编辑 description/imageUrls/videoTrailerUrl/guidePrice*
// - getCatalog:读取完整商品资料(含关联的 SkuImage 列表)
// 复用现有 DbService + StorageService,不引入新基础设施
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DbService } from '../../common/db/db';
import { assertStringArray, parseStringArray } from '../../common/util/json-array';
import { UpdateSkuCatalogDto } from './entities/update-sku-catalog.dto';

export interface SkuCatalogView {
  id: string;
  sku: string;
  serial: string;
  modelName: string;
  family: string;
  // v1.4 P2-3 扩展
  description: string | null;
  imageUrls: string[];           // 反序列化后的主图 URL 数组
  videoTrailerUrl: string | null;
  guidePriceCents: number | null;
  guidePriceCurrency: string | null;
  guidePriceNote: string | null;
  catalogUpdatedAt: string | null;
  catalogUpdatedBy: string | null;
}

@Injectable()
export class SkuCatalogService {
  private readonly log = new Logger(SkuCatalogService.name);

  constructor(private readonly db: DbService) {}

  /** 单 SKU 商品资料完整视图(供后台编辑 Drawer 初始化用) */
  getCatalog(id: string): SkuCatalogView {
    const row = this.db.get<{
      id: string; sku: string; serial: string; modelName: string; family: string;
      description: string | null; imageUrls: string | null; videoTrailerUrl: string | null;
      guidePriceCents: number | null; guidePriceCurrency: string | null; guidePriceNote: string | null;
      catalogUpdatedAt: string | null; catalogUpdatedBy: string | null;
    }>(
      `SELECT id, sku, serial, modelName, family,
              description, imageUrls, videoTrailerUrl,
              guidePriceCents, guidePriceCurrency, guidePriceNote,
              catalogUpdatedAt, catalogUpdatedBy
       FROM Sku WHERE id = ?`, id);
    if (!row) throw new NotFoundException(`SKU ${id} 不存在`);
    const urls = parseStringArray(row.imageUrls);
    if (row.imageUrls && urls.length === 0) {
      this.log.warn(`SKU ${id} imageUrls 列损坏或非数组,已降级返回空数组`);
    }
    return {
      id: row.id,
      sku: row.sku,
      serial: row.serial,
      modelName: row.modelName,
      family: row.family,
      description: row.description,
      imageUrls: urls,
      videoTrailerUrl: row.videoTrailerUrl,
      guidePriceCents: row.guidePriceCents,
      guidePriceCurrency: row.guidePriceCurrency,
      guidePriceNote: row.guidePriceNote,
      catalogUpdatedAt: row.catalogUpdatedAt ? new Date(row.catalogUpdatedAt).toISOString() : null,
      catalogUpdatedBy: row.catalogUpdatedBy,
    };
  }

  /** 编辑商品资料(仅更新传入的非空字段) */
  updateCatalog(id: string, dto: UpdateSkuCatalogDto, actorUserId: string): SkuCatalogView {
    const exists = this.db.get<{ id: string }>('SELECT id FROM Sku WHERE id = ?', id);
    if (!exists) throw new NotFoundException(`SKU ${id} 不存在`);

    const sets: string[] = [];
    const params: any[] = [];
    if (dto.description !== undefined) { sets.push('description = ?'); params.push(dto.description); }
    if (dto.imageUrls !== undefined) {
      // 强校验：必须是合法 JSON 数组（防止前端 bug 或恶意 admin 写入脏数据）
      assertStringArray(dto.imageUrls, 'imageUrls');
      sets.push('imageUrls = ?'); params.push(dto.imageUrls);
    }
    if (dto.videoTrailerUrl !== undefined) { sets.push('videoTrailerUrl = ?'); params.push(dto.videoTrailerUrl || null); }
    if (dto.guidePriceCents !== undefined) { sets.push('guidePriceCents = ?'); params.push(dto.guidePriceCents); }
    if (dto.guidePriceCurrency !== undefined) {
      sets.push('guidePriceCurrency = ?');
      params.push((dto.guidePriceCurrency ?? 'BDT').toUpperCase().slice(0, 3));
    }
    if (dto.guidePriceNote !== undefined) { sets.push('guidePriceNote = ?'); params.push(dto.guidePriceNote || null); }

    if (sets.length === 0) return this.getCatalog(id);
    sets.push('catalogUpdatedAt = CURRENT_TIMESTAMP');
    sets.push('catalogUpdatedBy = ?');
    params.push(actorUserId);
    params.push(id);
    this.db.run(`UPDATE Sku SET ${sets.join(', ')} WHERE id = ?`, ...params);
    return this.getCatalog(id);
  }
}