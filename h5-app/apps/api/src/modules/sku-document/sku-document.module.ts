import { Module } from '@nestjs/common';
import { SkuDocumentController, PublicSkuDocumentController, SkuDocumentCsvController } from './sku-document.controller';
import { SkuDocumentService } from './sku-document.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [SkuDocumentController, PublicSkuDocumentController, SkuDocumentCsvController],
  providers: [SkuDocumentService],
  exports: [SkuDocumentService],
})
export class SkuDocumentModule {}