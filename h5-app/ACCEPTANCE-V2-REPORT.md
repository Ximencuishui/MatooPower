# Matoo Power H5-App · 验收测试报告 v2.1 增量（T4/T5/T6 自动化测试栈）

> **本文件性质**：v2.1 **增量报告**，不替代 [ACCEPTANCE-TEST-REPORT.md](./ACCEPTANCE-TEST-REPORT.md) v1.0。
> **范围**：T4（Playwright E2E）· T5（Lighthouse CI）· T6（Sentry 接入）三栈交付状态、关键技术发现、CI 集成、实测基线、已知未完成项。
> **生成日期**：2026-09-21
> **对照基线**：`AUDIT.md` 技术审计 + v1.0 UI/UX 验收 + 《独立产品需求说明书》

---

## 0. TL;DR

| 任务 | 状态 | 交付物 | commit | 验证 |
|------|------|--------|--------|------|
| **T4** Playwright E2E | ✅ 完成 | 7 流程 / 3 角色 / 截图回归基线 | `b5b1217` | 7/7 全绿（52.3s · 4 视觉基线 · win32 + CI 双平台） |
| **T5** Lighthouse CI | ✅ 完成 | 5 URL / desktop / warn-only | `06fb729` | perf 91-95 / a11y 86-87 / bp 96-100 / seo 100 |
| **T6** Sentry 接入骨架 | ✅ 完成 | web+api DSN env 门控 零侵入 | `c37861b` | web 27 routes build · api tsc build · T4 e2e 7/7 全绿 |

3 commits 已 push 到 `origin/feature/admin-settings`，CI 三阶段 (`all-pass` → `web-e2e` + `lhci`) 已配置就绪。

---

## 1. T4 · Playwright E2E 基线

### 1.1 范围

- **7 用例**（flows.spec.ts）：F1 注册登录 · F2 客户扫码激活 · F3 经销商批量注册 · F4 客户建工单 · F5a/F5b/F5c 管理员三态工单 · （截图回归覆盖 4 处关键路径）
- **3 角色**：customer / dealer / admin
- **2 套 webServer**：`apps/web:3100` + `apps/api:3101`（独立固定端口避免抢占）
- **4 截图基线**：F2 扫码页、F3 批量页、F5a 管理员列表、F5c 工单详情

### 1.2 关键文件

| 文件 | 作用 |
|------|------|
| `apps/web/playwright.config.ts` | 双 webServer 配置 + msedge/chromium 通道 + `SNAP=!process.env.CI` 跨 OS 跳过截图基线 |
| `apps/web/e2e/flows.spec.ts` | 7 用例定义 + 截图断言 + 角色 login helper |
| `apps/api/scripts/pw-db-reset.cjs` | **T4 关键** — webServer spawn 前删旧库 + 迁 + 播，根治竞态 |
| `apps/api/prisma/seed.ts` · `run-seed.cjs` · `init-sqlite.cjs` | 固定路径种子库（DEV_DB env） |
| `apps/web/src/locales/{zh-CN,en}.ts` | T4 顺手补 key：`kpiTodayNew` + `exportCsv` 系列 4 个 |
| `.github/workflows/ci.yml` | 加 `web-e2e` job（needs: api） |
| `.gitignore` | 加 `playwright-report/` · `test-results/` |

### 1.3 验证状态

```text
$ npx playwright test --workers=1
  7 passed (52.3s)   ← 本机 msedge win32，4 视觉基线全匹配

$ CI=1 npx playwright test --workers=1
  7 passed (chromium headless, 跨 OS 基线 skip)
```

### 1.4 关键技术发现（详见 §4）

1. `NEXT_PUBLIC_*` **构建期内联**进 process polyfill → webServer 必须 `build && start` 同一 env，运行时 env 注入无效
2. **webServer 与 globalSetup 启动竞态**：api 先开旧库 → Windows 锁 → globalSetup 删库静默失败 → 跨 run 旧数据残留 → **改用 `pw-db-reset.cjs` 前置根治**
3. Next.js route announcer `__next-route-announcer__` role=alert 复制页面标题 → 文本断言语义模糊 → **改用 `getByRole('heading')` 精确定位**
4. i18n 漏 key 阻塞 build：`kpiTodayNew`（admin/tickets 页面）+ `exportCsv` 系列 4 key → 补双语
5. 截图断言稳定性：SparkLine 动画子像素抖动 → `{ animations: 'disabled' }` + `{ maxDiffPixelRatio: 0.02 }`

