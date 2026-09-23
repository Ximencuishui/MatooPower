# Matoo Power H5-App · 部署指南

> 演示期 → 生产期完整路径，从 Cloudflare Pages + Workers 到 Neon Postgres。

## 当前状态（演示期 / 本地可跑）

| 组件 | 当前实现 | 部署目标 |
|------|---------|---------|
| 前端 | Next.js 16 + React 19，build 后静态导出 | Cloudflare Pages |
| 后端 | NestJS 10 + node:sqlite | Cloudflare Workers（演示）→ Cloudflare VPS（生产） |
| 数据库 | SQLite 文件 | Neon Postgres / Cloudflare D1 |
| 文件存储 | —（占位） | Cloudflare R2 / AWS S3 |
| CI/CD | GitHub Actions（已写 workflow） | Cloudflare 自动从 main 部署 |
| 监控 | — | Sentry（前后端） |
| OTP | 后端日志输出 | Twilio / 阿里云短信 |

---

## 0. 部署前置清单

- [ ] GitHub repo 已创建（推送代码后 CI 自动跑）
- [ ] Cloudflare 账号 + 域名（演示期可用 `*.workers.dev`）
- [ ] Postgres 实例（Neon 免费层 / Cloudflare D1 演示层）
- [ ] Twilio 账号（生产期发送真短信）
- [ ] Sentry DSN（前后端错误监控）

---

## 1. Cloudflare Pages 部署（前端）

### 1.1 通过 Dashboard 部署（推荐）

1. Cloudflare Dashboard → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
2. 选择 GitHub repo `matoopower/h5-app`
3. 配置：
   - **Project name**: `matoo-h5-app`
   - **Production branch**: `main`
   - **Build command**: `cd apps/web && npm install && npm run build`
   - **Build output directory**: `apps/web/.next`
   - **Root directory**: `h5-app` （即 monorepo 根）
4. **Environment variables**（Production + Preview）：
   ```
   NEXT_PUBLIC_API_BASE = https://api.matoopower.com
   NODE_VERSION = 22
   ```
5. 保存 → 第一次 build 自动触发

### 1.2 通过 Wrangler CLI 部署

```bash
# 安装 wrangler
npm install -g wrangler

# 登录
wrangler login

# 在 apps/web 目录
cd apps/web
npx @cloudflare/next-on-pages@1 build   # 适配 CF Pages
wrangler pages deploy .vercel/output/static --project-name=matoo-h5-app
```

### 1.3 自定义域名

Cloudflare Pages → `matoo-h5-app.pages.dev`（自动）→ Custom domains → 添加 `app.matoopower.com`

---

## 2. Cloudflare Workers 部署（后端）

### 2.1 适配 Worker 限制

NestJS 默认依赖 `node:sqlite` + `node:crypto`，**Workers 运行时不支持**（Workers 没有文件系统）。

演示期策略：
- **Workers 不跑**：后端部署到 **Cloudflare VPS / Render / Railway**（便宜 Node 主机）
- 生产期：**迁到 Postgres + Drizzle/Prisma + Cloudflare 友好 Node 主机**

### 2.2 当前演示期最快路径：Render

`render.yaml`（monorepo 根）：

```yaml
services:
  - type: web
    name: matoo-api
    runtime: node
    rootDir: apps/api
    plan: starter  # $7/月
    buildCommand: npm install --ignore-scripts && npm run build && node prisma/init-sqlite.cjs /tmp/render.db && node prisma/run-seed.cjs
    startCommand: node --env-file=.env dist/src/main.js
    envVars:
      - key: NODE_VERSION
        value: 22
      - key: DATABASE_URL
        value: file:/tmp/render.db   # 演示期
      - key: JWT_SECRET
        generateValue: true
      - key: QR_HMAC_SECRET
        generateValue: true
      - key: OTP_TTL_SECONDS
        value: 300
      - key: WEB_ORIGIN
        value: https://app.matoopower.com
```

连接 GitHub → Render 自动部署。

### 2.3 生产期迁移 Postgres（Neon）

