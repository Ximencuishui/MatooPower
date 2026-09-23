import { Module } from '@nestjs/common';
import { DealerController } from './dealer.controller';
import { DealerService } from './dealer.service';
import { DealerAdminController } from './dealer-admin.controller';
import { DealerAdminService } from './dealer-admin.service';

@Module({
  controllers: [DealerController, DealerAdminController],
  providers: [DealerService, DealerAdminService],
})
export class DealerModule {}