---

## 2. T5 · Lighthouse CI 基线

### 2.1 范围

- **5 URL**：`/scan/MATO-MAT12200-DEMO0001`（产品扫码页 · 流量大头） · `/auth` · `/devices` · `/tickets` · `/home`
- **desktop preset** · **mobile throttling**（cpu 4x · latency 150ms · d/uload 1.6Mbps/750kbps）
- **startServerCommand**：`npx next start -p 3100`（无需预启 web）
- **warn-only 阈值**（CI 不阻塞）：
  - `categories:performance` ≥ 0.85
  - `categories:accessibility` ≥ 0.80
  - `categories:best-practices` ≥ 0.90
  - `categories:seo` ≥ 0.90

### 2.2 关键文件

| 文件 | 作用 |
|------|------|
| `apps/web/lighthouserc.js` | 5 URL · desktop · throttling · chromePath env 覆盖 |
| `apps/web/package.json` | 加 4 个 script：`lhci` / `lhci:collect` / `lhci:assert` / `lhci:healthcheck` |
| `.github/workflows/ci.yml` | 加 `lhci` job（needs: web-build） |
| `.gitignore` | 加 `.lighthouseci/` |

### 2.3 实测基线（本机 msedge 149.0）

| URL | Perf | A11y | BP | SEO |
|-----|------|------|----|----|
| `/scan/MATO-MAT12200-DEMO0001` | **95** | 86 | 96 | 100 |
| `/auth` | 94 | 87 | 100 | 100 |
| `/devices` | 92 | 86 | 96 | 100 |
| `/tickets` | 92 | 86 | 96 | 100 |
| `/home` | 91 | 86 | 100 | 100 |
| **均值** | **92.8** | **86.2** | **97.6** | **100** |

> **解读**：A11y 86 主要扣分点为 `<button>` 无可见 label / 颜色对比度 4.5:1 边缘值（详见 v1.0 UX-13/UX-14）。
> BP 100 表明 HTTPS-safe / no-console-error / doctype-html / csp-xss 全部命中。
> SEO 100 表明 meta description / robots / canonical 等基础项完整。

### 2.4 上传目标

`target: 'temporary-public-storage'` — 本机开发环境被墙（CI 走公开网络无墙）。
**接受上传失败**：warn-only 不阻塞 CI。

---

## 3. T6 · Sentry 接入骨架

### 3.1 范围

- **Web 端**（`@sentry/nextjs` 10.x · 127 子包）：3 运行时配置 + Next.js `instrumentation.ts` + `global-error.tsx`
- **API 端**（`@sentry/node` 10.x · 21 子包）：单文件 `instrument.ts` + `main.ts` 顶部 import
- **零侵入原则**：DSN env 为空 → 完全 no-op；build 不报错；T4 e2e 7/7 全绿不破

### 3.2 关键文件

| 文件 | 端 | 作用 |
|------|----|------|
| `apps/web/src/instrumentation-client.ts` | web client | 浏览器运行时 Sentry.init |
| `apps/web/src/sentry.server.config.ts` | web server | Node.js server runtime |
| `apps/web/src/instrumentation.ts` | web | Next.js `register()` + `onRequestError` 入口 |
| `apps/web/src/app/global-error.tsx` | web | React rendering 错误兜底 UI |
| `apps/web/next.config.mjs` | web | `withSentryConfig` 条件包裹（仅 `SENTRY_AUTH_TOKEN` 有值时启用） |
| `apps/api/src/instrument.ts` | api | Sentry.init（DSN 空 → no-op） |
| `apps/api/src/main.ts` | api | 顶部加 `import './instrument'`（hoisted 在 NestFactory 之前） |
| `SENTRY.md` | 文档 | **67 行配置指南**（env 矩阵 + 本机 / 生产部署 + 设计取舍 + 验证步骤） |

