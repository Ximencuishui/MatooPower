import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';

/** Warranty 当前允许的状态(DB 用 String,枚举在此收敛) */
export const WARRANTY_STATUS_VALUES = ['active', 'pending', 'expired', 'rejected'] as const;
export type WarrantyStatus = (typeof WARRANTY_STATUS_VALUES)[number];

/** 列表筛选 — 不允许 UI 自由字符串,防止 #P0-1 类似 'review' 静默 0 结果 */
export class ListWarrantiesQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  pageSize?: string;

  @IsOptional()
  @IsIn(WARRANTY_STATUS_VALUES as unknown as string[])
  status?: WarrantyStatus;
}

/** 单条审核 */
export class ReviewWarrantyDto {
  @IsIn(WARRANTY_STATUS_VALUES as unknown as string[])
  status!: WarrantyStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * 批量审核 — 支持三种形态(向后兼容):
 *  ① 旧版统一模式:{ ids: string[]; status: WarrantyStatus; notes?: string }
 *  ② 新版逐条模式:{ items: Array<{ id, status?, notes? }>; notes?: string }
 *     每条可省略 → 退回到全局 status/notes
 */
export class BulkReviewItemDto {
  @IsString()
  id!: string;

  @IsOptional()
  @IsIn(WARRANTY_STATUS_VALUES as unknown as string[])
  status?: WarrantyStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class BulkReviewWarrantiesDto {
  /** 旧字段(ids)与 items 至少出现一个 */
  @IsOptional()
  @IsString({ each: true })
  ids?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  // v1.5 #M3 修复:加 @ValidateNested + @Type,让 class-validator/class-transformer 进入每条 item 校验
  // 否则 items[].status / items[].id 的 @IsString/@IsIn 等装饰器不生效,可绕过 enum 白名单
  @ValidateNested({ each: true })
  @Type(() => BulkReviewItemDto)
  items?: BulkReviewItemDto[];

  @IsOptional()
  @IsIn(WARRANTY_STATUS_VALUES as unknown as string[])
  status?: WarrantyStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
