// v1.5 #P0-3:经销商提货批次 DTO
import { ArrayMaxSize, IsArray, IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateDealerPickupItemDto {
  @IsString()
  sku!: string;

  @IsString()
  @MinLength(2)
  serial!: string;
}

export class CreateDealerPickupDto {
  @IsString()
  @MinLength(1)
  shipmentInvoiceNo!: string;

  @IsDateString()
  shipmentDate!: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsArray()
  @ArrayMaxSize(500)
  items!: CreateDealerPickupItemDto[];
}