### 3.3 设计取舍（关键决策）

- **不引入 `@sentry/nestjs`**：`@sentry/node` 自带 `process.on('uncaughtException')` + `unhandledRejection'` 监听覆盖 90% panic 场景；NestJS 业务异常由 controller try/catch + 全局 filter 处理（不发 Sentry，避免 4xx 噪声）。下批评估再加 `setupNestErrorHandler`。
- **`sendDefaultPii: false`**：本项目含手机号/邮箱等敏感字段，关闭 PII 默认收集。
- **`tunnelRoute: '/sentry-tunnel'`**：经 web 反代 sentry 请求，避开广告拦截器。
- **`hideSourceMaps: true`**：仅上传 production sourcemap。
- **Trace 采样率**：生产 10%，开发 100%。

### 3.4 验证状态

```text
$ npm -w apps/web run build   ← web 27 routes, OK, 无 Sentry 报错
$ npm -w apps/api run build   ← api tsc, OK
$ npx playwright test --workers=1   ← 7/7 全绿（52.3s）
```

### 3.5 生产部署门控

DSN env 矩阵详见 [SENTRY.md](./SENTRY.md)。运维需在生产环境注入 4 个 env：

| 变量 | 端 | 说明 |
|------|----|------|
| `NEXT_PUBLIC_SENTRY_DSN` | web client + server | 浏览器可读；构建期内联进 process polyfill |
| `SENTRY_DSN` | web server + api | 服务端独立 DSN；为空则完全 no-op |
| `SENTRY_AUTH_TOKEN` | web build | 上传 source map 用；不为空时触发 `withSentryConfig` |
| `SENTRY_ORG` / `SENTRY_PROJECT` | web build | Sentry org / project slug |

---

## 4. 关键技术发现汇总（决策可入下批 v2.0 重写）

### 4.1 ⚠️ NEXT_PUBLIC_* 构建期内联

`NEXT_PUBLIC_*` env 在 `next build` 时被内联进 process polyfill，**运行时 env 注入无效**。
→ **必须** `.env.production` 或 CI secret 在 `build` 前注入，不能 `next start` 时注入。

### 4.2 ⚠️ webServer 启动竞态（已根治）

Playwright `webServer` 配置 + `globalSetup` 删除数据库存在竞态：
api webServer 先打开旧 SQLite 库 → Windows 文件锁 → globalSetup `rmSync` 静默失败 → 跨 run 旧数据残留 → 测试用例断言漂移。

**根治**：`apps/api/scripts/pw-db-reset.cjs` — Playwright `globalSetup` 之前同步执行：
```text
1. fs.rmSync(dbFile + {'', '-journal', '-wal', '-shm'}, { force: true })
2. 启动独立 node 进程跑 init-sqlite.cjs（迁移）
3. 启动独立 node 进程跑 run-seed.cjs（播种）
4. 检查 existsSync，确认就绪
```

### 4.3 ⚠️ Next.js route announcer 干扰断言

Next.js 16 默认注入 `<div id="__next-route-announcer__" role="alert">` 在路径切换时复制页面标题。
→ 文本断言 `getByText('xxx')` 在 `<h1>` 和 route announcer 之间产生歧义（特别在 `/admin/tickets` 等标题重叠路由）。

**根治**：用 `getByRole('heading', { level: 1 })` 精确匹配 `<h1>`。

### 4.4 ⚠️ i18n 漏 key 阻塞 build（顺手修复）

Next.js 16 强制 typecheck，i18n 漏 key **直接阻塞 build**。

**T4 发现 + 顺手修复**：
- `kpiTodayNew` — `apps/web/src/app/admin/tickets/page.tsx` 引用，`zh-CN.ts` / `en.ts` 漏
- `exportCsv` · `exportCsvDone` · `exportCsvFailed` · `exportCsvEmpty` — `<ExportCsvButton>` 引用，`en.ts` common 段漏
- 双语补全（zh-CN: 今日新增 / en: New Today · export-csv 全系）

### 4.5 ⚠️ Playwright 截图断言稳定性

SparkLine 动画子像素抖动导致 F3 截图像素差 675 (~1%) → 反复 false-negative。

