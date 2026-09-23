// v1.4 P2-3:后台编辑 SKU 商品资料的 DTO(class-validator 校验)
// - 只允许改"展示/营销"字段;sku/serial/batch/activated 等业务字段锁定
// - 所有字段 optional,前端只传需要改的
import { IsArray, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';

export class UpdateSkuCatalogDto {
  /** 商品资料/富文本描述 */
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  /** 主图集 JSON 字符串数组(后端仅透传 + 长度校验) */
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  imageUrls?: string;

  /** 主视频预告 URL */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  videoTrailerUrl?: string;

  /** 全局指导价(最小单位:分) */
  @IsOptional()
  @IsInt()
  @Min(0)
  guidePriceCents?: number;

  /** ISO 4217 三字母币种(例 BDT / USD / CNY),默认 BDT */
  @IsOptional()
  @IsString()
  @MaxLength(3)
  guidePriceCurrency?: string;

  /** 价格备注 */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  guidePriceNote?: string;
}

/** 单张图片元数据更新 DTO(用于 PATCH /admin/sku/:id/images/:imageId) */
export class UpdateSkuImageDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  alt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  isCover?: boolean;
}