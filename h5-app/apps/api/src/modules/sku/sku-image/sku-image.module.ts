import { Module } from '@nestjs/common';
import { StorageModule } from '../../storage/storage.module';
import { SkuImageController } from './sku-image.controller';
import { SkuImageService } from './sku-image.service';

@Module({
  imports: [StorageModule],
  controllers: [SkuImageController],
  providers: [SkuImageService],
  exports: [SkuImageService],
})
export class SkuImageModule {}