```bash
# 安装 pg 驱动
npm install --ignore-scripts pg
npm install -D @types/pg

# 改 DbService：分支
# if (DATABASE_URL.startsWith('postgres')) → 用 pg.Pool
# else → 用 node:sqlite（演示兼容）

# 用 Drizzle ORM（更轻量，对 Workers 友好）：
# schema.prisma → drizzle/schema.ts
# 所有 .all/.get/.run 改成 drizzle.select/.where/.insert
```

### 2.4 CORS + Security Headers

后端 main.ts 已经：
- ✅ CORS 允许 `WEB_ORIGIN`
- ✅ JWT / cookie 安全

需要再加（生产期）：
```typescript
app.use(helmet());  // 安全头
app.use(rateLimit({ windowMs: 60_000, max: 100 }));  // 限流
```

---

## 3. 数据库迁移（演示 → 生产）

### 3.1 当前 SQLite schema
9 张表（User / OtpRequest / Session / Sku / QrSignature / Warranty / Device / Ticket / TicketMessage），完整 DDL 在 `apps/api/prisma/init-sqlite.cjs`。

### 3.2 导出为 Postgres DDL

```bash
# 安装 sqlite3 CLI
# Linux: apt install sqlite3
# mac: brew install sqlite3

sqlite3 apps/api/prisma/dev.db .dump > /tmp/dump.sql
# 然后用 pgloader 或手工改语法
pgloader /tmp/dump.sql postgresql://user:pass@host/matoo
```

### 3.3 用 Prisma migrations

如果保留 Prisma schema（已写）：
```bash
DATABASE_URL=postgresql://... npx prisma migrate deploy
DATABASE_URL=postgresql://... node prisma/run-seed.cjs  # 需改写为 Prisma client
```

---

## 4. 文件存储（v1.3 P0 本地磁盘 + S3 切换点）

### 4.1 演示期：本地磁盘

```bash
# 默认路径：apps/api/storage/{manuals,videos,thumbnails}/
# 后端进程 UID 需要可写（755 权限）
mkdir -p apps/api/storage/{manuals,videos,thumbnails}
```

接口：`LocalStorageDriver` 实现 `put/get/delete/exists/getStream/getUrl`，生成 `storageKey = ${skuId}/${type}/${lang}/${version}-${uuid}.${ext}` 避免路径穿越。

### 4.2 Nginx X-Accel-Redirect（防直连）

```nginx
location /storage/ {
    internal;  # 禁止外部直接访问
    alias /var/matoo/storage/;
    add_header Content-Disposition "attachment;";  # 补充响应头
}

location /api/public/sku-document/ {
    # 前端代理 → 后端 → X-Accel-Redirect
    proxy_pass http://api_backend;
    proxy_set_header X-Accel-Redirect $upstream_http_x_accel_redirect;
}
```

### 4.3 清理脚本（软删 7 天后）

```bash
# /etc/cron.daily/matoo-storage-cleanup
find /var/matoo/storage -type f -mtime +7 -name "*.deprecated-*" -delete
find /var/matoo/storage -type d -empty -delete
```

### 4.4 生产期：S3Driver（v1.3+ 增量）

接口已预留，切换点：`apps/api/src/modules/storage/storage.module.ts` 中 `useClass: LocalDriver` → 改为 `S3Driver`。需要新增环境变量：

```bash
S3_BUCKET=matoo-documents
S3_REGION=auto   # Cloudflare R2
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
```

## 5. CI/CD 流水线（已写）

`.github/workflows/ci.yml` 跑：

```
push / PR to main
    ├─ api-test:  npm install → build → e2e (20 tests) → boot smoke
    ├─ web-test:  npm install → typecheck → vitest (34 tests) → build
    ├─ shared-test: build + test
    └─ all-pass: 汇总状态
```

所有 job 通过 → PR 可 merge。

部署是 **push 后自动**：
- Cloudflare Pages → main 触发 Pages build + 部署
- Render → main 触发 service redeploy

---

## 5. 环境变量（生产期必填）

