// T6 Sentry：先 import（hoisted）→ Sentry.init 在 module 加载期完成
// 空 DSN 时 instrument.ts 内部跳过 Sentry.init，无任何副作用
import './instrument';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import * as path from 'node:path';
import express from 'express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { SECURITY_HEADERS } from './common/security';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });
  const logger = app.get(Logger);
  const port = Number(process.env.PORT ?? 3001);
  const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';

  // P0-5 安全响应头（helmet；CSP 为 Swagger UI 放行 CDN，见 common/security.ts）
  app.use(helmet(SECURITY_HEADERS));

  // P0-8 httpOnly cookie 认证通道（jwt.strategy 从 cookie 提取 token）
  app.use(cookieParser());

  // CORS
  app.enableCors({
    origin: [
      webOrigin,
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      // Admin Console (apps/admin, 独立桌面后台)
      'http://localhost:3002',
      'http://127.0.0.1:3002',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // P0-5 全局限流在 app.module 以 APP_GUARD（AppThrottlerGuard）注册：
  // test 环境放行、生产 100 req/min/IP、敏感端点由 @Throttle 单独收紧

  // v1.3 P0:本地文件存储静态托管（与 LocalStorageDriver.getPublicUrl 一致）
  // 仅 public 文档可走此路径(扫码页 fetch PDF/视频)，admin 下载走 jwt 鉴权端点
  const storageRoot = process.env.STORAGE_LOCAL_ROOT ?? path.join(process.cwd(), 'storage');
  app.use('/storage', express.static(storageRoot, { index: false, fallthrough: true, maxAge: '7d' }));

  // 全局校验
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // P0-5 pino 接管 Nest 内部日志（OTP 等 logger.warn 输出随 pino 落盘）
  app.useLogger(logger);

  // OpenAPI / Swagger UI
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Matoo Power H5-App API')
    .setDescription('Matoo Power 独立产品 · H5-App 后端 API（演示期）')
    .setVersion('0.1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'jwt',
    )
    .addTag('auth', '账号（OTP + JWT）')
    .addTag('sku', 'SKU 主数据 + 二维码 HMAC 验签')
    .addTag('warranty', '保修激活（策略 A + C 兜底）')
    .addTag('device', '设备绑定 + 健康板 + 远程诊断')
    .addTag('ticket', '售后工单（用户 + admin）')
    .addTag('dealer', '经销商工作台')
    .addTag('admin', '运营后台（admin only）')
    .build();
  const swaggerDoc = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, swaggerDoc, {
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: 'Matoo Power API',
  });

  await app.listen(port, '0.0.0.0');
  logger.log(
    `🚀 Matoo Power API listening on http://localhost:${port}\n` +
      `   CORS: ${webOrigin}\n` +
      `   OpenAPI: http://localhost:${port}/api\n` +
      `   Security: helmet + throttler(100/min) + pino\n` +
      `   Storage: ${storageRoot} -> /storage/*`,
    'Bootstrap',
  );
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});