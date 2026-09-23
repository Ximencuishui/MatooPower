import { Module } from '@nestjs/common';
import { SkuController } from './sku.controller';
import { SkuService } from './sku.service';
import { QrSignerService } from './qr-signer.service';
import { SkuCatalogController } from './sku-catalog.controller';
import { SkuCatalogService } from './sku-catalog.service';
import { SkuImageModule } from './sku-image/sku-image.module';

@Module({
  imports: [SkuImageModule],
  controllers: [SkuController, SkuCatalogController],
  providers: [SkuService, QrSignerService, SkuCatalogService],
  exports: [SkuService, QrSignerService, SkuCatalogService],
})
export class SkuModule {}