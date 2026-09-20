import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class ActivateWarrantyDto {
  @IsString()
  @MinLength(3)
  skuId!: string;

  @IsString()
  @MinLength(2)
  country!: string;

  @IsString()
  @MinLength(2)
  city!: string;

  @IsOptional()
  @IsString()
  dealerName?: string;

  @IsOptional()
  @IsString()
  invoiceNo?: string;

  @IsOptional()
  @IsDateString()
  invoiceDate?: string;

  @IsOptional()
  @IsNumber()
  invoiceAmount?: number;

  @IsOptional()
  @IsString()
  invoicePhotoUrl?: string;
}