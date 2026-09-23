import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { TicketModule } from '../ticket/ticket.module';
import { DeviceModule } from '../device/device.module';

@Module({
  imports: [TicketModule, DeviceModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}