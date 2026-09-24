import { Module } from '@nestjs/common';
import { DealerController } from './dealer.controller';
import { DealerService } from './dealer.service';
import { DealerAdminController } from './dealer-admin.controller';
import { DealerAdminService } from './dealer-admin.service';
import { DealerPickupModule } from '../dealer-pickup/dealer-pickup.module';

@Module({
  imports: [DealerPickupModule], // v1.5 #P0-3 + #P1-8 闭环:bulkActivate 完成后反查 DealerPickupItem 并标记 activated=1
  controllers: [DealerController, DealerAdminController],
  providers: [DealerService, DealerAdminService],
})
export class DealerModule {}