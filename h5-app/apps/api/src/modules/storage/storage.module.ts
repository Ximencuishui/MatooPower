import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { LocalStorageDriver } from './drivers/local.driver';
import { STORAGE_DRIVER } from './drivers/storage.driver';

@Global()
@Module({
  providers: [
    { provide: STORAGE_DRIVER, useClass: LocalStorageDriver },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}