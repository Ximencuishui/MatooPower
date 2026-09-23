import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuditModule } from './modules/audit/audit.module';
import { DealerModule } from './modules/dealer/dealer.module';
import { DeviceModule } from './modules/device/device.module';
import { SkuModule } from './modules/sku/sku.module';
import { SkuBatchModule } from './modules/sku-batch/sku-batch.module';
import { SkuDocumentModule } from './modules/sku-document/sku-document.module';
import { QrBatchModule } from './modules/qr-batch/qr-batch.module';
import { StorageModule } from './modules/storage/storage.module';
import { TicketModule } from './modules/ticket/ticket.module';
import { WarrantyModule } from './modules/warranty/warranty.module';
import { PublicInquiryModule } from './modules/public-inquiry/public-inquiry.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AppThrottlerGuard } from './common/guards/app-throttler.guard';
import { AuditInterceptor } from './modules/audit/audit.interceptor';
import { DbModule } from './common/db/db.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // P0-5 全局限流 100 req/min/IP（guard 在 main.ts 注册,测试环境不注册 → e2e 不受影响；
    // 敏感端点如 OTP 在 auth.controller 用 @Throttle 单独收紧）
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    // P0-5 pino 结构化日志（test 环境 silent,避免 e2e 刷屏；
    // 绝不记录 Authorization/Cookie 头）
    LoggerModule.forRoot({
      pinoHttp: {
        level:
          process.env.NODE_ENV === 'test'
            ? 'silent'
            : (process.env.PINO_LOG_LEVEL ?? 'info'),
        redact: ['req.headers.authorization', 'req.headers.cookie'],
        autoLogging: {
          ignore: (req) => /^\/api(\/?$|-json)/.test(req.url ?? ''),
        },
        transport:
          process.env.NODE_ENV === 'test'
            ? undefined
            : {
                target: 'pino-pretty',
                options: { singleLine: true, translateTime: 'HH:MM:ss' },
              },
      },
    }),
    DbModule,
    StorageModule,
    AuthModule,
    AuditModule,
    SkuModule,
    SkuBatchModule,
    SkuDocumentModule,
    QrBatchModule,
    TicketModule,
    WarrantyModule,
    DeviceModule,
    AdminModule,
    DealerModule,
    // v1.4 T-2d X2:website 询盘 → h5-app 工单对接的公开接收端点
    PublicInquiryModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}