import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });
  const port = Number(process.env.PORT ?? 3001);
  const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';

  // CORS
  app.enableCors({
    origin: [webOrigin, 'http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // 全局校验
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

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
  Logger.log(
    `🚀 Matoo Power API listening on http://localhost:${port}\n` +
      `   CORS: ${webOrigin}\n` +
      `   OpenAPI: http://localhost:${port}/api`,
    'Bootstrap',
  );
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});