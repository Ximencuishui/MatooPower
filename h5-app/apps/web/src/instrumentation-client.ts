// T6 Sentry 浏览器客户端：仅当 NEXT_PUBLIC_SENTRY_DSN 有值时初始化
// - 空 DSN → 完全 no-op（开发/无 Sentry 项目时静默，不产生任何网络/SDK 噪声）
// - DSN 通过 Next.js 构建期内联进 process polyfill（运行 env 注入无效，与 NEXT_PUBLIC_API_BASE 同源坑）
//   → 必须在 .env.production 或 CI 注入 NEXT_PUBLIC_SENTRY_DSN 后 next build
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // 生产 10% trace 采样，开发全采样（避免 SDK 噪声调试）
    tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
    // Session Replay：10% 常规会话 / 100% 出错时
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    integrations: [Sentry.replayIntegration()],
    // 关闭 PII 默认收集（本项目含手机号/邮箱等敏感字段）
    sendDefaultPii: false,
  });
}