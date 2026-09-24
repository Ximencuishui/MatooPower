import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { TicketModule } from '../ticket/ticket.module';
import { DeviceModule } from '../device/device.module';
import { SkuModule } from '../sku/sku.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TicketModule, DeviceModule, SkuModule, AuditModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}