// E2E 测试公共设施
// - 每个测试用独立的临时 SQLite DB（互不污染）
// - 启动真实 NestApplication + supertest agent

import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { execSync } from 'child_process';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

// 每个 describe 拿一个临时 db 文件
export function makeTmpDb(): string {
  return path.join(os.tmpdir(), `matoo-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.db`);
}

export function initDb(dbFile: string) {
  // 设置 ENV 让 DbService 用这个 db
  process.env.DATABASE_URL = `file:${dbFile}`;
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.JWT_EXPIRES_IN = '7d';
  process.env.QR_HMAC_SECRET = 'test-hmac-secret';
  process.env.OTP_TTL_SECONDS = '300';
  process.env.PORT = '0';

  const cwd = path.resolve(__dirname, '../..');
  execSync(`node "${path.join(cwd, 'prisma/init-sqlite.cjs')}" "${dbFile}"`, {
    env: { ...process.env },
    stdio: 'pipe',
  });
}

export function cleanDb(dbFile: string) {
  for (const ext of ['', '-journal', '-wal', '-shm']) {
    try { fs.unlinkSync(dbFile + ext); } catch {}
  }
}

export interface AppHandle {
  app: INestApplication;
  req: typeof request.SuperTestStatic;
  close: () => Promise<void>;
}

export async function startApp(): Promise<AppHandle> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication({ cors: false });
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: false,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));

  // 测试 mode 也挂 Swagger（main.ts 才有，但 startApp 跳过 main 流程）
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Matoo Power H5-App API')
    .setVersion('0.1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'jwt')
    .build();
  const swaggerDoc = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, swaggerDoc);

  await app.init();
  const req = request(app.getHttpServer());

  return {
    app,
    req,
    close: async () => { await app.close(); },
  };
}

/** 在数据库中直接读最新 OTP（用于测试） */
export function readLatestOtp(phone: string): string {
  const dbFile = process.env.DATABASE_URL!.replace(/^file:/, '');
  const out = execSync(
    `node -e "const{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[1]);const r=db.prepare(\\"SELECT code FROM OtpRequest WHERE phone=? AND consumedAt IS NULL ORDER BY createdAt DESC LIMIT 1\\").get(process.argv[2]);console.log(r?r.code:'')" "${dbFile.replace(/\\/g,'\\\\')}" "${phone}"`,
    { encoding: 'utf8' },
  ).trim();
  return out;
}

// 在调用方已有的 app 内 login（避免跨进程/跨连接问题）
export async function loginAndGetToken(phone: string): Promise<string> {
  const tmp = await startApp();
  await tmp.req.post('/auth/otp/request').send({ phone });
  await new Promise((r) => setTimeout(r, 80));
  const code = readLatestOtp(phone);
  const verify = await tmp.req.post('/auth/otp/verify').send({ phone, code });
  const token = (verify.body?.token ?? '') as string;
  await tmp.close();
  return token;
}

// 共享 app：用于需要登录 + 验证 的 test（避免 startApp 跨连接）
let _sharedApp: AppHandle | null = null;
export async function getSharedApp(): Promise<AppHandle> {
  if (!_sharedApp) {
    _sharedApp = await startApp();
  }
  return _sharedApp;
}
export async function closeSharedApp() {
  if (_sharedApp) {
    await _sharedApp.close();
    _sharedApp = null;
  }
}