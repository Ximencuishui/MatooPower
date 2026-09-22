import { Module } from '@nestjs/common';
import { QrBatchController } from './qr-batch.controller';
import { QrBatchService } from './qr-batch.service';
import { StorageModule } from '../storage/storage.module';
import { SkuModule } from '../sku/sku.module';

@Module({
  imports: [StorageModule, SkuModule],
  controllers: [QrBatchController],
  providers: [QrBatchService],
})
export class QrBatchModule {}