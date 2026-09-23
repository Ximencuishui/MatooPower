import { IsDateString, IsInt, IsOptional, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator';

/** 批次号格式：BATCH-YYYYQn-NNN 例 BATCH-2026Q3-001 */
const BATCH_CODE_REGEX = /^BATCH-\d{4}Q[1-4]-\d{3,6}$/;

/** 国家 ISO 3166-1 alpha-2 */
const COUNTRY_REGEX = /^[A-Z]{2}$/;

export class CreateSkuBatchDto {
  @IsString()
  @Matches(BATCH_CODE_REGEX, { message: 'batchCode 格式：BATCH-2026Q3-001（季度+3-6 位序号）' })
  batchCode!: string;

  @IsDateString({}, { message: 'mfgDate 必须是 ISO 日期字符串' })
  mfgDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  factory?: string;

  @IsOptional()
  @IsString()
  @Matches(COUNTRY_REGEX, { message: 'destinationCountry 必须是 ISO 3166-1 alpha-2（两位大写字母）' })
  destinationCountry?: string;

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'totalQuantity 至少 1' })
  totalQuantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class UpdateSkuBatchDto {
  @IsOptional()
  @IsString()
  @Matches(BATCH_CODE_REGEX)
  batchCode?: string;

  @IsOptional()
  @IsDateString()
  mfgDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  factory?: string;

  @IsOptional()
  @IsString()
  @Matches(COUNTRY_REGEX)
  destinationCountry?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  totalQuantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** 列表查询参数（由 controller 的 @Query 接收，全部可选） */
export class ListSkuBatchesQuery {
  @IsOptional()
  @IsString()
  @MinLength(1)
  q?: string;

  @IsOptional()
  page?: string;

  @IsOptional()
  pageSize?: string;
}