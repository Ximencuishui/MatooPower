import { IsString, MinLength } from 'class-validator';

export class BindDeviceDto {
  @IsString()
  @MinLength(3)
  skuId!: string;
}