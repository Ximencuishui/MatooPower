# Matoo Power H5-App · Monorepo

> Matoo Power 独立产品 · H5/PWA · 一体化 monorepo

## 子包

- `apps/web` — Next.js 16 + React 19（生产化 H5 前端，已接 API）
- `apps/api` — NestJS 10 + node:sqlite（演示期后端，18 端点，含 dealer + admin 角色鉴权）
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
| `/scan/[id]` | **API** `/sku/:id` | 公开 |
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

## 部署

- 前端：Cloudflare Pages（静态托管 Next.js 16 build）
- 后端：Cloudflare Workers（演示期）
- DB：演示期 SQLite → 生产期 Neon Postgres
- CI/CD：GitHub Actions（占位，待 W3 配置）

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