import { IsArray, IsOptional, IsString, MinLength, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class SkuActivationItem {
  @IsString()
  @MinLength(3)
  qrId!: string;  // 完整 QR id（含 Matoo: 前缀）

  @IsString()
  @MinLength(1)
  customerPhone!: string;  // +880... 客户手机号

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  invoiceNo?: string;

  @IsOptional()
  @IsString()
  invoiceDate?: string;  // ISO date
}

export class BulkActivateDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SkuActivationItem)
  items!: SkuActivationItem[];

  @IsOptional()
  @IsString()
  shipmentInvoiceNo?: string;
}