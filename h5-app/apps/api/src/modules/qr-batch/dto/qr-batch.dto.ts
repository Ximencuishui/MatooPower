import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CreateQrBatchDto {
  @IsOptional()
  @IsInt()
  @Min(128, { message: 'size 至少 128px' })
  @Max(1024, { message: 'size 至多 1024px' })
  size?: number;
}

export class ListQrBatchesQuery {
  @IsOptional()
  page?: string;
  @IsOptional()
  pageSize?: string;
}