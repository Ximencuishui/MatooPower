import { Module } from '@nestjs/common';
import { PartsController, AdminPartsController } from './parts.controller';
import { PartsService } from './parts.service';

@Module({
  controllers: [PartsController, AdminPartsController],
  providers: [PartsService],
  exports: [PartsService],
})
export class PartsModule {}
