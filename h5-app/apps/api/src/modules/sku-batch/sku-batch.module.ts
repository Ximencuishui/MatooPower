import { Module } from '@nestjs/common';
import { SkuBatchController } from './sku-batch.controller';
import { SkuBatchService } from './sku-batch.service';

@Module({
  controllers: [SkuBatchController],
  providers: [SkuBatchService],
})
export class SkuBatchModule {}