# Matoo Power H5-App · Monorepo

> Matoo Power 独立产品 · H5/PWA · 一体化 monorepo

## 子包

- `apps/web` — Next.js 16 + React 19（生产化 H5 前端，已接 API）
- `apps/api` — NestJS 10 + node:sqlite（演示期后端，21 端点，含 dealer + admin 角色鉴权 + Swagger + 趋势分析）
- `packages/shared` — 共享 zod schema + 二维码 HMAC + 213 i18n keys

## 本地开发（演示期）

需要 **2 个终端**：

```bash
# 终端 1：后端
cd E:\MatooPower\h5-app\apps\api
node --env-file=.env dist/src/main.js
# 监听 http://localhost:3001
# OTP 在该终端 console 中输出（演示期未接 Twilio）

# 终端 2：前端
cd E:\MatooPower\h5-app\apps\web
npm run dev     # 开发模式，HMR
# 监听 http://localhost:3000
```

如果首次运行：

```bash
# 一次性：装依赖 + 建库 + 种子
cd E:\MatooPower\h5-app\apps\api
npm install --ignore-scripts     # 避开沙盒的 prisma engine 子进程
npm run build                    # tsc → dist/
node prisma/init-sqlite.cjs      # 建表
node prisma/run-seed.cjs         # 填充演示数据
```

## 演示流程

### 终端用户（CUSTOMER）
1. 打开 `http://localhost:3000` → 自动跳到 `/scan/MATO-MAT12200-DEMO0001`
2. 看到验真页 → 点 **激活保修**
3. 手机号 `+8801000000002` → 在**后端终端**看 OTP → 填入 → 登录
4. 三步表单 → 提交 → 跳电子保修卡
5. 进 **我的设备** → 看到设备列表（来自 `/device/mine`）
6. 点设备 → 健康看板 + SoC 趋势（来自 `/device/dev-1/health`）
7. 切右上 **EN** 看英文版（所有 i18n 字典已补齐）

### 经销商（DEALER）
1. 手机号 `+8801000000003` 登录
2. 进 **我的** → 自动看到 **经销商工作台**入口
3. 点 **工作台** → 看 overview（激活保修 / 设备 / 本月新增）+ 最近保修列表
4. 进 **批量激活** → 勾选 SKU → 填客户 + 发票 → 提交 → 看跳到 dashboard
5. 重新进 **工作台** → 数字已更新

### 运营（ADMIN）
1. 手机号 `+8801000000001` 登录
2. **所有端点可用**（含 `/admin/*` 后台管理）
3. 进 **我的** → 看到经销商工作台入口（admin 也能进 dealer view）

## 演示账号

| 角色 | 手机号 | 鉴权范围 |
|------|--------|----------|
| Customer | `+8801000000002` | `/auth/*` `/sku/*` `/warranty/*` `/device/*`（自己） |
| Admin | `+8801000000001` | + `/admin/*` `/dealer/*` |
| Dealer | `+8801000000003` | `/dealer/*`（不含 `/admin/*`） |

OTP：6 位数字，**从后端终端 console 读取**（未接 Twilio）。

## 角色鉴权验证

```
curl /admin/sku     with customer token → 403
curl /dealer/me     with customer token → 403
curl /admin/sku     with dealer token   → 403
curl /dealer/me     with dealer token   → 200
curl /admin/sku     with admin token    → 200
```

## 路由

| 路由 | 来源 | 鉴权 |
|------|------|------|
| `/` | redirect | — |
| `/home` | demo | — |
| `/scan` | demo | — |
| `/scan/[id]` | **API** `/sku/:id` + `/public/sku-document/:skuId/:type/:lang` | 公开 |
| `/scan/failed` | client | — |
| `/activate/[id]` | **API** `/warranty/activate` | JWT (customer) |
| `/warranty/[id]` | demo | — |
| `/device/[id]` | **API** `/device/:id/health` + `/diagnostics` | JWT |
| `/devices` | **API** `/device/mine` | JWT |
| `/devices/compare` | demo | — |
| `/dealer/batch` | **API** `/dealer/bulk-activate` | dealer + admin |
| `/dealer/dashboard` | **API** `/dealer/me` + `/dealer/warranties` | dealer + admin |
| `/auth` | **API** `/auth/otp/{request,verify}` | 公开 |
| `/tickets` | **API** `/tickets/mine` | JWT |
| `/tickets/new` | **API** `POST /tickets` | JWT |
| `/tickets/[id]` | **API** `/tickets/:id` + `/reply` + `PUT` | JWT (customer看自己) / admin 全权 |
| `/admin/overview` | **API** `/admin/overview` | admin |
| `/admin/tickets` | **API** `/admin/tickets` | admin |
| **`/admin/sku`** | **API** `/admin/sku-batch` + `/sku-document` + `/qr-batch` (4 Tab) | admin |
| `/admin/sku` Tab1 | SKU 列表 | admin |
| `/admin/sku` Tab2 | 批次管理 | admin |
| `/admin/sku` Tab3 | 文档管理 | admin |
| `/admin/sku` Tab4 | QR 批量 | admin |
| `/shop` | demo + `?sku=` 兼容筛选 + 收藏 | — |
| `/profile` | client + session.role | — |
| `/legal/terms`, `/legal/privacy` | static | — |

