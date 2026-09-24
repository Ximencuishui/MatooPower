import { ArrayMaxSize, IsArray, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export const PART_FAMILIES = ['cell', 'bms', 'charger', 'cable', 'accessory'] as const;
export type PartFamily = (typeof PART_FAMILIES)[number];

export class CreatePartDto {
  @IsString()
  sku!: string;

  @IsString()
  name!: string;

  @IsString()
  modelName!: string;

  @IsIn(PART_FAMILIES as unknown as string[])
  family!: PartFamily;

  @IsOptional()
  @IsString()
  capacity?: string;

  @IsOptional()
  @IsString()
  voltage?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  compatibleSkus?: string[];

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  imageUrls?: string[];

  @IsNumber()
  @Min(0)
  priceCents!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number;
}

export class UpdatePartDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() modelName?: string;
  @IsOptional() @IsIn(PART_FAMILIES as unknown as string[]) family?: PartFamily;
  @IsOptional() @IsString() capacity?: string;
  @IsOptional() @IsString() voltage?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) compatibleSkus?: string[];
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) imageUrls?: string[];
  @IsOptional() @IsNumber() @Min(0) priceCents?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsNumber() @Min(0) stock?: number;
  @IsOptional() @IsNumber() active?: number;
}

export class CreatePartOrderItemDto {
  @IsString()
  partId!: string;

  @IsNumber()
  @Min(1)
  quantity!: number;
}

export class CreatePartOrderDto {
  @IsOptional() @IsString() contactPhone?: string;
  @IsOptional() @IsString() shipName?: string;
  @IsOptional() @IsString() shipCountry?: string;
  @IsOptional() @IsString() shipCity?: string;
  @IsOptional() @IsString() shipAddress?: string;
  @IsOptional() @IsString() note?: string;
  /** 演示期 H5 默认 'h5',dealer 工作台提交则为 'dealer' */
  @IsOptional() @IsIn(['h5', 'dealer'] as unknown as string[]) source?: 'h5' | 'dealer';

  @IsArray()
  items!: CreatePartOrderItemDto[];
}
