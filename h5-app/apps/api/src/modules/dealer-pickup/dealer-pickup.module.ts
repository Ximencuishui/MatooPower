import { Module } from '@nestjs/common';
import { DealerPickupController } from './dealer-pickup.controller';
import { DealerPickupService } from './dealer-pickup.service';

@Module({
  controllers: [DealerPickupController],
  providers: [DealerPickupService],
  exports: [DealerPickupService],
})
export class DealerPickupModule {}
