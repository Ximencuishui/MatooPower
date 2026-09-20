import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export type TicketType = 'general' | 'warranty' | 'inquiry' | 'remote';
export type TicketSeverity = 'low' | 'normal' | 'high' | 'urgent';

export class CreateTicketDto {
  @IsEnum(['general', 'warranty', 'inquiry', 'remote'])
  type!: TicketType;

  @IsEnum(['low', 'normal', 'high', 'urgent'])
  severity!: TicketSeverity;

  @IsString()
  @MinLength(3)
  subject!: string;

  @IsString()
  @MinLength(5)
  description!: string;

  @IsOptional()
  @IsString()
  skuId?: string;

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;
}