## P1 子集（P1 业务能力，已本地完成）

| 能力 | 后端 | 前端 |
|------|------|------|
| **售后工单系统** | Ticket + TicketMessage 表；用户 CRUD + 客服管理 | `/tickets` `/tickets/new` `/tickets/:id` `/admin/tickets` |
| **远程诊断** | `/device/:id/diagnostics`（基于 soh/cycles/temp/alarms 智能判定） | 设备详情页"运行诊断"按钮 |
| **运营概览** | `/admin/overview`（SKU/用户/保修/设备/工单 KPI） | `/admin/overview` 看板 + 快捷入口 |
| **配件商城基础版** | —（演示数据） | `/shop` 分类筛选 + SKU 兼容 + 收藏（localStorage） |
| **多语言占位** | — | `zh / en` 完整；`bn / hi / ur` 占位（fallback 到 en + β 标识） |

## v1.3 P0「二维码 + 资料管理」（本地完成）

v1.3 P0 闭环：admin 后台批次管理 + 5 语言多版本文档上传 + HMAC 签名批量 QR 生成 + 用户扫码页看到真 PDF/视频链接 + 扫码撤销联动。

| 能力 | 后端 | 前端 | 测试 |
|------|------|------|------|
| **批次管理** | `/admin/sku-batch` CRUD | `/admin/sku` Tab2 卡片 + Drawer 表单 | e2e 6 / 单测 3 |
| **多语言文档** | `/admin/sku-document` 上传 + `/public/sku-document/:skuId/:type/:lang` | 上传 Drawer + 扫码页真链接 | e2e 7 / 单测 3 |
| **QR 批量生成** | `/admin/qr-batch` 异步任务 + ZIP + `/admin/qr/:qrId/revoke` | `/admin/sku` Tab4 任务列表 + Drawer | e2e 6 / 单测 2 |
| **扫码页真链接化** | `/public/sku-document` 公开端点 | `/scan/[id]` 移除硬编码 → 加载 real PDF / video | e2e 1 (E2E F12) |

### 演示 PDF 准备（首次部署）

```bash
# seed 会在 demo SKU 上挂一份 dummy PDF（手动验证上传流程）
cd E:\MatooPower\h5-app\apps\api
node prisma/seed-documents.cjs  # 写 5 语言 dummy PDF 到 demo SKU
```

### 存储路径

默认 `apps/api/storage/` 子目录（`manuals/` / `videos/` / `thumbnails/`）。生产期切 `S3Driver`（接口已预留，本期未实现）。

## P2 子集（生产就绪度，已本地完成）

| 能力 | 状态 |
|------|------|
| **后端 OpenAPI / Swagger UI** | ✅ `/api` + `/api-json`，28 路径全文档化 |
| **后端 e2e 测试** | ✅ 20 用例（auth / sku / warranty / device / ticket / dealer / admin / swagger / RBAC） |
| **前端单元测试** | ✅ 47 用例（i18n 对称 / auth-store / API client / Shop filter / Compare logic / Ticket 状态机 / useRequireRole 守卫） |
| **admin 列表搜索 + 分页** | ✅ SKU / 保修 / 设备 / 用户 / 工单 全部支持 `?q= ?page= ?pageSize=` |
| **数据分析报表** | ✅ `/admin/analytics/trends` + `/breakdown` + SVG 趋势图 + 分布柱状图 |
| **GitHub Actions CI** | ✅ 3 job pipeline（api-test / web-test / shared-test + all-pass 汇总） |
| **部署指南** | ✅ `DEPLOY.md`：CF Pages + Render + Postgres 完整路径 + 成本估算 + Rollback |

## 部署

生产期完整部署路径 → 见 [DEPLOY.md](./DEPLOY.md)。

要点：
- **前端**：Cloudflare Pages（monorepo 根 → `apps/web`）
- **后端**：演示期 Render / 生产期 Cloudflare VPS + Postgres
- **DB**：Neon Postgres（生产）/ SQLite（演示）
- **CI/CD**：`.github/workflows/ci.yml` 跑 3 job 完整流水线
- **CI badge**：push 到 main 后 GitHub Actions 自动跑

## 环境变量（apps/web）

| 变量 | 默认 | 说明 |
|------|------|------|
| `NEXT_PUBLIC_API_BASE` | `http://localhost:3001` | 后端 base URL |

## 技术决策记录

| 决策 | 选择 | 原因 |
|------|------|------|
| 后端 DB | SQLite (node:sqlite) | 演示期零运维；schema 与 Prisma 一致 |
| HMAC | 双运行时 (Node + Web Crypto) | 前后端共用一套 |
| JWT | localStorage | 演示期简化；生产期换 httpOnly cookie |
| 二维码 | 前端 demo 失败码 + 后端真 SKU | 演示三种失败场景 |
| OTP | 后端日志输出 | 未接 Twilio（按用户决策） |
| 角色鉴权 | @Roles + RolesGuard（NestJS Reflector） | 双层（JWT → Role），与 NestJS 生态对齐 |
| Dealer 关联 | `Sku.activatedByUserId`（dealer user） | 简化演示；W3+ 加独立 Dealer 表 |