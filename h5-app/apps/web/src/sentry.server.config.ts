// T6 Sentry 服务端（Node.js runtime）：仅当 SENTRY_DSN 有值时初始化
// - 优先级 SENTRY_DSN > NEXT_PUBLIC_SENTRY_DSN（服务端可读两套 DSN，浏览器端只能读 NEXT_PUBLIC_）
// - 空 DSN → 完全 no-op
// - 不引入 @sentry/nestjs（避免再加一依赖）：进程级 panic（uncaughtException / unhandledRejection）
//   通过 Sentry.init 自带监听；NestJS 业务异常由 controller try/catch + filter 处理
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
    sendDefaultPii: false,
    // 与部署环境一致（production / staging / development）
    environment: process.env.NODE_ENV ?? 'development',
  });
}