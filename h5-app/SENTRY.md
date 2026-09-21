# Sentry 接入指南（T6）

## 概述
本项目集成 Sentry 用于生产环境错误追踪与性能监控（Traces + Session Replay）。
**默认 DSN 为空时完全 no-op**——不产生任何网络/SDK 噪声，开发环境零侵入。

## 架构
- **Web**（`@sentry/nextjs`）：三配置文件 + Next.js `instrumentation.ts` 注册
  - `src/instrumentation-client.ts` — 浏览器运行时
  - `src/sentry.server.config.ts` — Node.js server runtime
  - `src/instrumentation.ts` — Next.js 注册入口（`register()` + `onRequestError`）
  - `src/app/global-error.tsx` — React rendering 错误兜底 UI
  - `next.config.mjs` — `withSentryConfig` 条件包裹（仅 `SENTRY_AUTH_TOKEN` 有值时启用）
- **API**（`@sentry/node`）：单文件 instrument + main.ts 顶部 import
  - `src/instrument.ts` — `Sentry.init`（仅 `SENTRY_DSN` 有值）
  - `src/main.ts` — `import './instrument'`（hoisted 在 NestFactory 之前）

## 环境变量
| 变量 | 端 | 说明 | 必填 |
|------|----|------|------|
| `NEXT_PUBLIC_SENTRY_DSN` | web client + server | 浏览器可读；构建期内联进 process polyfill | 生产必填 |
| `SENTRY_DSN` | web server + api | 服务端独立 DSN；为空则完全 no-op | 生产可选 |
| `SENTRY_AUTH_TOKEN` | web build | 上传 source map 用；不为空时触发 `withSentryConfig` | 生产必填 |
| `SENTRY_ORG` | web build | Sentry 组织 slug | 生产必填 |
| `SENTRY_PROJECT` | web build | Sentry 项目 slug | 生产必填 |
| `SENTRY_RELEASE` | api | 自定义 release 标识 | 可选 |

> ⚠️ **关键坑**：`NEXT_PUBLIC_*` 是构建期内联进 process polyfill，运行时 env 注入无效。
> → 必须在 `.env.production` 或 CI 注入后 `next build`，不能 next start 时注入。

## 本机开发
无需任何 DSN，所有 Sentry 调用都是 no-op。
```bash
# 直接 build + run，Sentry 静默
npm run build
npm run start
```

## 生产部署
```bash
# Web：构建期注入（CI secret / .env.production）
NEXT_PUBLIC_SENTRY_DSN=https://...@o...ingest.sentry.io/...
SENTRY_AUTH_TOKEN=sntrys_...
SENTRY_ORG=matoo-power
SENTRY_PROJECT=h5-app-web
npm run build && npm run start

# API：运行期注入（K8s/Docker env）
SENTRY_DSN=https://...@o...ingest.sentry.io/...
node dist/src/main.js
```

## 设计取舍
- **不引入 `@sentry/nestjs`**：`@sentry/node` 自带 `process.on('uncaughtException')` + `unhandledRejection'` 监听覆盖 90% panic 场景；NestJS 业务异常由 controller try/catch + 全局 filter 处理（不发 Sentry，避免 4xx 噪声）。如需全局异常上报，下批评估再加 `@sentry/nestjs` 的 `setupNestErrorHandler`。
- **`sendDefaultPii: false`**：本项目含手机号/邮箱等敏感字段，关闭 PII 默认收集（IP/cookies 等仍会被 Sentry 收集用于性能监控）。
- **`tunnelRoute: '/sentry-tunnel'`**：经 web 反代 sentry 请求，避开广告拦截器（推荐）。
- **`hideSourceMaps: true`**：仅上传 production sourcemap，避免 dev 噪音。
- **Trace 采样率**：生产 10%，开发 100%（避免 SDK 噪声调试）。

## 验证
1. 启动 web + api（DSN 故意留空）：build 应无 Sentry 报错；e2e 全绿
2. 注入 DSN 后：访问 `/home` 触发一次网络失败，应在 Sentry 控制台看到 event
3. CI：`web-e2e` job 不需要 DSN 也能跑（DSN 空 → no-op）

## 关联
- 验收报告 §9.1 自动化：T6 骨架已交付
- 验收报告 §10 收尾：T6 状态 = 骨架已交付（生产 DSN 接入由运维）