| 服务 | 变量 | 来源 | 说明 |
|------|------|------|------|
| Web | `NEXT_PUBLIC_API_BASE` | Cloudflare Pages env | 后端 API base |
| API | `DATABASE_URL` | Postgres 连接 | Neon / Cloudflare D1 |
| API | `JWT_SECRET` | `openssl rand -base64 64` | 至少 64 字符 |
| API | `QR_HMAC_SECRET` | `openssl rand -base64 32` | 二维码签名密钥 |
| API | `OTP_TTL_SECONDS` | `300` | 验证码 5 分钟过期 |
| API | `WEB_ORIGIN` | `https://app.matoopower.com` | CORS 白名单 |
| API | `TWILIO_ACCOUNT_SID` | Twilio console | 真短信通道 |
| API | `TWILIO_AUTH_TOKEN` | Twilio console | |
| API | `TWILIO_FROM_NUMBER` | `+1xxx` | Twilio sandbox |
| API | `SENTRY_DSN` | Sentry project | 错误监控 |
| API | `NODE_ENV` | `production` | 强制 production 模式 |

---

## 6. 部署前 Checklist（演示 → 生产）

### 6.1 安全
- [ ] 替换 JWT_SECRET + QR_HMAC_SECRET（演示期值已暴露）
- [ ] 启用 HTTPS（CF Pages + Workers 默认）
- [ ] Sentry DSN 配置
- [ ] 速率限制（防暴力破解）
- [ ] 删除 init-sqlite.cjs 演示 init 逻辑（生产 DB 应由 Prisma migrate 管）

### 6.2 数据
- [ ] Neon Postgres 创建 + connection string 安全
- [ ] 从 SQLite 导出 demo 数据到 Postgres
- [ ] 写 Prisma seed.ts（生产期 admin 账号 bootstrap）

### 6.3 业务
- [ ] 接入 Twilio 短信通道（替换 console.log OTP）
- [ ] admin 工作台加 SSO/2FA（MFA via TOTP）
- [ ] dealer 专属价表（Dealer entity 独立化）

### 6.4 监控
- [ ] Sentry alert：5xx > 1% / 分钟
- [ ] Cloudflare Analytics
- [ ] uptime 监控（CF 自带 + BetterUptime / UptimeRobot）

---

## 7. Rollback 流程

```bash
# Cloudflare Pages：Dashboard → Deployments → 点旧版本 → "Rollback to this deploy"
# Render：Dashboard → matoo-api → Manual Deploy → 选旧 commit
```

演示期无回滚需要。

---

## 8. 自检清单（部署后跑一遍）

```bash
# 1. 前端可达
curl -I https://app.matoopower.com  # 200 + HTML

# 2. 后端 health
curl -I https://api.matoopower.com/api-json  # 200 + OpenAPI

# 3. 端到端
- 打开 https://app.matoopower.com
- 输入 +8801000000002 → 后端真短信发 OTP（生产期）
- 走完整激活流程
- 看真实 DB 写入

# 4. 监控
- Sentry 收到前端首次 console.error（如有）
- Cloudflare Analytics 显示 pv > 0
```

---

## 9. 成本估算（演示 vs 生产）

| 项 | 演示期（本地） | 生产期（最小化） |
|----|---------|---------|
| 前端 | $0 | Cloudflare Pages 免费层 |
| 后端 | $0 | Render Starter $7/月 或 CF Workers 免费层 |
| DB | $0 | Neon Free $0 / D1 $0 |
| SMS | $0（后端日志） | Twilio ~$0.0079/SMS |
| 监控 | $0 | Sentry Free $0 |
| CDN | $0（CF Pages） | $0 |
| **月合计** | **$0** | **$5-15** |

---

## 10. 故障排查

| 症状 | 排查 |
|------|------|
| 前端 CORS error | 检查 API `WEB_ORIGIN` env 是否含前端域名 |
| API 502 | Render 看 deploy log；最常见：DB 连接字符串错 |
| OTP 不收到 | 演示期看后端终端；生产期查 Twilio delivery log |
| i18n 切语言不生效 | 检查 localStorage `matoo.lang` 值是否在白名单 |
| Swagger UI 看不到端点 | 检查 controller 是否有 `@ApiTags` 或 class-level 装饰器 |
| e2e test fail | 本地跑 `npm run test:e2e` 复现；通常是 SQLite dbFile 未传 |

---

**总成本：30 分钟部署**（按本指南走完 1-6 步即可演示上线）。

**关键文档**：
- README.md（本地运行）
- DEPLOY.md（本文件，生产部署）
- API 文档：`https://api.matoopower.com/api`（Swagger UI 自动生成）
- 代码注释 + 类型即文档