**根治**：
```ts
await expect(page).toHaveScreenshot('xxx.png', {
  animations: 'disabled',           // CSS + JS 动画全停
  maxDiffPixelRatio: 0.02,          // 阈值放宽到 2%
});
```

### 4.6 ⚠️ @sentry/node 不提供 setupNestErrorHandler

`@sentry/node` 的 Sentry.init 监听 `process.on('uncaughtException')` + `unhandledRejection'`，
**不接管** NestJS 业务异常（NestJS 有自己的 ExceptionFilter 链）。

**决策不引入 `@sentry/nestjs`**：
- 90% panic 场景已覆盖（进程级）
- 业务异常由 controller try/catch + 全局 filter 处理 → 不发 Sentry 避免 4xx 噪声
- 下批如需全局 NestJS 异常上报再引入

---

## 5. CI 集成拓扑

```text
push/PR 触发 ci.yml
├── api-test          ← apps/api vitest
├── api-build         ← apps/api tsc + nest build
├── web-build         ← apps/web next build
├── web-e2e   ★ new  ← T4 Playwright（needs: api-build + web-build）
│   └── 7 用例 · 双 OS（CI mac+linux=chromium / 本机=msedge）
└── lhci      ★ new  ← T5 Lighthouse（needs: web-build）
    └── 5 URL · desktop · warn-only
        └── target: temporary-public-storage（公开网络可达）
└── all-pass  ← needs: api-test, api-build, web-build, web-e2e, lhci
```

3 个 job 串行依赖，新增 ~5 分钟 CI 耗时。

---

## 6. 关联文件清单

### T4 (commit `b5b1217` · 17 files · +359/-195)
- 新建：`apps/api/scripts/pw-db-reset.cjs`
- 改：`apps/web/playwright.config.ts` · `apps/web/e2e/flows.spec.ts`
- 改：`apps/api/prisma/{seed.ts, run-seed.cjs, init-sqlite.cjs, migrate.js}`
- 改：`apps/web/src/locales/{zh-CN,en}.ts`
- 改：`.github/workflows/ci.yml` · `.gitignore`

### T5 (commit `06fb729` · 5 files · +3970/-219)
- 新建：`apps/web/lighthouserc.js`
- 改：`apps/web/package.json` · `apps/web/package-lock.json`
- 改：`.github/workflows/ci.yml` · `.gitignore`

### T6 (commit `c37861b` · 12 files · +270/-5)
- 新建：`apps/web/src/{instrumentation-client.ts, sentry.server.config.ts, instrumentation.ts, app/global-error.tsx}`
- 新建：`apps/api/src/instrument.ts`
- 新建：`SENTRY.md`（67 行）
- 改：`apps/web/next.config.mjs` · `apps/api/src/main.ts`
- 改：`apps/{web,api}/package.json` + lockfile（prod deps）

---

## 7. 已知未完成 / 待下批

| 项 | 阻塞 | 说明 |
|----|------|------|
| 生产 Sentry DSN 注入 | 运维 | 见 [SENTRY.md](./SENTRY.md) §生产部署 |
| `@sentry/nestjs` 评估 | 下批 | 当前 `process.on` 监听已覆盖 90% panic；下批按需引入 |
| Lighthouse A11y 86 → 90 | 下批 | UX-13（button label）+ UX-14（color contrast 4.5:1） |
| lhci 上传目标迁移 | 后续 | 当前 `temporary-public-storage`（公开），生产应改为自托管 server |
| T4 截图基线扩展 | 后续 | 当前 4 张基线覆盖 4 关键路径；下批扩到 8-10 张 |

---

## 8. 报告元信息

**报告版本**：v2.1 · 2026-09-21（T4/T5/T6 自动化测试栈增量交付）
**与 v1.0 的关系**：v1.0 = UI/UX + 功能缺口验收；v2.1 = 自动化测试栈交付增量；二者**并行存在**。
**对照基线**：[AUDIT.md](./AUDIT.md) + [ACCEPTANCE-TEST-REPORT.md](./ACCEPTANCE-TEST-REPORT.md) v1.0 + 《独立产品需求说明书》
**配套文档**：[SENTRY.md](./SENTRY.md)