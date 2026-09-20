import { Module } from '@nestjs/common';
import { DealerController } from './dealer.controller';
import { DealerService } from './dealer.service';

@Module({
  controllers: [DealerController],
  providers: [DealerService],
})
export class DealerModule {}