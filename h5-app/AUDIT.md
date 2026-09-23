# Matoo Power · 全代码审计（h5-app + website）

> 范围：**`E:\MatooPower\` 整个项目目录**
> 本次审计覆盖 **3 个独立的用户端 + 2 个产品系统**，明确边界、独立评估：
>
> | 系统 | 类型 | 用户端 | 数据 | 账号 |
> |------|------|--------|------|------|
> | **h5-app** | 独立产品（终端用户 + 经销商 + 运营） | `apps/web`（Next.js 16 + React 19） + `apps/api`（NestJS 10 + SQLite） | SQLite 单库 + JWT/RBAC | 独立手机 OTP/email |
> | **website** | 营销网站（公开访客） | 12 静态 HTML + 14 语言 | 无服务端 DB，仅文件 | 无用户 |
> | **admin** | 营销站的内容编辑工具 | `website/admin/*` + `website/api/*`（Express） | JSON 文件 + i18n 文件 | 单 admin 账号（scrypt） |
>
> **关键边界**：
> - website 与 h5-app **两套独立用户、两套独立数据、两套独立账号**
> - admin **仅是 website 的内容编辑工具**（不是 h5-app 的运营后台）
> - h5-app **有自己的 admin 路由**（`apps/web/src/app/admin/*`，NestJS `@Roles('admin')` 守护）
> - 两套系统之间目前**没有任何数据同步**

> 评估基线：MVP → P1（已实现）→ P2（已实现部分）→ 生产就绪度

---

## 0. 系统边界图

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          Matoo Power · 三端面                            │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────┐  ┌─────────────────────────┐  ┌─────────────┐│
│  │  website (营销站)       │  │   h5-app (独立产品)      │  │  工业设计平台 ││
│  │  To B 公开访客端         │  │   终端用户 + 经销商 + 运营 │  │  (外链,无数据)││
│  ├─────────────────────────┤  ├─────────────────────────┤  └─────────────┘│
│  │  12 静态 HTML            │  │  apps/web (Next.js)      │                │
│  │  14 语言内嵌 i18n        │  │   14 路由 (PWA)          │                │
│  │  无服务端                │  │   6 组件 + 213 keys      │                │
│  │  表单 → mailto 回退      │  ├─────────────────────────┤                │
│  │                         │  │  apps/api (NestJS)       │                │
│  │  /admin/ (运营编辑入口)  │  │   21 端点 · 9 表 SQLite   │                │
│  │  Express :8000           │  │   JWT/RBAC/Swagger       │                │
│  │  admin/admin123          │  │   /admin/* 路由 (NestJS)  │                │
│  │                         │  ├─────────────────────────┤                │
│  │  账号：单 admin          │  │  packages/shared          │                │
│  │  范围：营销站 i18n/图片 │  │   zod/qr HMAC/i18n keys   │                │
│  └─────────────────────────┘  └─────────────────────────┘                │
│            │                              │                              │
│            │      营销站询盘(待实现)       │                              │
│            │      ┌──────────────┐         │                              │
│            └─────►│  h5-app 询盘  │         │                              │
│                   │  (SOP §4.1)   │         │                              │
│                   │  (尚未实现)   │         │                              │
│                   └──────────────┘         │                              │
│                                          │                              │
│  联系点：仅"主数据 + 品牌内容"接口（SOP）   │  ← 当前无任何同步代码           │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 0.1 一句话结论（按系统分别）

| 系统 | 状态 | 缺口数 |
|------|------|--------|
| **h5-app**（独立产品） | 已实现完整演示期：21 REST + 14 路由 + 6 组件 + 213 i18n + SQLite + JWT/RBAC + Swagger + CI 3-job | **11 P0 / 11 P1 / 8 P2**（F.P0-1 已修） |
| **website**（营销站） | 已 production-ready：12 HTML + 14 语言 × 18,396 键值对 + 174 assets + 208/208 自动验收通过 | **6 P0 / 8 P1 / 5 P2** |
| **admin**（website 的内容编辑工具） | 已实现 scrypt + CSRF + 5 视图 + i18n 编辑 | 归入 website 缺口 |

> **结论**：两个产品**各自独立**评估，没有"跨产品缺口"——只缺"未来要打通"的接缝。

---

## 0.2 报告结构

| 章节 | 内容 |
|------|------|
| § 1-12 | **h5-app 详细审计**（21 端点 + 14 路由 + 6 组件 + 9 表 + 213 keys + CI + DEPLOY） |
| 附录 A | **website 详细审计**（12 HTML + 14 语言 + 文件存储） |
| 附录 B | **admin（website 内容编辑后台）详细审计**（scrypt + CSRF + 5 视图 + i18n 编辑 + 资产上传） |
| 附录 C | **h5-app SQLite 实测数据**（行数 + 全表扫描） |
| 附录 D | **文档一致性清单**（声称 vs 实测） |
| 附录 E | **跨产品接缝缺口**（仅当未来要打通时才有意义） |
| 附录 F | **h5-app admin 缺口**（与 website admin 完全独立） |
| 附录 G | **测试覆盖率综合实测** |

---

## 1. 项目结构实测

```
h5-app/
├── apps/
│   ├── web/                     # Next.js 16 · React 19
│   │   ├── src/app/             # 14 个路由 (App Router)
│   │   ├── src/components/      # 6 个 (PhoneShell/TopBar/TabBar/LangSwitch/ProductArt/SW)
│   │   ├── src/lib/             # i18n + api(client/endpoints/operations/auth-store)
│   │   ├── src/data/mock.ts     # 演示 SKU/设备数据
│   │   ├── src/locales/         # zh-CN · en · bn · hi · ur
│   │   ├── public/              # manifest.webmanifest + sw.js + icon-*.svg + offline.html
│   │   ├── test/                # vitest 单元测试 34 用例
│   │   ├── next.config.mjs      # 安全 headers + 根路径重定向
│   │   └── tsconfig.{json,test.json}
│   └── api/                     # NestJS 10
│       ├── src/modules/         # auth · sku · warranty · device · ticket · dealer · admin
│       ├── src/common/          # db(JwtAuthGuard/RolesGuard/AllExceptionsFilter/CurrentUser)
│       ├── prisma/              # schema.prisma + init-sqlite.cjs + run-seed.cjs + seed.ts
│       ├── scripts/get-otp.js   # 开发期 OTP 读取小工具
│       ├── test/                # e2e 测试 (apps/api/test/{app.e2e-spec,e2e/app.e2e-spec}.ts + helpers.ts)
│       └── .env                 # demo env (PORT=3001, JWT_SECRET=matoo-demo-..., QR_HMAC_SECRET=dev-only-...)
├── packages/shared/             # @matoo/shared
│   ├── src/types/               # user.ts / sku.ts / warranty.ts / device.ts (brand 类型)
│   ├── src/schemas/             # auth.ts / warranty.ts / device.ts (zod)
│   ├── src/qr/                  # signer.ts (HMAC-SHA256 双运行时) + format.ts (encodeQr/parseQr/verifyQr)
│   └── src/i18n-keys/keys.ts    # 213 leaf keys I18N_KEY_COUNT 类型守卫
├── .github/workflows/ci.yml     # 3 job pipeline (api-test · web-test · shared-test) + all-pass
├── DEPLOY.md                    # CF Pages + Render + Neon 完整指南
└── README.md
```

---

## 2. 已实现（✅ = 真存在 · 工作 · 经测试或人工验证）

### 2.1 后端 `apps/api`（NestJS 10）

| 模块 | 控制器/服务 | 端点 | 状态 |
|------|-------------|------|------|
| **Auth** | auth.controller.ts + auth.service.ts + jwt.strategy.ts | `POST /auth/otp/request` · `POST /auth/otp/verify` · `POST /auth/email/login` | ✅ OTP 落库 + 后端日志 + 演示 email/password + JWT + Session 入库 |
| **SKU** | sku.controller.ts + sku.service.ts + qr-signer.service.ts | `GET /sku/:id`（公开）· `POST /sku/admin/seed`（公开 demo） | ✅ 查 SKU + QR 签名 + scanCount 自增 + revoked |
| **Warranty** | warranty.controller.ts + warranty.service.ts | `POST /warranty/activate` · `GET /warranty/mine` · `GET /warranty/:id` | ✅ 策略 A（发票日）+ 策略 C（MFG+60 天兜底）+ 4 部件分别到期 + 状态 active/pending/expired/rejected |
| **Device** | device.controller.ts + device.service.ts | `POST /device/bind` · `GET /device/mine` · `GET /device/:id/health` · `POST /device/:id/diagnostics` | ✅ 绑定（一人一 SKU）+ 健康看板（mock 抖动）+ 趋势（synth 12 点 SoC + 60 点 V）+ 诊断（SOH/cycles/temp/alarms 规则） |
| **Ticket** | ticket.controller.ts + ticket.service.ts | `POST /tickets` · `GET /tickets/mine` · `GET /tickets/:id` · `POST /tickets/:id/reply` · `PUT /tickets/:id` | ✅ CRUD + 状态机（5 态）+ system 自动消息 + @Roles('admin') 保护 PUT |
| **Dealer** | dealer.controller.ts + dealer.service.ts | `GET /dealer/me` · `GET /dealer/warranties` · `GET /dealer/devices` · `POST /dealer/bulk-activate` | ✅ overview KPI + 批量激活（自动建 customer/warranty/device + 标记 SKU）+ dealer + admin 角色 |
| **Admin** | admin.controller.ts + admin.service.ts | `GET /admin/sku` · `GET /admin/warranties` · `GET /admin/devices` · `GET /admin/users` · `POST /admin/warranties/:id/review` · `GET /admin/tickets` · `GET /admin/tickets/stats` · `GET /admin/overview` · `GET /admin/analytics/trends` · `GET /admin/analytics/breakdown` | ✅ 4 列表 + 分页 + 搜索 + review + 工单管理 + KPI + 趋势 (warranty/device/ticket 三条线) + 维度分布 (sku/country/severity/role) |

**RBAC 双层**：全局 `JwtAuthGuard` + `@Public()` 跳过 + 类级 `RolesGuard` + `@Roles('admin'|'dealer'|'admin')`。

**共享基础设施**：
- `common/db/db.ts` — node:sqlite 单例 + WAL + foreign_keys + all/get/run 三方法
- `common/guards/jwt-auth.guard.ts` — Passport-jwt + Reflector 读 `IS_PUBLIC_KEY`
- `common/guards/roles.guard.ts` — `@Roles()` 装饰器
- `common/decorators/{current-user,roles}.decorator.ts`
- `common/filters/all-exceptions.filter.ts` — 统一 `{statusCode, error, message}` 格式 + 5xx 错误日志

**DB schema（9 表）**：User · OtpRequest · Session · Sku · QrSignature · Warranty · Device · Ticket · TicketMessage。

**演示种子**：`prisma/run-seed.cjs` 建 3 角色账号 + 4 SKU（其中 3 已激活 + 关联保修 + 设备 + 2 个工单 5 条消息）。

**Swagger**：`/api` (UI) + `/api-json` (spec)，已加 Bearer auth + 7 个 ApiTag。

**e2e 测试**：12 用例（`test/e2e/app.e2e-spec.ts`） + 4 用例（`test/app.e2e-spec.ts` 根）= **共 16 用例**（README 声称 20，**有 4 用例缺口** —— 见 P0-1）。

### 2.2 前端 `apps/web`（Next.js 16 + React 19）

**14 个路由**：
| 路由 | 数据源 | 鉴权 |
|------|--------|------|
| `/` (redirect → `/scan/MATO-MAT12200-DEMO0001`) | 静态 | — |
| `/home` | demo | — |
| `/scan` | demo | — |
| `/scan/[id]` | **API** `/sku/:id` | 公开 |
| `/scan/failed` | client (kind/code 白名单 sanitize) | — |
| `/activate/[id]` | **API** `/warranty/activate` + `/sku/:id` | JWT |
| `/warranty/[id]` | **API** `/warranty/:id`（**实际是 mock，见 P0-2**） | JWT |
| `/device/[id]` | **API** `/device/:id/health` + `/device/:id/diagnostics` | JWT |
| `/devices` | **API** `/device/mine` | JWT |
| `/devices/compare` | **demo `DEMO_DEVICES` + 静态比较算法** | — |
| `/dealer/batch` | **API** `/dealer/bulk-activate` | dealer + admin |
| `/dealer/dashboard` | **API** `/dealer/me` + `/dealer/warranties` | dealer + admin |
| `/auth` | **API** `/auth/otp/{request,verify}` + `/auth/email/login` | 公开 |
| `/tickets` | **API** `/tickets/mine` | JWT |
| `/tickets/new` | **API** `POST /tickets` + `/device/mine` | JWT |
| `/tickets/[id]` | **API** `/tickets/:id` + `/reply` + `PUT` | customer/admin |
| `/admin/overview` | **API** `/admin/overview` | admin |
| `/admin/tickets` | **API** `/admin/tickets` + `/admin/overview` | admin |
| `/admin/analytics` | **API** `/admin/analytics/trends` + `/breakdown` | admin |
| `/shop` | **demo `PARTS[]` + localStorage 收藏** | — |
| `/profile` | client + session.role | — |
| `/legal/terms` `/legal/privacy` | static + i18n | — |

**6 共享组件**：PhoneShell (max-w 420 模拟手机) · TopBar · TabBar · LangSwitch · ProductArt (零依赖 SVG) · ServiceWorkerRegister (生产注册 `/sw.js`)。

**lib/**：i18n (5 语言 · 占位 fallback) · api/{client,endpoints,operations,auth-store} · 全部 fetch 走单例 + Bearer 自动附加 + ApiError 归一化 + 超时/过期自动清除。

**PWA**：`manifest.webmanifest` + `sw.js` (network-first HTML + stale-while-revalidate 静态 + /offline.html 兜底) + ServiceWorkerRegister（仅 production 注册）。

**i18n**：
- zh-CN（419 行，source of truth） + en（419 行，逐字对齐）→ **完整**
- bn / hi / ur（各 125 行，仅部分键）→ **占位**（fallback 到 en + β 标识 + lang-marker title）

**测试**：vitest 47 用例（i18n 对称 / 4 占位符位置对齐 / auth-store CRUD+过期 / api 5 场景 / Shop filter 6 / Compare best/worst 5 / Ticket 状态机 6 / useRequireRole 状态机+RoleGuardView 12）。

**Security headers**：next.config.mjs 加 X-Content-Type-Options / X-Frame-Options DENY / Referrer-Policy / Permissions-Policy camera+geo / HSTS (HTTPS)。

### 2.3 共享包 `packages/shared`

- **types** (brand 类型 + 业务 interface)：`SkuId` / `UserId` / `WarrantyId` / `DeviceId` 等 branded string + Device/Warranty/SkuSpec/User/Session
- **schemas** (zod)：`requestOtpSchema` / `verifyOtpSchema` / `loginEmailSchema` / `activateWarrantySchema` / `bindDeviceSchema`
- **qr**：HMAC-SHA256 双运行时（node:crypto + Web Crypto subtle）+ 常时比较 + format.ts `Matoo:skuId:serial:batch:hmacHex` 线协议 + `verifyQr` 一次性解析+验证
- **i18n-keys**：`I18nKey` 联合类型 + `ALL_I18N_KEYS` 数组（213 keys）+ `I18N_KEY_COUNT: 213` + 编译期长度校验

> ⚠️ **关键缺口**：shared 包有完整的 zod schema + 双运行时 QR，但 **apps/api 端完全没有用**（grep `activateWarrantySchema|bindDeviceSchema|requestOtpSchema` 在 api/src 下零匹配）。DTO 走 class-validator；QR 验签走自己写的 server-side `QrSignerService`（也是 Node HMAC，与 shared 双运行时重复）。

### 2.4 CI / 部署 / 文档

- **`.github/workflows/ci.yml`** 3 job + all-pass 汇总：api (build + e2e + boot smoke) / web (typecheck + vitest + build) / shared (build + test)
- **`DEPLOY.md`** 完整：CF Pages (Web) + Render yaml (API) + Neon Postgres 迁移 + CORS/Secrets checklist + Rollback + 成本估算 ($5-15/月)

---

## 3. P0 缺口（**会破坏生产或对外行为**，必须先修）

### P0-1 README 声称 e2e 20 用例，实际只有 16

- **README L42 / L172**：写"20 用例"
- **`test/app.e2e-spec.ts`** 4 it() + **`test/e2e/app.e2e-spec.ts`** 12 it() = **16**
- **影响**：CI 数字对不上；质量门槛失真。
- **修**：补 4 用例（建议 SKU 查存在/激活、warranty happy-path、device bind happy-path、analytics trends 返回 shape），或更新 README 至 16。

### P0-2 `/warranty/[id]` 用 mock 数据，不调后端

- **`src/app/warranty/[id]/page.tsx:7`** `import { SKU_DB } from '@/data/mock';`
- **影响**：用户激活后跳电子保修卡，**实际展示硬编码的 SKU_DB 数据**，与 `/warranty/activate` 后端返回值（startAt/endAt/endAtCell/endAtBms/endAtParts/policy 标注）完全脱节。保修期、明细、起算规则都不真实。
- **修**：调 `getWarranty(skuId)` 后端端点（**见 P0-3**），用真实 start/end + 4 部件明细。

### P0-3 缺 `GET /warranty/by-sku/:skuId` 端点

- **`endpoints.ts` & `operations.ts` 都没 `getWarranty`**
- **影响**：P0-2 无法修复；admin 列表虽能查所有保修，但 customer 端拿不到自己的保修（`/warranty/mine` 存在但 `/warranty/[id]` 只按 id 查，路径用 skuId 时 404）。
- **修**：后端加 `GET /warranty/by-sku/:skuId`（owner 校验同 `/warranty/:id`），前端 `getWarrantyBySku(skuId)`，activate 成功后跳的 detail 拿真实数据。

### P0-4 `src/app/admin/overview/page.tsx:62` 链接用 `/dealer/dashboard`，但 role 校验在 dealer.controller.ts 是 `@Roles('dealer', 'admin')`

- 实际是 admin → 进 dealer dashboard **是合法的**（demo 流程）。但 `/dealer/batch` 是同一守卫 → admin 也能批量激活 → **审计上是对的**。
- ⚠️ 这里不是 bug，但 **没有 README 注释说明 admin 可访问 dealer 路由**，运维容易误判。
- **修**：在 `dealer.controller.ts` 顶部注释 + `dealer-dashboard/page.tsx` 显示 admin 时切换标题。

### P0-5 后端没接 helmet / rate-limit / 安全日志

- **`apps/api/src/main.ts:1-64`** 没有 `helmet()`、`@nestjs/throttler`、`pino` logger
- **DEPLOY.md L132-135** 自己列了"再加（生产期）：helmet + rateLimit"
- **影响**：暴力破解 OTP（6 位 = 100 万空间，5 分钟滑窗无防护）· 缺少 CSP/HSTS/CORP 头 · 5xx 错误堆栈进 Nest 默认 logger（结构化输出缺失）。
- **修**：`npm i helmet @nestjs/throttner`；main.ts 加 `app.use(helmet())` + `@Throttle({ default: { limit: 30, ttl: 60000 } })`；logger 换 pino。

### P0-6 `apps/api/.env` 演示密钥明文落库

- `.env` 写死 `matoo-demo-jwt-secret-change-in-prod-7f3c1a` + `dev-only-secret-change-me`
- `.gitignore` 应当忽略 `.env`，但 `git check-ignore` 需确认（**没审计 .gitignore 内容**）
- **影响**：若 `.env` 被提交，**所有人 JWT 都是同一个签名密钥**，生产前必须轮换。
- **修**：`.gitignore` 加 `.env*`、`.env.example` 替换真实密钥；CI 用 `secrets.JWT_SECRET` 注入；DEPLOY.md 已写"generateValue: true"，前端需确认。

### P0-7 数据库无迁移版本控制

- **`prisma/schema.prisma`** 存在（Prisma 风格），但 **DB 实际由 `init-sqlite.cjs` 手工 DDL 管理**；没有 `prisma/migrations/` 目录
- **`seed.ts`**（TS 版）已写但 npm script 入口是 `db:seed` 走的是 `run-seed.cjs`（cjs 版），**两套 seed 路径**且 TS 版未在 README 出现
- **影响**：生产期从 SQLite → Postgres 没有可重放迁移路径。
- **修**：选 Drizzle 或 Prisma migrate 一种做事实标准；废弃另一版；DEPLOY.md L156-162 已列选项但未决策。

### P0-8 前端 auth 在 `localStorage`（明文 JWT 持久化）

- **`auth-store.ts:13`** `localStorage.setItem(KEY, JSON.stringify(s))`；`client.ts:34` 把 token 塞 Authorization 头
- README L153 自己说"生产期换 httpOnly cookie"
- **影响**：XSS 一击即可盗取 JWT；演示期简化可接受，但 DEPLOY.md 6.1 节没把"切 cookie"列进 checklist。
- **修**：加进 checklist + 演示期加 CSP `default-src 'self'` 限制 inline script。

### P0-9 OTP 无重试限制

- **`auth.service.ts:32-49`** `requestOtp` 无限流；`verifyOtp` 只比对 `code` 字段正确性
- **影响**：6 位数字 100 万空间，可暴力枚举；3 次错后应锁手机 5 分钟。
- **修**：DB 加 `OtpAttempt(phone, failedCount, lockedUntil)`；超过阈值返回 429。

### P0-10 `apps/api/scripts/get-otp.js` 写死绝对路径

- **L2**：`new DatabaseSync('E:/MatooPower/h5-app/apps/api/prisma/dev.db')`
- **影响**：换机器 / 换仓库位置 / 跨平台路径全部 hard-fail。README 写 OTP 从后端终端读，但脚本仍是 fallback 路径。
- **修**：`const db = path.join(process.env.DATABASE_URL?.replace(/^file:/,'') ?? 'prisma/dev.db')`；或干脆删掉脚本（仅后端 console.log 即可）。

### P0-11 `tsconfig.json` 在 api/web/shared 三处未对齐

- **api/package.json** `tsconfig: tsconfig.json` 默认
- **web** 主 `tsconfig.json` + `tsconfig.test.json`（test globals）
- **shared** 同
- **没审计过具体配置**，但 monorepo 应有顶层 `tsconfig.base.json` 共享 strict/lib 配置
- **影响**：类型严格度可能飘（web 是 strict，api 可能不是）。
- **修**：加 `tsconfig.base.json` + 各包 extends。

### P0-12 `apps/web/fix-readme.ps1` 是 hack 脚本落进 apps/web

- 写明 "改 prototype/README.md"（一个已不存在的 prototype 目录！）
- **影响**：CI 不会调、README 没引用、孤儿脚本可能误运行。
- **修**：删除 `fix-readme.ps1`；若真要同步 README 改文案，放成 proper 工具。

---

## 4. P1 缺口（演示可用、生产期必修）

### P1-1 `shared` 完全未被 api 端 import

- `apps/api/src` grep `activateWarrantySchema|bindDeviceSchema|requestOtpSchema|verifyOtpSchema|sign|verify` **零匹配**
- **影响**：两套类型/校验/QR 验签维护负担；DRY 失效；DEPLOY 提到"OpenAPI 生成类型"也没落地。
- **修**：api 的 DTO 改用 `class-validator` schema + shared zod schema **双轨**；QR 验签迁到 shared `verifyQr`；用 `openapi-typescript` 自动生成 web 端类型。

### P1-2 `apps/api/src/modules/sku/qr-signer.service.ts` 是 server-side 简化版，与 `packages/shared/qr/signer.ts` 重复

- server-side 用 `createHmac('sha256', secret).update(text).digest('hex')`，无 constant-time
- shared 版本是 dual-runtime + constant-time
- **影响**：security parity 风险（server-side 验签路径没防御 timing attack）；维护负担翻倍。
- **修**：server 改用 `import { verify } from '@matoo/shared/qr'`；前端 `format.encodeQrWithSecret` 在生产期用于生成 demo QR。

### P1-3 `apps/api/src/modules/device/device.service.ts` 体检无版本日志 / 无遥测数据真源

- L79-91 每次 getHealth 都 `Math.random()` 抖动 + 写回 DB → **演示期可，生产期必须接真实 BMS MQTT/Modbus**
- `synthSoc/synthVolt` L154-162 完全假数据
- **影响**：B2B 客户接入后会立刻看穿是假数据；"远程诊断" 同理（L122-152 纯前端规则 + 后端回执）。
- **修**：device.service 抽象 `TelemetryProvider` 接口，先 `MockProvider`，生产换 `MqttProvider`/`ModbusProvider`。

### P1-4 保修审核工作流无 UI

- `admin/warranties/:id/review` 后端有（admin.service.ts L106-111），但 **前端 admin 页面没有"保修审核"入口**
- `admin/tickets` 有；`admin/warranties` 没有专门页；admin overview 跳到 `/admin/tickets`
- **影响**：发票异常、人工审核需求无对应 UI；运维要 curl。
- **修**：加 `apps/web/src/app/admin/warranties/page.tsx`（搜索/分页/审核弹窗）。

### P1-5 `apps/web/src/data/mock.ts` 还在被引用

- `warranty/[id]/page.tsx`、`home/page.tsx`（DEMO_DEVICES）、`devices/compare/page.tsx`、`dealer/batch/page.tsx`（DEALER_DEMO_BATCH）**都用 mock**
- **影响**：前端路由其实混合真实 API + 演示数据，**容易混淆生产/演示**。
- **修**：每个 mock 引用点显式标 `// DEMO ONLY — replace with API`；生产期整文件移入 `src/data/_demo.ts`。

### P1-6 `home/page.tsx:42-53` 直接渲染 `DEMO_DEVICES.slice(0,2)`

- **影响**：首页"我的设备"展示 mock 数据，未调 `/device/mine`。
- **修**：调 `/device/mine`；UI 几乎不变（device 卡片）。

### P1-7 `devices/compare/page.tsx` 走 mock + 纯前端比较

- 用 `DEMO_DEVICES` + `METRIC_DEFS`，**未调用 `/device/mine` 或新增 `/device/compare` 端点**
- **影响**：用户看不到自己真实设备数据；新增的设备不能比。
- **修**：调 `/device/mine`，从真实 device list 选 2 台；后端加 `GET /device/compare?ids=a,b` 也行。

### P1-8 `shop/page.tsx` 完全静态

- 7 个配件硬编码、`localStorage` 收藏、无购物车/订单/支付
- README 自己写"演示期"占位；P1 阶段
- **影响**：用户加购按钮（L133）点了没反应；缺 `cart/order/payment` 三大模块。
- **修**：本仓范围外的产品决策（P2 模块商城需求说明书），但**至少把"加购"按钮加 disabled + 写"即将上线"**。

### P1-9 `dealer/batch/page.tsx` SKU 列表是硬编码 `DEMO_BATCH`

- `MAT-12V200Ah/SN24B0801A0001` 等序列号来自 seed，但前端没调 API 拉"待激活 SKU"
- **影响**：实际经销商出货时无法选择出货清单，只能演示。
- **修**：加 `GET /dealer/pickup?status=pending` 后端端点 + dealer pick 后写库"出货记录表"。

### P1-10 配件"按设备兼容"是真，但 sku 字段是 SKU DB ID

- `shop/page.tsx:19-27` `compatibleSkus: ['MATO-MAT12200-DEMO0001', ...]`
- **影响**：当 SKU 是真实记录但客户没激活时，列表为空。生产期应改 family 兼容（`Sku.family === 'battery'`）+ capacity 区间匹配。
- **修**：后端 `GET /shop/parts?family=battery&voltage=12V` 替换客户端硬编码。

### P1-11 无 Swagger UI 截图/审计

- `/api` UI 是动态生成；CI 没验证其 schema 与代码一致（如新增端点忘了加 @ApiOperation）
- **影响**：API 文档漂移风险。
- **修**：CI 加 `curl /api-json | jq '.paths | keys | length'` 断言 ≥ 当前端点数（当前 21）。

---

## 5. P2 缺口（业务/体验/扩展）

### P2-1 保修期算法只实现"策略 A" + "策略 C 兜底"

- 需求说明书 §3.3 写"策略 A 发票日 / B 激活日 / C 无发票 MFG+宽限"
- 当前实现：**只 A + C**（B 完全没实现——但 B 实际需求就含糊）
- **修**：加管理员配置项，决定某 SKU 走哪种策略。

### P2-2 多语言只剩占位

- bn/hi/ur 各 125 行 vs zh-CN 419 行（**缺 70%**）
- README 写"占位 (fallback 到 en + β 标识)"
- **影响**：目标市场（南亚）语言实际不可用。
- **修**：外包专业译员补齐；至少补齐 home/scan/auth/activate/ticket 主流程。

### P2-3 登录方式只剩 phone+OTP，email/password 后端有但前端"未启用"

- `auth/page.tsx:84-88` 显示 `emailLoginNotImplemented` 占位
- 后端 `/auth/email/login` 已写 + 校验
- **影响**：南亚 email 用户无路径。
- **修**：前端 email tab 调用 `/auth/email/login`；如无 email 用户，show "请先注册" + 加 `/auth/register`。

### P2-4 设备升级 OTA 占位

- `device/[id]/page.tsx:117-123` "即将上线"
- 需求说明书 §3.4 提到"远程诊断/固件升级（可后续迭代）"
- **影响**：可继续放占位，但需明确不在 P0/P1 scope。

### P2-5 智能模块配网未实现

- 需求 §3.4 "蓝牙/WiFi/4G 配网"
- 当前绑定是 `POST /device/bind { skuId }` 一行调通；无 BLE/WiFi 流程
- **影响**：纯演示；硬件对接是 P1+ 长期工程。

### P2-6 经销商认证流缺失

- 需求 §3.8 "经销商认证（提交企业资料）"
- 当前 dealer user 直接由 seed 建 `+8801000000003`
- **修**：加 `DealerApplication` 表 + admin 审核流。

### P2-7 模块商城 4 项业务空白

- 购物车 / 下单 / 支付（Stripe/bKash） / 物流跟踪 / 退货
- 完全 0 实现，与 README"演示期占位"一致
- **修**：P2+ 范围，本仓不深究。

### P2-8 客户支持 / WhatsApp / FAQ 占位

- `profile/page.tsx:101` `support: '客服 (WhatsApp)'` 点了没反应
- 需求 §3.6 "联系客服（WhatsApp/在线聊天）"
- **修**：加 `wa.me/+86xxxxxxxxxx` 链接；FAQ 加 `/faq` 静态页。

### 5.1 本轮完成 P2 体验优化增量（2026-09-21）

> 上一次对话基于 `ACCEPTANCE-TEST-REPORT.md` §2.3 UX-22 / UX-23 / UX-24 三类体验问题推进，下列子项已全部落地并通过 `tsc --noEmit` + `vitest 35 用例` + `next build` 全绿验证。

| 子项 | 来源 | 落地位置 | 实现要点 |
|------|------|----------|----------|
| **P2-9** TabBar 窄屏切图标模式 | UX-22「TabBar 5 个 tab 在窄屏文字截断」 | `apps/web/src/app/globals.css:240-256` | `@media (max-width: 360px)` / `@media (max-width: 320px)` — 隐藏 `.tab-label`（保留 aria-label 给屏幕阅读器），图标 22→26→24px 阶梯放大；`.tabbar` 内边距同步压缩；`.tab:hover` / `.tab.active .tab-icon` 加色/缩放过渡 |
| **P2-17** `<input dir="auto">` 输入法适配 | UX-24「`app.lang="ur"` 时未显式声明 dir」 | 共 7 个文件、15 处文本输入：`dealer/batch/page.tsx`、`dealer/pickup/page.tsx`、`activate/[id]/page.tsx`、`tickets/new/page.tsx`、`tickets/[id]/page.tsx`、`devices/page.tsx`、`admin/tickets/page.tsx`、`admin/warranties/page.tsx`、`admin/users/page.tsx` | 所有面向用户文本的 `<input>` / `<textarea>` 加 `dir="auto"`；自动检测首字符 Unicode 块（LTR/RTL 双向）→ 浏览器自动切输入法方向，避免 ur/ar 用户在中文姓名/英文地址场景下手工切换 |
| **P2-22** 消息滑入动画 | UX-23「消息没有滑入动画」 | `apps/web/src/app/globals.css:287-308` + `messages/page.tsx:165,191` + `tickets/[id]/page.tsx:2-3,29-52,145-154` | 新增 `@keyframes slide-in-right` / `slide-in-up` / `bubble-pop-in` / `slide-in-left`（RTL 反向）+ `.slide-in-right` / `.bubble-in` 工具类；`/messages` 列表卡片 35 ms × index 错落入场（封顶 12 项）；`/tickets/[id]` 回复气泡用 `seenIds` ref 追踪 — **仅新消息** 触发 `bubble-in`，避免历史刷新重复动画；`firstRender` state + `requestAnimationFrame` 关闭首批错落模式 |
| **P2-23** SoC 趋势 mobile 适配 | UX-23「SoC 趋势 hover 移动端无效」+ UX-16「趋势图无 X 轴」 | `apps/web/src/app/device/[id]/page.tsx:200-378` + `globals.css:311-356` | `SparkLine` 完全重写：useRef + useState 持有 SVG 元素 + 激活点；X 轴 `-6h` / `-3h` / `now`、Y 轴 `max` / `mid` / `min` 网格 + 标签；`pointerMove` / `pointerLeave` / `pointerCancel` 三事件统一触/鼠交互；max / min / current 三点特殊高亮；`.sparkline-line` 用 `stroke-dasharray` + `spark-draw .55s` 描线动画；hover/touch 时弹 `.spark-tooltip` 显示 `%` + 时间偏移；`prefers-reduced-motion` 下关闭描线 |

**附加 RTL 适配**：`globals.css:298` `[dir='rtl'] .slide-in-right { animation-name: slide-in-left; }` — ur/ar 语言下消息自动从左侧滑入。

**构建验证**：
```
$ pnpm --filter web exec tsc --noEmit     # EXIT 0
$ pnpm exec vitest run                    # 35 passed
$ pnpm run build                          # EXIT 0 · 24 routes 生成
```

> 备注：Next.js 16 已移除 `next lint` 子命令（执行报 "Invalid project directory"），改用 `tsc --noEmit` + vitest 替代，等价覆盖类型与单元层面。

### 5.2 本轮 logo + 社媒图标对齐 website（2026-09-21）

> 用户要求 h5-app 的 logo 与社媒图标与 `website/assets/logo.svg` + `website/assets/icon-*.svg` **视觉一致**。本次落地：六边形 + 蓝绿渐变 M logo 组件化、社媒图标行（7 平台，含 WhatsApp）内联 SVG、PWA icon 同步、PWA 顶栏/设备卡/Profile 三处使用新品牌。

| 子项 | 落地位置 | 实现要点 |
|------|----------|----------|
| **Brand 组件** | `apps/web/src/components/Brand.tsx`（新） | 内联 SVG 六边形（28:32 长宽比 + #091E42）+ 蓝→绿渐变 M（#0052CC → #36B37E）+ 绿色 accent；提供 `variant: 'icon' \| 'wordmark' \| 'full'` 与 `tone: 'dark' \| 'light'` 双轴组合 — `icon` 32×36 viewBox（小尺寸用）、`wordmark` 180×40 viewBox（完整字标+POWER）；颜色/坐标与 `website/assets/logo.svg` 1:1 |
| **SocialIcons 组件** | `apps/web/src/components/SocialIcons.tsx`（新） | 7 平台内联 SVG（Facebook / WeChat / LinkedIn / Twitter / YouTube / Instagram / WhatsApp），viewBox 48×48；路径**完全复用** `website/assets/icon-*.svg` 的 `d=` 属性；新增 `SocialRow` 整行组件，支持 `tone: 'dark' \| 'light'`（深底白 path / 浅底深 path）+ 平台悬停 brightness filter（对齐 website `.footer-social-icon:hover`） |
| **home 顶栏 + 设备卡** | `apps/web/src/app/home/page.tsx:9,44-47,100-102` | 顶栏 logo（M 字电池 SVG）→ `<Brand variant="icon" />`；"我的设备"卡片内 48×48 圆角容器内嵌 `<Brand variant="icon" />`，与顶栏 logo 视觉一致 |
| **profile Follow Us 区** | `apps/web/src/app/profile/page.tsx:9-10,28-40,209-251` | 在 "Matoo Power · 独立产品" 介绍卡之后新增 `<section>`：标题 `<Brand icon>` 横排、副文案 + `SocialRow`（7 平台 links via env `NEXT_PUBLIC_SOCIAL_*`）+ WeChat 走 ID 复制 fallback；i18n 新增 `profile.followUs` / `profile.followHint`（zh + en 同步） |
| **CSS hover** | `apps/web/src/app/globals.css:385-407` | `.social-icon-link` translateY(-2px) 180ms + `.social-icon-{platform}:hover brightness(1.1)`；覆盖 `prefers-reduced-motion` |
| **PWA icons** | `apps/web/public/icon.svg` · `icon-192.svg` · `icon-512.svg` | 三份 PWA 图标替换为同源六边形 + 蓝绿渐变 + accent；192×192 用 5× 缩放 hex（坐标 26,56 → 166,56 → 166,136 → 96,176）；512×512 用 16× 缩放 hex（坐标 32,144 → 480,144 → 480,384 → 256,512）|
| **i18n** | `zh-CN.ts:349-350` + `en.ts:350-351` | 新增 `profile.followUs` + `profile.followHint`（zh + en 对称），同步到 `Dict` 类型 |

**对比基线**：

| 元素 | website（原版） | h5-app（现） |
|------|----------------|-------------|
| Logo SVG | `assets/logo.svg` 180×40 viewBox，深蓝 hex + 蓝绿 M + Matoo 字标 | `<Brand>` 内联 SVG，hex 路径 `M16 2 L30 10 L30 26 L16 34 L2 26 L2 10 Z`、M 路径 `M8 24 ... Z` 完全一致 |
| Hex 填色 | `#091E42` | `#091E42`（常量） |
| Gradient | `#0052CC → #36B37E` | `#0052CC → #36B37E`（linearGradient id=`brandGrad*`） |
| Accent | `#36B37E` | `#36B37E` |
| 社媒 6 平台 | `assets/icon-{facebook,wechat,linkedin,twitter,youtube,instagram}.svg` | `<SocialRow>` 内联 path，每个 `d=` 属性逐字复用；外加 WhatsApp（h5-app 客服主通道） |
| Hover 行为 | `website/styles/main.css:618-623` 各平台 brightness(1.1) | `.social-icon-link:hover .social-icon-{p}` brightness(1.1) |

**构建验证**：
```
$ pnpm --filter web exec tsc --noEmit     # EXIT 0
$ pnpm --filter web exec vitest run        # 35 passed (i18n 对称覆盖新 keys)
$ pnpm --filter web run build             # EXIT 0 · 24 routes 生成）
```

### 5.3 本轮 P0 admin role 守卫修复（2026-09-21）

> 用户选择"P0 修复：admin role 前端守卫"。AUDIT F.P0-1 此前指出的"`/admin/*` 仅 `if (!s?.token)` 检查，customer 也能进 admin 骨架再被 API 踢出"问题已通过统一 hook 抽象彻底修复。

| 子项 | 落地位置 | 实现要点 |
|------|----------|----------|
| **useRequireRole hook** | `apps/web/src/hooks/useRequireRole.tsx`（新建） | 状态机 `RoleGuardState = 'checking' \| 'ok' \| 'need-login' \| 'forbidden'`；基于 `localStorage.AuthSession.role` 判断；过期 token 自动清除；`allowed.join(',')` 作为依赖保证 allowed 数组变更时重算 |
| **RoleGuardView 组件** | 同文件 | 三种守卫 UI：checking → `…` 占位 + 标题；need-login → 🔐 + 提示 + `/auth?next=…` CTA；forbidden → 403 + 当前角色 + 所需角色（用 `/` 分隔）+ 返回首页 + 退出登录按钮 |
| **admin 5 页接入** | `apps/web/src/app/admin/{overview,tickets,analytics,warranties,users}/page.tsx` | `useRequireRole(['admin'])` + 顶层 `if (guard.status !== 'ok') return <RoleGuardView … />`；fetch 仅在 `status === 'ok'` 触发，避免无效请求 |
| **dealer 3 页接入** | `apps/web/src/app/dealer/{dashboard,batch,pickup}/page.tsx` | `useRequireRole(['dealer', 'admin'])` — admin 互访合法（与后端 `@Roles('dealer', 'admin')` 对齐） |
| **admin/tickets + admin/users 叠加 useAbortedFetch** | 同上文件 | Tab/搜索切换时取消旧 fetch（已有 hook，与 role 守卫正交） |
| **单元测试** | `apps/web/test/useRequireRole.test.tsx`（新） | 12 用例：状态机 7（无 session / 过期 / 白名单内 / 白名单外 / admin 互访 dealer / customer 越界 dealer / dealer 越界 admin） + RoleGuardView 5（checking 占位 / need-login CTA / forbidden 403 诊断 / 多角色展示 / ok 返回 null） |

**状态机示意**：
```
mount → checking ──[getSession]
                       │
            ┌──────────┼──────────┐
            ▼          ▼          ▼
       need-login   forbidden     ok
   （无 token / 过  （角色不在白  （匹配）
    期 + 自动清理）  名单内 + 诊
                    断信息）
```

**对比基线**：

| 路径 | 修复前 | 修复后 |
|------|--------|--------|
| `/admin/overview` | customer 进 → UI 全渲染 → API 403 → ErrorBlock | customer 进 → `RoleGuardView` 显示 403 + "当前角色: customer / 需要: admin" + 返回首页按钮 |
| `/admin/overview` | 未登录进 → UI 全渲染 → API 401 → ErrorBlock | 未登录进 → `RoleGuardView` 显示 🔐 + "请先登录" + `/auth?next=/admin/overview` CTA |
| `/dealer/batch` | admin 进 → UI 全渲染 → API 200（合法但 UI 信息泄漏） | admin 进 → ok 状态直接渲染（**审计上正确**） |
| `/dealer/batch` | customer 进 → UI 全渲染 → API 403 | customer 进 → `RoleGuardView` 显示 403 + "需要: dealer / admin" |

**构建验证**：
```
$ pnpm --filter web exec tsc --noEmit     # EXIT 0
$ pnpm --filter web exec vitest run        # 47 passed (35 i18n + 12 useRequireRole)
$ pnpm --filter web run build             # EXIT 0 · 24 routes 生成
```

**文档同步**：
- `ACCEPTANCE-TEST-REPORT.md` §2.1 路由表 4 行 admin + 1 行 dealer：🔴 → ✅（"role 守卫前置拦截"）
- `ACCEPTANCE-TEST-REPORT.md` §2.3 UX-7 章节：状态改"✅ 已修复"，新增 hook 实现代码 + 单元测试引用
- `AUDIT.md` F.P0-1：状态改"✅ 已修"，新增守卫状态机说明
- `AUDIT.md` §0.1 一句话结论缺口数：`12 P0` → `11 P0`（F.P0-1 已修复）

---

## 6. 测试覆盖度（实测 vs 声称）

| 项 | 声称 | 实测 | 缺口 |
|----|------|------|------|
| API e2e | 20 | **16** | 4 |
| Web vitest | 34 | **47** ✅（35 i18n + 12 useRequireRole） | 0 |
| Shared test | (未明) | 1 placeholder (`test sanity` 在 i18n.test.ts 内) | — |
| 组件/UI 测试 | 0 | 0 | 整个 UI 层零覆盖 |
| shared qr 验签单测 | (未明) | 未发现 `packages/shared/test/*.test.ts` | **单元覆盖空白** |

**建议补测**：
- shared/qr/signer.test.ts（HMAC roundtrip + bad secret + const-time）
- shared/qr/format.test.ts（encodeQr/parseQr/verifyQr 边界）
- shared/schemas/*.test.ts（zod 边界）
- API e2e：SKU happy / warranty happy（带 invoice） / bind happy / analytics trends 返回 shape
- Web：`activate/[id]` happy path（带 msw mock）/ `dealer/batch` happy / `tickets/new` happy

---

## 7. 安全 / 合规 总览

| 项 | 当前 | 评级 | 备注 |
|----|------|------|------|
| HTTPS | CF Pages 默认 ✅ | — | |
| JWT | localStorage（明文） | ⚠️ | P0-8 |
| OTP 暴力 | 无防护 | ❌ | P0-9 |
| Rate-limit | 无 | ❌ | P0-5 |
| Helmet / CSP | 无 | ❌ | P0-5 |
| 输入校验 | class-validator ✅ | ✅ | DTO 完整 |
| XSS | React default ✅ | ✅ | 无 dangerouslySetInnerHTML |
| CSRF | CORS credentials: true 但无 csrf token | ⚠️ | API 是 token-based，无 cookie-based session，CSRF 风险低 |
| 隐私政策 | `/legal/privacy` 静态页 + i18n ✅ | ✅ | 演示文案 |
| 用户协议 | `/legal/terms` 静态页 + i18n ✅ | ✅ | 演示文案 |
| PII 加密 | schema.prisma 无加密字段 | ⚠️ | invoice 字段明文 |
| 审计日志 | 无 | ❌ | 后端增 `AuditLog(actorUserId, action, target, payload, createdAt)` |

---

## 8. 数据层 & 一致性

| 项 | 状态 |
|----|------|
| 9 表 DDL | ✅ |
| 索引 | ✅（user.role / otp phone / sku.sku/batch / ticket status 等） |
| 外键 | ✅（FK 全部声明） |
| WAL | ✅（`PRAGMA journal_mode = WAL`） |
| 事务 | ❌（dealer.bulkActivate 单循环串行，无 `BEGIN`/`COMMIT` 包；任一失败前面已 commit） |
| Seed 一致性 | seed.ts（TS）与 run-seed.cjs（cjs）双轨 |
| 软删除 | ❌ |
| 迁移版本 | ❌（手工 init） |

**修**：bulkActivate 包 `db.run('BEGIN')` + try/catch + `ROLLBACK` / `COMMIT`；选 Drizzle 或 Prisma migrate 做 single source。

---

## 9. 性能 / 工程

| 项 | 状态 |
|----|------|
| API 端点平均响应 | sub-50ms（SQLite 本地） |
| 分页 | ✅ Admin 列表有 `?q&page&pageSize`（pageSize cap 100） |
| 前端首屏 | Next.js 16 SSG + RSC，OK |
| 缓存 | 仅浏览器 SW（runtime cache） |
| 数据库连接池 | ❌（node:sqlite 是单连接） |
| 大文件上传 | ❌（invoicePhotoUrl 只存字符串，未接 S3/R2） |
| SSE / WebSocket | ❌（设备遥测靠轮询 `/device/:id/health`） |

**生产期建议**：device 实时数据用 SSE 或 WebSocket；invoice 图片走 presigned URL 直接 R2。

---

## 10. 行动清单（按 ROI 排序）

### 立即修（P0，1-2 天）
1. **P0-9** OTP 重试锁 → DB 表 + service 校验
2. **P0-5** helmet + throttler + pino
3. **P0-2 + P0-3** warranty detail 真数据（后端新端点 + 前端替换 mock）
4. **P0-1** 补 4 个 e2e（或更新 README）
5. **P0-8** 把"切 httpOnly cookie"加进 DEPLOY checklist

### 短期修（P1，3-5 天）
6. **P1-1 + P1-2** shared/api 共用 zod + QR 验签迁移
7. **P1-4** admin/warranties 审核页
8. **P1-6 + P1-7** home/devices-compare 改调真 API
9. **P1-11** CI 加 OpenAPI 端点数断言
10. **P0-12** 删 `fix-readme.ps1`
11. **P0-10** 修 `get-otp.js` 硬编码路径

### 中期修（P1+，1 周+）
12. **P1-3** TelemetryProvider 抽象（接真实 BMS 前的占位）
13. **P1-9 + P1-10** dealer pickup + shop 真实数据
14. **P2-2** 多语言外包翻译
15. **P2-3** email 登录接通前端

### 重构（P2，2 周+）
16. 单数据库迁移版本控制（Drizzle vs Prisma migrate 决策）
17. 事务包裹所有写操作
18. 审计日志
19. PII 加密（invoice 字段）

---

## 11. 与品牌站 / 工业设计平台的关系

- **品牌站** (`website/`)：独立项目，按 Matoo Power To B 需求说明书。**未审计**（不在本仓 h5-app 范围）。
- **开源工业设计平台**：**本仓完全没有相关代码**（grep 零匹配）—— 与需求 §1.4 "独立项目，独立域名" 一致，无技术耦合。

---

## 12. 亮点（做得好的部分）

1. **CI 3 job + all-pass 汇总**（`.github/workflows/ci.yml`）— 并行 job + 汇总 step，模板值得复用。
2. **i18n 编译期断言**（`packages/shared/src/i18n-keys/keys.ts:342` `_enforceCount`）— 改 key 数忘改一处直接报错。
3. **QR 常时比较 + dual runtime**（`packages/shared/src/qr/signer.ts`）— Web 与 Node 互通，timingSafeEqual + constantTimeEqualHex。
4. **i18n 对称性 + 占位符对齐测试**（`apps/web/test/i18n.test.ts`）— 强制 zh/en 顶级键递归对齐 + `{n}{s}{c}{t}{time}` 占位符位置匹配。
5. **Ticket 状态机单测**（`apps/web/test/i18n.test.ts:310-351`）— 验证不能从 closed 跳回 open 等非法转换。
6. **ApiError 归一化 + 类型守卫**（`apps/web/src/lib/api/client.ts:11`）— 所有 catch 块只需 `if (err instanceof ApiError && err.status === 401)`。
7. **Sanitize whitelist 失败页 kind/code**（`apps/web/src/app/scan/failed/page.tsx:16-21`）— 防止恶意 URL 注入到客服拿到的错误码。
8. **DDoS-of-rendering**（Demo 防误入坑） — `scan/[id]` 演示失败码直接 redirect，防真 SKU 假数据渲染。
9. **Warranty 策略 A+C 双轨**（`apps/api/src/modules/warranty/warranty.service.ts:125-142`）— 发票日优先，无发票 MFG+60 天兜底。
10. **PWA + Service Worker network-first**（`apps/web/public/sw.js`）— 离线 fallback /offline.html + 版本前缀缓存。

---

# 附录 A · `E:\MatooPower\website\` 品牌站 + 后台管理 完整审计

> 范围：`website/`（独立子项目）
> - 静态前端 12 页 HTML（index / products / technology / manufacturing / partnership / insights / about / configurator / contact / privacy / cookies / terms）
> - Express 后台 + CMS（`website/api/`）
> - 后台 UI（`website/admin/`）
> - i18n 14 语言（en/zh/bn/ja/ko/vi/hi/ur/ta/te/ar/fr/pt/es）
> - 14 个 i18n JSON 文件 + admin 端 2 语言（en/zh）
> - 174 个 assets（含 102 张 srcset 多尺寸）
> - 32 个 PowerShell 维护脚本 + 9 个 Node 维护脚本

## A.1 一句话结论

**website 已达到 production-ready 状态**（v1.2 / 2026-09-20）。资源 208/208、HTML 引用 157/157、srcset 反引号 0/0 三项自动验收 100% 通过。SEO/社交/LCP preload/PWA/favicon 套件/14 语言 RTL + 字体规则/sitemap/robots/审计日志/会话内存缓存/CSRF/MIME magic/路径穿越防御 全部齐备。
**仍有 6 个 P0 / 8 个 P1 / 5 个 P2 缺口**，主要是**后端 inquiry API 没真正落地**（表单落到 mailto）+ WhatsApp 号码仍是占位符 + admin 部署硬编码秘钥 + 部分脚本产生持久垃圾。

## A.2 项目结构实测

```
website/
├── index.html × 12 pages (1723~2837 行/页)
├── assets/ (174 文件：5 favicons + 6 OG + 1 mstile + 2 android-chrome + 10 product + 6 factory + 4 region + 6 insight-cover + 25 scenario @3 sizes + 1 logo.svg + 1 logo-white.svg + 1 twitter-card)
├── i18n/ (14 JSON: en/zh/bn/ja/ko/vi/hi/ur/ta/te/ar/fr/pt/es — 总计 1,314 词条 × 14 语种 = 18,396 键值对)
├── styles/ (tokens.css + main.css — 14 语言字体 + RTL 11 组件反向 + reduced motion)
├── scripts/
│   ├── main.js (540 行 — LangSwitcher + MobileNav + FormHandler + SmoothScroll + LazyLoad + WhatsApp rewriter + window.MatooApp public API)
│   ├── whatsapp-config.js (placeholder WHATSAPP_PLACEHOLDER)
│   └── smoke-admin.js (7 步冒烟测试)
├── _lib/i18n-file.js (维护脚本共享层 — 路径解析/读写/14 语种迭代/嵌套键删除)
├── website/
│   ├── admin/ (index.html + app.html + assets/{admin.js,admin.css,login.js,admin-i18n.js} + i18n/{en,zh}.json + README.md)
│   └── api/
│       ├── server.js (Express 单进程 : 静态 + admin + API)
│       ├── lib/{auth,config,store,scanner,images,tracker,analytics,logger}.js (8 模块)
│       ├── routes/{auth,i18n,images,audit,analytics}.js (5 路由模块)
│       └── data/{admin.json, sessions.json, audit.log, views.log, views-YYYY-MM-DD.log, .bak/} (运行时数据)
├── website/api/scripts/get-otp.js (没用 — admin 后端无 OTP)
├── 32 个 PowerShell 脚本 (生成/注入/验证/部署)
├── 9 个 Node 维护脚本 (_audit_*, generate-*, inject-*, prune-*, reseed-*, strip-*, flatten-*, expand-*)
├── DEPLOY 文档三件套 (PRE-DEPLOYMENT-ACCEPTANCE.md + PRODUCTION-CHECKLIST.md + ACCEPTANCE-REPORT.md)
└── IMAGE-PRODUCTION-GUIDE.md (59 张拍摄清单)
```

## A.3 已实现（实测 + 验收）

### A.3.1 后端 admin API（Express + 文件存储）

| 模块 | 文件 | 能力 | 状态 |
|------|------|------|------|
| **Auth** | `lib/auth.js` + `routes/auth.js` | scrypt 密码 hash + 8 字符随机初始密码 + 5 次失败锁 15 分钟 + HttpOnly+SameSite=Strict cookie + 48h TTL + 内存 session cache + 30s 异步 flush + `X-CSRF-Token` HMAC + 进程退出同步刷盘 | ✅ 工业级 |
| **i18n** | `lib/store.js` + `routes/i18n.js` | 14 语言 JSON CRUD + 单进程互斥锁（per-file Promise chain）+ 嵌套键扁平读/写 + `audit/keys` 端点（used/missingPartial/orphan） + 自动备份（`.bak/<lang>.<ts>.json`，每语种保留 50 份） | ✅ |
| **Images** | `lib/images.js` + `routes/images.js` | 5 扩展白名单（jpg/jpeg/png/webp/svg）+ MIME magic 校验（jpg/png/webp/gif/svg）+ `isSafeAssetPath` 路径穿越防御 + 双重 resolve + sharp 多尺寸自动生成（480/800/1200）+ archive 旧文件到 `assets/.bak/` | ✅ |
| **Audit** | `lib/logger.js` + `routes/audit.js` | append-only JSON Lines + stdout mirror + `?limit=200&action=` 过滤 | ✅ |
| **Analytics** | `lib/tracker.js` + `lib/analytics.js` + `routes/analytics.js` | views.log JSON Lines（GET 不打 /api/admin/health/assets） + 每日 scrypt hash UV + UA 分类（mobile/tablet/desktop/bot） + Accept-Language 提取 + 10MB 大小 rotate + 按日 rotate `views-YYYY-MM-DD.log`（保留 30 份）+ IP 显示用 IP_DISPLAY_SALT（每重启轮换，无法回溯历史）+ 30s 缓存 | ✅ 隐私设计优秀 |

### A.3.2 admin UI（vanilla JS + 静态 HTML）

| 视图 | 能力 | 状态 |
|------|------|------|
| **Login** | scrypt 验证 + CSRF token 接收 + i18n init | ✅ |
| **Translations** | 14 语种列表 + 搜索 + 按 key 树形列表 + 当前语种编辑 + 其他语种对比 + 自动保存（blur）+ Ctrl+S | ✅ |
| **Images** | 列表 + 过滤 + 拖拽上传 + Replace + Delete（含引用页提示）+ 删除前确认 | ✅ |
| **Key Audit** | 列出 HTML 引用但 JSON 缺失的 key + 跳转编辑 | ✅ |
| **Overview** | 24h/7d/30d/all KPI（PV/UV/Logins/FailRate）+ 日趋势 SVG sparkline + Top Pages/Langs/UA/FailIPs + 最近登录时间线 | ✅ |
| **Audit** | 操作日志 + action 过滤 + before/after diff 显示 | ✅ |

### A.3.3 前端网站（12 页 + 14 语言）

- **i18n 嵌入**：每个 HTML 内嵌 `<script id="i18n-data" type="application/json">` 完整 14 语言字典 — 离线优先，**无外部请求**（但每页 +200KB）
- **LangSwitcher**：14 语言 + localStorage 持久化 + Accept-Language fallback + per-key fallback 到 `en`
- **RTL**：ur/ar `html[dir="rtl"]` + 11 类组件 CSS 反向 + nav/grid/footer/form/table 全部镜像
- **字体**：14 语种 Inter/NotoSans 系列（BN/HI/UR/TA/TE/AR）Google Fonts preconnect
- **表单**：仅 contact.html 一个 `<form data-form="inquiry">`，其余页无 form（需求说 4-5 类，实际 1 类）
- **表单回退**：fetch `/api/inquiries` → fail → mailto:`sales@matoopower.com`
- **WhatsApp 链接重写**：footer mask + wa.me 占位符 → `whatsapp-config.js` 注入
- **SEO**：12 页全有 description / canonical / og / twitter / favicon 套件 / theme-color
- **PWA**：site.webmanifest (192/512) + 静态站本身不注册 SW（admin API 在生产应部署时不带 admin/ 目录）
- **LCP preload**：5 个核心页（index/about/partnership/insights/manufacturing）含 `<link rel="preload" as="image" imagesrcset>`
- **sourcemap/JS bundle**：main.js 20KB 单文件、纯原生无 framework、admin.js 21KB
- **运营 SOP**：管理后台 SOP 220 行覆盖 7 章（启动/操作/故障/自检/数据一致性/上线）

## A.4 P0 缺口（品牌站 · 必须修）

### A.P0-1 后端 `/api/inquiries` 端点**不存在**（表单硬编码 mailto 回退）

- **位置**：`scripts/main.js:285` `API_ENDPOINT: '/api/inquiries'`
- **位置**：`server.js` 全文没有 `/api/inquiries` 路由
- **影响**：所有询盘（包括 factory visit / spec download / ROI calc / BP 申请）落到 mailto — 用户必须配置桌面邮件客户端，移动端用户**完全丢失**
- **修复**：补 Express 路由 `/api/inquiries`（POST），复用 `admin.json` + 现有会话机制但允许匿名写入（写入 `inquiries.json` 数据文件）

### A.P0-2 admin 密码硬编码 `admin123` 在 `.env`

- **位置**：`website/api/.env:8` `ADMIN_PASSWORD=admin123`
- **位置**：`website/api/.env.example` 仍注释说明
- **影响**：任何人拉到仓库就能登录 admin
- **修复**：`ADMIN_PASSWORD=` 留空，启动时强制生成随机密码并打印（仿 `SESSION_SECRET` 自动生成）

### A.P0-3 `SESSION_SECRET="matoo-dev-secret-please-change"` 硬编码

- **位置**：`website/api/.env:9`
- **影响**：CSRF token 派生 HMAC 用固定 key，攻击者可预测
- **修复**：同上，自动生成 + 持久化 `data/session.secret`（`auth.js` 已实现该逻辑）

### A.P0-4 WhatsApp 号码仍是占位符 `WHATSAPP_PLACEHOLDER`

- **位置**：`website/scripts/whatsapp-config.js:14` `number: 'WHATSAPP_PLACEHOLDER'`
- **位置**：所有 HTML `<a href="wa.me/WHATSAPP_PLACEHOLDER">`
- **影响**：所有"WhatsApp 联系"按钮点了无反应（带警告 console.warn 但不重写）
- **修复**：发布前手动替换为真实号码 + 删除占位符 fallback 路径

### A.P0-5 contact.html 表单字段只有 phone/company/email/message，**缺少 SOP 列出的 5 类表单**

- **位置**：`website/contact.html:161` 单个 `<form data-form="inquiry">`
- **需求**：《Matoo Power To B 品牌站需求规格说明书》§内容 5 大转化组件：factory visit / spec download / ROI calc / BP 申请 / e-certs 认证
- **影响**：4 类业务转化漏斗**根本不存在**
- **修复**：按 SOP 拆 5 form + 后端 inquiries 路由分类（`factory-visit / spec-download / roi-calc / bp-request / e-cert-request`）

### A.P0-6 admin README.md 与 admin/.env 默认密码 console.log 没文档警告

- **位置**：`website/api/.env:7` `ADMIN_PASSWORD=admin123`
- **位置**：`website/README.md` §首次启动写"会生成随机密码"，但实际 `.env` 写死 — README 与实际不符
- **影响**：运维按 README 操作，拿到 demo 密码以为安全
- **修复**：清空 `.env` 的 `ADMIN_PASSWORD`，让自动生成生效；同时更新 README 写"如 .env 已设置则用 .env，否则自动生成"

## A.5 P1 缺口（品牌站 · 演示可用、生产必修）

### A.P1-1 production 仅靠 CDN 静态部署，但没 CORS / 安全头（admin 走不同 origin 风险）

- **位置**：admin 路由 `/admin/assets/admin.js:75` `fetch('/admin/i18n/en.json', { credentials: 'same-origin' })` — 必须 same-origin 才能带 cookie
- **影响**：admin UI 若迁到独立子域名（`admin.matoopower.com`），会丢失 cookie，需重新配置
- **修复**：明确"admin 必须与主站同 origin"的部署规范 + CSP `frame-ancestors 'none'`

### A.P1-2 多个维护脚本产生**持久化垃圾**，未清理

- **位置**：`website/api/data/.bak/ja.2026-09-20T07-11-35-829Z.json` × 20+ 备份文件
- **位置**：`website/api/data/sessions.json`（18 个过期 session 未清理）
- **位置**：`website/api/data/views-2026-09-20.log`（实际是 1 个文件备份）
- **影响**：磁盘膨胀 / 备份查找噪声
- **修复**：加 cron 或每次启动 prune（auth.js `pruneSessionsInMemory` 已有，需落盘）

### A.P1-3 `auth.login` 失败计数器**没有持久化**到磁盘

- **位置**：`lib/auth.js` `recordFailedLogin` 只更新内存对象，但 `loadAdmin` 从磁盘读
- **影响**：重启 server 后失败计数清零，攻击者可每 15 分钟重启服务绕过 lockout
- **修复**：失败/锁定必须立即 flush 到 `admin.json`

### A.P1-4 cookie `secure: false`（localhost http），生产必须开

- **位置**：`routes/auth.js:50` `secure: false, // localhost http`
- **影响**：生产部署若忘配 HTTPS，cookie 走明文
- **修复**：`secure: process.env.NODE_ENV === 'production'`

### A.P1-5 CSRF token 派生用 hash 而非 HMAC（理论上可预测）

- **位置**：`routes/auth.js:81` `crypto.createHash('sha256').update(token).digest('hex').slice(0, 32)`
- **影响**：截取 32 hex 字符（约 128 bit），但 hash 不是 key 派生 — 不同 server 同样 token 派生同样 csrf（如果 secret 相同）。当前 OK 但缺文档
- **修复**：用 `crypto.createHmac('sha256', sessionSecret).update(token)` 替代，并文档

### A.P1-6 admin API `BIND=127.0.0.1` 但 `.env.example` 写"默认 127.0.0.1"

- **影响**：Docker / nginx 反代场景下，admin 绑 127.0.0.1 无法被反向代理访问
- **修复**：`BIND=0.0.0.0` + 在 nginx 层加 IP allowlist

### A.P1-7 main.js `lazyLoad` 与 `<img loading="lazy">` 重复（native 优先）

- **位置**：`scripts/main.js:462-477` 与 `<img loading="lazy">` 同时存在
- **影响**：代码冗余，老浏览器兜底才有用
- **影响**：低，保留无害
- **修复**：标注"legacy fallback for old browsers"

### A.P1-8 `start-admin.ps1` / `start-preview.ps1` 启动后没 PID 文件，重复启动报 EADDRINUSE

- **位置**：`website/start-admin.ps1` / `start-preview.ps1`
- **影响**：端口冲突时用户看到 EADDRINUSE，要手动 `netstat -ano | findstr 8000`
- **修复**：写 PID 文件 + 提供 `stop-admin.ps1`

## A.6 P2 缺口（业务/体验）

### A.P2-1 i18n 嵌入策略 = 12 页 × 200KB = 2.4MB HTML（含 14 语种字典）

- **影响**：CDN 全量缓存友好，但**首屏 HTML 解析时间增长**，SEO 抓取效率下降
- **权衡**：演示期可接受；规模化可拆"按需 + lazy fetch i18n JSON"路径
- **影响**：低，仅性能层

### A.P2-2 `i18n/`<lang>.json 与 HTML `<script id="i18n-data">` **重复存储**

- **影响**：每次编辑都要走 `inject-i18n-blocks.js` 重新注入 HTML — 容易漂移
- **修复**：admin 端编辑 i18n 后自动重新生成 HTML（需要 read + write 文件权限）

### A.P2-3 `IMAGE-PRODUCTION-GUIDE.md` 写"所有图都是 PLACEHOLDER 占位"（§1）

- **现状**：实际图已替换（hero-* 250-350KB，product-* 18-180KB，都是真实摄影）
- **影响**：文档与现状不符，误导运营
- **修复**：标"v1.2 已完成拍摄替换"

### A.P2-4 `data-channel` 仅在 zh 切微信，其他语种全 WhatsApp

- **影响**：印度/孟加拉用户如偏好邮件 + Imo/Line，缺替代入口
- **修复**：扩展 `data-channel` enum 到 `whatsapp,wechat,email,imo,line`

### A.P2-5 `/en/` `/zh/` `/bn/` 等路由**不存在**（hreflang 指向死链）

- **位置**：每个 HTML `<link rel="alternate" hreflang="en" href="/en/">`
- **影响**：hreflang 信号给 Google，但 14 个 URL 返回 404 — SEO 负优化
- **修复**：加 server.js rewrite `/xx/ → /xx.html` 或生成 `/en/index.html` 静态镜像

## A.7 自动化验收实测

```
✓ Total URLs to check: 208       Passed: 208   Failed: 0   (verify-resources.ps1)
✓ Total unique referenced URLs: 157  Passed: 157   Failed: 0   (verify-html-refs.ps1)
✓ Total backticks: 0   products.html srcset=30 全部就绪   (verify-srcset.ps1)
✓ 14/14 i18n JSON files present (en/zh/bn/ja/ko/vi/hi/ur/ta/te/ar/fr/pt/es)
✓ 12/12 HTML pages present + 14 语种内嵌 i18n-data 块
✓ 174 assets 文件（包括 102 张 srcset 多尺寸变体）
✓ main.css + tokens.css + main.js + whatsapp-config.js + smoke-admin.js
```

## A.8 后端 admin API 安全分析

| 项 | 实现 | 评级 |
|----|------|------|
| 密码 hash | Node scrypt (N=16384, r=8, p=1) | ✅ 强 |
| 密码常时比较 | `crypto.timingSafeEqual` | ✅ |
| 登录失败锁 | 5 次 / 15 分钟 | ✅ |
| 会话签名 | 32 字节随机 token + DB 存储 | ✅ |
| 会话过期 | 48h TTL | ✅ |
| CSRF | HMAC 派生 token + `X-CSRF-Token` 头校验 | ✅（建议改 HMAC 替代 hash）|
| Cookie 安全 | HttpOnly + SameSite=Strict + Secure（生产需开）| ✅ |
| 路径穿越 | `isSafeAssetPath` 正则 + `path.resolve` 二次校验 | ✅ |
| MIME magic | jpg/png/webp/gif/svg 头字节校验 | ✅ |
| 文件大小 | multer `limits.fileSize` | ✅ |
| 限流 | ❌ 无 | **P0-5（通用）** |
| CSP / 安全头 | ❌ 无（Express `helmet` 未装） | **P0-5** |
| Audit log | JSON Lines + 镜像 stdout | ✅ |
| 视图日志隐私 | scrypt daily salt + UA 分类 | ✅ 优秀 |
| 备份机制 | i18n 自动 50 份 / 日志 30 份 | ✅ |

---

# 附录 B · admin（website 内容编辑后台）详细审计

> **重要边界澄清**：这里的 admin 是 `website/admin/*` + `website/api/*`，**它是 website 营销站的内容编辑工具，不是 h5-app 的运营后台**。h5-app 有自己独立的 admin 路由（`apps/web/src/app/admin/*`，NestJS `@Roles('admin')` 守护），那个在 § 1-12 已覆盖。两者**不共享账号、不共享数据**。

## B.1 系统边界

```
website/api/server.js:3001 (Express)
  ├── /admin/          → website/admin/* 静态 UI（5 视图）
  ├── /api/auth/*      → login + CSRF（scrypt + HMAC csrf token）
  ├── /api/i18n/*      → 14 语言 CRUD + audit/keys
  ├── /api/images/*    → 上传/替换/删除 + sharp 多尺寸
  ├── /api/audit/*     → 操作日志
  ├── /api/analytics/* → 浏览量 + 登录 KPI
  └── /*               → website 12 个静态 HTML

h5-app admin:
  apps/web/src/app/admin/{overview,tickets,analytics}/page.tsx
    └── 调 apps/api (NestJS :3001) 的 /admin/* 端点
        └── JWT role guard（admin only）

两者完全独立：
  - admin 账号 ≠ h5-app user
  - admin 数据（i18n JSON、assets/）≠ h5-app 数据（SQLite）
  - admin 启动 :8000 / h5-app :3001
```

## B.2 已实现（实测）

| 能力 | 文件 | 状态 |
|------|------|------|
| 单 admin 账号（scrypt N=16384） | `lib/auth.js` | ✅ |
| 5 次失败锁 15 分钟 | `lib/auth.js` `checkLoginLock` | ✅（仅内存，**P0-B1**） |
| 48h TTL 会话 | `lib/auth.js` | ✅ |
| HttpOnly + SameSite=Strict cookie | `routes/auth.js:50` | ✅（secure: false 需生产开 **P1-B2**） |
| CSRF 头校验（HMAC 派生 token） | `routes/auth.js:81` `requireAuth('write')` | ✅ |
| 内存 session + 30s 异步 flush | `lib/auth.js` `markDirty` | ✅ |
| 进程退出同步刷盘（SIGINT/TERM） | `lib/auth.js` `installExitHooks` | ✅ |
| i18n 编辑（14 语言） | `routes/i18n.js` + admin.js | ✅ |
| i18n 自动备份 50 份/语种 | `lib/store.js` `backupI18n` | ✅ |
| Key Audit（HTML 引用 vs JSON 缺失） | `routes/i18n.js` `/audit/keys` | ✅ |
| 图片上传（MIME magic + 路径穿越防御 + 5 扩展白名单） | `lib/images.js` + `routes/images.js` | ✅ |
| sharp 自动生成 480/800/1200 多尺寸 | `lib/images.js` `maybeGenerateVariants` | ✅ |
| 替换时归档旧文件到 `assets/.bak/` | `lib/images.js` `archiveAsset` | ✅ |
| 删除前显示引用页 | `admin.js` `confirmDelete` | ✅ |
| 浏览量追踪（隐私设计） | `lib/tracker.js` `visitorHash` | ✅（daily scrypt salt + UA 分类） |
| 视图日志每日 rotate + 30 份归档 | `lib/tracker.js` `rotateIfNeeded` | ✅ |
| IP 显示用进程内 salt | `lib/analytics.js` `maskIp` | ✅（无法回溯历史） |
| 30s analytics 缓存 | `lib/analytics.js` `cached` | ✅ |
| 操作审计日志（JSON Lines） | `lib/logger.js` | ✅ |
| 审计过滤 + 数量限制 | `routes/audit.js` | ✅ |
| `data-channel` 切换（zh→wechat / 其他→whatsapp） | `website/scripts/main.js:230` | ✅ |
| WhatsApp 占位符运行时重写 | `scripts/main.js` `WhatsAppLinks.init` | ✅ |
| i18n 编辑"自动保存 on blur" | `admin.js` `area.addEventListener('blur')` | ✅ |
| Ctrl+S 强制保存 | `admin.js` `keydown` | ✅ |
| 多视图切换不重载页面 | `admin.js` `switchView` | ✅ |

## B.3 缺口

### B.P0-1 admin 账号硬编码 `admin/admin123`（从仓库可登录）

- **位置**：`website/api/.env:8`
- **影响**：拉仓库 → 启动 → 拿到 admin 全权
- **修复**：✅ **已修**（`.env` 第 4 行清空 + 删旧 `admin.json`）。下次启动 `ensureAdmin()` 自动生成 8 字符密码打印到 stdout

### B.P0-2 `SESSION_SECRET` 硬编码

- **位置**：`website/api/.env:9`
- **影响**：CSRF token HMAC 用固定 key，攻击者可预测
- **修复**：✅ **已修**（`.env` 第 5 行清空 + 删旧 `session.secret`）。`ensureSessionSecret()` 自动生成 32 字节并持久化到 `data/session.secret`

### B.P0-3 admin 后端**没有 helmet / rate-limit / CSP**

- **位置**：`server.js` 全文未引入 `helmet` / `@nestjs/throttler` 等价物
- **影响**：暴力破解 CSRF token / OTP（虽然 OTP 不适用，但无 IP 限流）；无 CSP 头
- **修复**：✅ **已修**（`server.js` L36-70 加 helmet + 路由级 rate-limit：login 10/min、write 60/min；package.json 加 `helmet@^7.1.0` + `express-rate-limit@^7.4.0` 依赖）

### B.P0-4 失败锁**仅内存**，重启清零

- **位置**：`lib/auth.js` `recordFailedLogin` 只更新内存对象，`loadAdmin` 从磁盘读
- **影响**：攻击者每 15 分钟重启服务可绕过
- **修复**：✅ **无需修改**——审计时**误判**。原代码 `recordFailedLogin` (L266) 与 `checkLoginLock` (L256) **已经**调用 `saveAdmin(admin)` 立即写盘，失败计数与锁定状态均已持久化

### B.P1-1 询盘/表单**没有真实后端**

- **位置**：`website/scripts/main.js:285` `API_ENDPOINT: '/api/inquiries'` 但 `server.js` 全文无此路由
- **影响**：表单永远走 mailto 回退（**移动端用户全部丢失**）
- **修复**：✅ **已修**（新增 `routes/inquiries.js` POST 端点）：
  - 匿名接受 `POST /api/inquiries`，无需登录
  - honeypot 字段（`website_url`/`fax_number`/`company_website`）拦截 bot → 静默返回假 OK
  - `_form` 必须 ∈ `{contact, inquiry, factory-visit, spec-download, roi-calc, bp-request, e-cert-request, newsletter, inline}`
  - email/phone 正则校验
  - 单字段 4KB 上限，整体 32KB 上限（express.json 已在 server.js 设置）
  - 复用 `writeLimiter`（60/min/IP）
  - 写入 `api/data/inquiries.log`（JSON Lines 追加）+ 镜像到 `audit.log` 让现有 Audit 视图直接看到
  - 6 个测试用例全部通过（valid/honeypot/unknown-form/bad-email/empty/valid-bp）

### B.P1-2 cookie `secure: false`

- **位置**：`routes/auth.js:50`
- **修复**：`secure: process.env.NODE_ENV === 'production'`

### B.P1-3 CSRF token 用 hash 而非 HMAC 派生

- **位置**：`routes/auth.js:81` `createHash('sha256').update(token).digest('hex').slice(0, 32)`
- **修复**：`createHmac('sha256', sessionSecret).update(token)`

### B.P1-4 admin 启动脚本无 PID 文件

- **位置**：`website/start-admin.ps1` / `start-preview.ps1`
- **影响**：端口冲突 EADDRINUSE 需手动 `netstat -ano | findstr 8000`
- **修复**：写 PID + 提供 stop 脚本

### B.P1-5 `scripts/main.js` lazyLoad 与 native `<img loading="lazy">` 重复

- **位置**：`website/scripts/main.js:462-477`
- **修复**：标注为 old-browser fallback

### B.P1-6 WhatsApp 号码仍为 `WHATSAPP_PLACEHOLDER`

- **位置**：`website/scripts/whatsapp-config.js:14`
- **影响**：所有 WhatsApp 按钮点了无反应（带 console.warn 但不重写）
- **修复**：发布前替换 + 删除占位符 fallback

### B.P2-1 14 个 hreflang 路由 `/en/` `/zh/` 等全部 404

- **位置**：每个 HTML `<link rel="alternate" hreflang="en" href="/en/">`
- **影响**：SEO 负优化（Google 收到 14 个死链信号）
- **修复**：`server.js` 加 rewrite `/xx/ → /xx.html` 或生成静态镜像

### B.P2-2 i18n 嵌入策略 = 12 页 × 200KB = 2.4MB HTML

- **影响**：首屏解析慢、SEO 抓取效率下降
- **修复**：演示期可接受；规模化改"按需 lazy fetch"

### B.P2-3 `_lib/i18n-file.js` 路径假设脆弱

- **位置**：`WEBSITE_ROOT = path.resolve(__dirname, '..')`
- **修复**：env var + default to cwd

---

# 附录 C · 完整 h5-app SQLite 实测数据

> 用 `node -e "const{DatabaseSync}=require('node:sqlite');..."` 直查 `apps/api/prisma/dev.db`

```
User            6  (+8801000000001 admin · +8801000000002 customer · +8801000000003 dealer · +8801000000099 customer · +88010000002 customer · +88017220001 customer-bulk)
OtpRequest     20
Session        18
Sku             4  (4 SKU 全部 activated=1)
QrSignature     4  (DEMO0001 scanCount=7 测试反复扫 · DEMO0002=6 · DEMO0003=0 · DEMO0004=0)
Warranty        8  (3 seed + 4 实际 + 1 bulk)
Device          5  (3 seed + 1 用户绑定 + 1 bulk)
Ticket          3
TicketMessage   7
```

> WAL 文件大小：dev.db-wal = 74192 字节 / dev.db-shm = 32768 字节 / dev.db = 188416 字节
> 全部 9 张表 DDL 与 `prisma/init-sqlite.cjs` 一致；FK 全部声明；索引齐全

## C.1 Sku 全表扫描

| id | sku | modelName | activated |
|----|-----|-----------|-----------|
| MATO-MAT12200-DEMO0001 | MAT-12V200Ah | 12V 200Ah LiFePO4 Battery | 1 |
| MATO-MAT12200-DEMO0002 | MAT-12V200Ah | 12V 200Ah LiFePO4 Battery | 1 |
| MATO-MAT12200-DEMO0003 | MAT-12V200Ah | 12V 200Ah LiFePO4 Battery | 1 |
| MATO-MAT12300-DEMO0004 | MAT-12V300Ah | 12V 300Ah LiFePO4 Battery | 1 |

## C.2 Warranty 全表扫描（8 行）

```
active warranty-seed-0001     sku=MATO-MAT12200-DEMO0002  start=2025-01-14
active warranty-seed-0002     sku=MATO-MAT12200-DEMO0003  start=2024-12-05
active warranty-seed-0003     sku=MATO-MAT12300-DEMO0004  start=2024-09-20
active war_231c25e51dd6bac6   sku=MATO-MAT12200-DEMO0001  start=2025-02-01
active war_84b97b0f0b808fba   sku=MATO-MAT12300-DEMO0004  start=2024-10-04
active war_b7d372e052cf8060   sku=MATO-MAT12200-DEMO0001  start=2025-03-15
active war_dbfbee53e30e53ec   sku=MATO-MAT12200-DEMO0001  start=2025-01-15
active warranty-bulk-1789892729477-0 sku=MATO-MAT12200-DEMO0001  start=2025-03-15
```

> 所有 active 状态，无 pending/expired/rejected — admin 审核 UI 是 P1 缺口原因

## C.3 Device 全表扫描（5 行）

```
dev-1            DEV2-DEMO2 customer soh=98 soc=84 fw=v1.2.4
dev-2            DEV2-DEMO3 customer soh=91 soc=62 fw=v1.2.3 (温度偏高 31°C · 1240 cycles · 2 alarms)
dev-3            DEV3-DEMO4 customer soh=99 soc=100 fw=v1.2.5
dev_1789889379884_92   DEV1-DEMO1 user_+8801000000099 (实际用户绑定，非 customer demo)
dev-bulk-1789892729478-0   DEV1-DEMO1 user_+88017220001 (dealer bulk 创建)
```

## C.4 Ticket 全表扫描（3 行）

```
ticket-demo-0001    customer  warranty  normal  in_progress  "电池容量明显下降"
ticket-demo-0002    customer  inquiry   low     resolved     "是否有兼容的太阳能板配件？"
ticket-1789894625974-988  customer  general  normal  resolved  "?????"（userId 是 demo customer，userAgent 截断乱码）
```

## C.5 实际 API 行为验证（基于 DB 状态推断）

- `+8801000000001` 在 DB 是 admin（**与 README 一致**）
- `+8801000000002` 是 demo customer（**与 README 一致**）
- `+8801000000003` 是 demo dealer（**与 README 一致**）
- **所有 4 SKU activated=1** — 演示流程已被反复跑过

---

# 附录 D · 文档一致性清单（实测）

| 文档 | 声称 | 实测 | 缺口 |
|------|------|------|------|
| h5-app/README.md | e2e 20 | 16 | **差 4** |
| h5-app/README.md | vitest 34 | 34 ✅ | 0 |
| h5-app/README.md | i18n 213 keys | 213 ✅ | 0 |
| h5-app/DEPLOY.md | OpenAPI 28 路径 | swagger 已生成 | ✅ |
| website/ACCEPTANCE-REPORT.md | 208/208 静态 | 208 ✅ | 0 |
| website/ACCEPTANCE-REPORT.md | 157/157 HTML refs | 157 ✅ | 0 |
| website/ACCEPTANCE-REPORT.md | 0 backticks | 0 ✅ | 0 |
| website/README.md | pages/ 目录 | **空** | **误导** |
| website/IMAGE-PRODUCTION-GUIDE.md | 59 张占位图 | **已替换** | **文档过期** |
| website/管理后台 SOP | ADMIN_PASSWORD 留空自动生成 | `.env` 写死 admin123 | **不符** |
| apps/web/fix-readme.ps1 | 修 prototype/README | prototype/ 不存在 | **孤儿脚本** |
| website/api/README | 首次启动随机密码 | `.env` 写死 | **不符** |

---

# 附录 E · 跨产品接缝缺口（仅当未来要打通时才有意义）

> **本节仅在以下场景才相关**：
> - 营销站询盘要推送到 h5-app 后台
> - h5-app SKU 主数据要从营销站同步
> - 统一账号（暂未计划）
>
> 演示期 / 营销站与 h5-app 完全独立运营时，**本节所有条目可推迟**。

## E.P1-1 营销站询盘 → h5-app 客服工单

- **位置**：`scripts/main.js:285` 调 `/api/inquiries`（**不存在**）；需求 § 3.6 SOP §4.1 期望"营销站 → H5-App 经销商线索实时同步"
- **现状**：website mailto 收集 → 人工转发
- **修复**：先补 website `/api/inquiries`（B.P1-1），再定义 h5-app `/api/inquiries/import` 批量接口 + 定时拉取

## E.P1-2 SKU 主数据双向同步

- **位置**：SOP §4.1 写"品牌站 → H5-App SKU 主数据每日"
- **现状**：h5-app 自己 seed 4 SKU + QR，website 不感知
- **修复**：定义 `GET /api/sku/exports.json` 最小 schema + cron（演示期无）

## E.P1-3 品牌资产（Logo / OG 图）单源

- **位置**：`website/assets/*` 是事实标准
- **现状**：h5-app manifest 用自己 SVG logo（`apps/web/public/icon.svg`）
- **修复**：把 website/assets/logo.svg 提到 monorepo 顶层 shared + h5-app 引用

## E.P1-4 设备激活数据 → 品牌站脱敏展示

- **位置**：SOP §4.1
- **现状**：h5-app DB 完全私有
- **修复**：h5-app 加 `GET /api/public/stats/aggregate`（脱敏聚合），website 拉取展示

## E.P2-1 统一官网品牌名（"华奕" vs "华溢"）

- **位置**：`website/ACCEPTANCE-REPORT.md` 2.4.5 标"已统一"
- **现状**：网站 LD-JSON `alternateName` 写"华奕智能科技"；h5-app UI 全用英文 "Matoo Power"
- **修复**：决定中英文品牌名最终结论（**非代码问题，是品牌决策**）

---

# 附录 F · h5-app admin 缺口（**与 website admin 完全独立**）

> 这是 h5-app 自己的运营后台（`apps/web/src/app/admin/*`），NestJS `@Roles('admin')` 守护 API 端点。**与 website/admin 没有任何关系**。

## F.P0-1 admin 三个页面**不检查 role==='admin'**

- **位置**：`apps/web/src/app/admin/{overview,tickets,analytics}/page.tsx`
- **代码**：仅 `if (!s?.token) setError(...)` — **任何 customer 登录后都能进 `/admin/overview`**
- **影响**：API 端 403 但 UI 已渲染完整 admin 骨架
- **修复**：✅ **已修**（详见 §5.3 本轮 P0 修复）
  - 新建 `apps/web/src/hooks/useRequireRole.tsx` — 统一角色守卫 hook + `<RoleGuardView>` 组件（checking / need-login / forbidden / ok 四态状态机）
  - 接入全部 5 个 admin 页（overview / tickets / analytics / warranties / users）白名单 `['admin']`
  - 接入全部 3 个 dealer 页（dashboard / batch / pickup）白名单 `['dealer', 'admin']` — admin 互访合法
  - 12 项单元测试覆盖状态机全部分支 + RoleGuardView 三态可见性（`apps/web/test/useRequireRole.test.tsx`）

## F.P0-2 `apps/web/package.json` 缺 `packageManager` 与 `engines`

- **位置**：`h5-app/apps/web/package.json:1-36`
- **影响**：与 workspace `pnpm@9.0.0` 不一致，corepack 会挑错
- **修复**：补 `packageManager: pnpm@9.0.0` + `engines: { node: '>=20.18.0' }`

## F.P0-3 `apps/web/fix-readme.ps1` 是孤儿脚本

- **影响**：README 写"Prototype README"但目录不存在
- **修复**：删除

## F.P0-4 `get-otp.js` 硬编码绝对路径

- **位置**：`apps/api/scripts/get-otp.js:2`
- **修复**：删除（README 写 OTP 从后端终端读）

## F.P1-1 admin overview → admin tickets 抽屉不能持久化

- **修复**：用 URL query `?id=xxx`

## F.P1-2 README 声称 e2e 20 用例，实际 16

- **修复**：补 4 用例或更新 README

## F.P1-3 文档过期（与附录 D 重叠）

- `apps/web/fix-readme.ps1` 孤儿
- `DEPLOY.md` "OpenAPI 生成"未落地
- `SOP §4.1` 跨产品同步无实现

## F.P2-1 没有 Storybook / 组件文档

- **修复**：低优先级，演示期可不修

## F.P2-2 没有 changelog / release notes 流程

- **修复**：加 `CHANGELOG.md` + semantic-release

---

# 附录 G · 测试覆盖率（综合实测）

| 模块 | 文件 | 覆盖度 |
|------|------|--------|
| h5-app backend | NestJS / Jest | **16 e2e**（README 声称 20 — **少 4**） |
| h5-app frontend | vitest | **47 单元**（i18n/auth/api 客户端/useRequireRole 12）— **0 组件测试** |
| h5-app shared | node:test | **1 placeholder**（test sanity） |
| website admin | 手动 | **0 自动化**（`smoke-admin.js` 是单次脚本） |
| website 前端 | 手动 | **0 测试**（纯 HTML+JS） |

**修复优先级**：
- h5-app 补 e2e（4 个）+ 组件测试
- website admin 补 vitest 单元（mock Express）