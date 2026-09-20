import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { DealerModule } from './modules/dealer/dealer.module';
import { DeviceModule } from './modules/device/device.module';
import { SkuModule } from './modules/sku/sku.module';
import { TicketModule } from './modules/ticket/ticket.module';
import { WarrantyModule } from './modules/warranty/warranty.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { DbModule } from './common/db/db.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DbModule,
    AuthModule,
    SkuModule,
    TicketModule,
    WarrantyModule,
    DeviceModule,
    AdminModule,
    DealerModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}