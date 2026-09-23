// T6 Sentry 接入：仅当 SENTRY_DSN 有值时初始化（空 DSN 完全 no-op）
// - 本项目不引入 @sentry/nestjs（避免再加一依赖）：
//   Sentry.init 自带 process.on('uncaughtException') + 'unhandledRejection' 监听，覆盖 90% panic 场景
// - NestJS 业务异常由 controller try/catch + 全局 filter 处理（不发 Sentry，避免 4xx 噪声）
//   如需 NestJS 全局异常上报，下批评估引入 @sentry/nestjs 后再加 setupNestErrorHandler
import * as Sentry from '@sentry/node';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
    sendDefaultPii: false,
    environment: process.env.NODE_ENV ?? 'development',
    // 给 api 服务独立 release（区别于 web）
    release: process.env.SENTRY_RELEASE ?? `matoo-api@${process.env.npm_package_version ?? '0.1.0'}`,
  });
}

// 重导出供 main.ts 主动调用 Sentry.captureException 等
export { Sentry };