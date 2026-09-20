import { Module } from '@nestjs/common';
import { SkuController } from './sku.controller';
import { SkuService } from './sku.service';
import { QrSignerService } from './qr-signer.service';

@Module({
  controllers: [SkuController],
  providers: [SkuService, QrSignerService],
  exports: [SkuService, QrSignerService],
})
export class SkuModule {}