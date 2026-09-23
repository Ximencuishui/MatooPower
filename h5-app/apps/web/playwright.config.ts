// T4 Playwright E2E 基线
// - 双 webServer 真实联通：web(3100, next build && next start) + api(3101, node dist/src/main.js)
// - 测试库：固定路径 os.tmpdir()/matoo-pw-e2e.db；api 自身 spawn 前置 pw-db-reset.cjs
//   （删库+迁移+播种）——不依赖 globalSetup（其与 webServer 存在启动竞态：api 先打开旧库会
//   锁住文件导致删库静默失败、旧数据跨 run 残留）
// - workers: 1 串行：共享单 DB + OTP 读库时序最稳
// - NODE_ENV=test：api 端 AppThrottlerGuard 放行（OTP 5/min 不误伤）/ pino silent / cookie secure=false
// - QR_HMAC_SECRET 必须与 pw-db-reset.cjs 播种时一致（demo QR 签名校验）
import * as os from 'os';
import * as path from 'path';
import { defineConfig } from '@playwright/test';

const API_PORT = 3101;
const WEB_PORT = 3100;
const TEST_DB = path.join(os.tmpdir(), 'matoo-pw-e2e.db');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    // 移动端 H5：iPhone 12/13 逻辑尺寸 + 2x 像素比（截图基线清晰）
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: 'zh-CN',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // 浏览器通道：本机用系统 Edge（ms-playwright CDN 在部分网络卡死，0 字节挂起）；
    // CI(ubuntu) 走默认 chromium（playwright install --with-deps 正常下载）
    channel: process.env.CI ? undefined : 'msedge',
  },
  webServer: [
    {
      // 前置 pw-db-reset：删旧库+迁移+播种（无锁时机，消除跨 run 残留竞态），随后启动 api
      command: `node scripts/pw-db-reset.cjs ${TEST_DB} && node dist/src/main.js`,
      cwd: '../api',
      port: API_PORT,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        ...process.env,
        // 固定路径（与 pw-db-reset.cjs / helpers.ts 同公式）
        DATABASE_URL: `file:${TEST_DB}`,
        PORT: String(API_PORT),
        WEB_ORIGIN: `http://localhost:${WEB_PORT}`,
        JWT_SECRET: 'pw-test-jwt-secret',
        JWT_EXPIRES_IN: '7d',
        QR_HMAC_SECRET: 'pw-test-hmac-secret',
        OTP_TTL_SECONDS: '300',
        NODE_ENV: 'test',
      },
    },
    {
      // NEXT_PUBLIC_API_BASE 是构建期 process polyfill 内联值（运行时注入无效）：
      // 必须在本 webServer 命令内 build（继承下方 env）再 start，否则前端打到 3001
      command: `npx next build && npx next start -p ${WEB_PORT}`,
      port: WEB_PORT,
      reuseExistingServer: false,
      timeout: 300_000,
      env: {
        ...process.env,
        // client.ts 默认 http://localhost:3001 → build 时内联为测试 api，否则前端打到日常开发端口
        NEXT_PUBLIC_API_BASE: `http://localhost:${API_PORT}`,
      },
    },
  ],
});