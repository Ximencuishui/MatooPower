# 《Matoo Power H5-App · 管理后台需求规格说明书》v1.0

> **文档版本**：v1.0（2026-09-21）
> **适用项目**：Matoo Power H5-App 独立产品（`h5-app/` monorepo）
> **目标读者**：产品负责人 / 运营 / 客服 / 后端 & 前端工程师
> **设计原则**：**运营/客服全权覆盖 · 演示期单机简化 · 生产期零改造前台 · 数据可追溯 · 角色最小权限**

---

## 修订记录

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-09-21 | 初版。基于 `apps/api/admin.controller.ts`（13 端点）+ `apps/web/src/app/admin/*`（5 个页面）+ `dealer/*` + `ticket/*` 现有实现反推规格 |

---

## 一、项目背景与目标

### 1.1 背景

Matoo Power H5-App 是面向终端用户、经销商、维修点的产品全生命周期服务与配件复购平台。
当前 `apps/api` 已经实现 `admin/*` 13 个端点、`apps/web` 已经实现 `/admin/overview /admin/users /admin/warranties /admin/tickets /admin/analytics` 5 个页面（含鉴权守卫），但**缺少一份对外的需求规格说明书**用于：

- 给运营 / 客服对齐可操作范围（能做什么 / 不能做什么）
- 给后端 / 前端工程师作为未来 P1/P2 迭代的需求基线
- 给品牌方 / 投资人 / 外部合作方作为「我们后台能干什么」的可读证明

### 1.2 与已有文档的关系

| 文档 | 作用 |
|------|------|
| `Matoo Power H5-App 独立产品需求说明书.md` | **产品层**需求（用户故事、业务流程、优先级）。本文是其 §3.7「后台管理」的**实现级展开** |
| `h5-app/README.md` | **工程层**操作手册（启动 / 演示账号 / 路由表 / P1/P2 状态） |
| `h5-app/DEPLOY.md` | **部署层**（CF Pages + Render + Postgres） |
| `Matoo Power 品牌站管理后台需求规格说明书.md` | **To B 品牌站**内容编辑后台（不同项目，本文不覆盖） |
| `Matoo Power 管理后台运营 SOP.md` | **品牌站后台**运营 SOP（不同项目） |

### 1.3 目标

| 维度 | 目标 |
|------|------|
| **业务** | 让 Matoo 运营 + 客服能完整管理 SKU / 保修 / 设备 / 工单 / 用户 / 经销商 / 报表 |
| **体验** | 手机壳 H5 内嵌即可使用；深链跳转；列表 + 搜索 + 分页三件套齐全 |
| **鉴权** | 角色最小权限：客服 ≤ 运营；经销商只看到自己触发的数据 |
| **可观测** | 关键操作（保修审核、工单状态切换）落 reviewNotes / 历史轨迹 |
| **生产就绪度** | Swagger 文档化、e2e 覆盖 RBAC、数据导出（CSV） |
| **架构** | 不引入新基础设施；复用现有 NestJS + node:sqlite/Postgres + Next.js 16 |

### 1.4 非目标（v1.0 不做）

- ❌ 多管理员协同编辑（运营单管理员即可，客服单管理员即可）
- ❌ 内容审核工作流 / 审批流（v1 一审即生效）
- ❌ 在线交易 / 商城后台（H5-App 的 `/shop` 仅前端收藏 + 演示数据，无后端交易）
- ❌ 财务结算 / 经销商分润
- ❌ 与品牌站账号打通（已在产品需求 §5 明确「MVP 不打通」）

---

## 二、角色与权限矩阵

### 2.1 角色定义

| 角色 | 标识 | 典型场景 | 入口 |
|------|------|----------|------|
| **终端用户** | `customer` | C 端扫码、激活、报修、看设备 | `/home /scan /warranty /device /tickets` |
| **经销商** | `dealer` | 批量代激活、查自己的出货保修 | `/dealer/dashboard /dealer/batch /dealer/pickup` |
| **运营** | `admin` | 全平台 SKU / 保修 / 设备 / 用户 / 工单管理，看所有报表 | `/admin/*`（5 个页面） |
| **客服** | `support`（v1.0 新增，详见 §2.3） | 仅看工单 + 回复工单，无权改保修/用户 | `/admin/tickets` |

> **注**：v1.0 演示期角色只有 `customer / dealer / admin` 三种；`support` 在 §2.3 列为「角色扩展规划」。

### 2.2 权限矩阵（v1.0 已实现 / 规划）

| 资源 / 动作 | customer | dealer | admin | support |
|------------|----------|--------|-------|---------|
| 查看自己的保修 | ✅ | — | ✅ | — |
| 查看自己触发的保修 | — | ✅ | ✅ | — |
| 查看**全部**保修 | — | — | ✅ | — |
| 审核保修（改 status） | — | — | ✅ | — |
| 查看自己的设备 | ✅ | — | ✅ | — |
| 查看自己触发的设备 | — | ✅ | ✅ | — |
| 查看**全部**设备 | — | — | ✅ | — |
| 查看自己的工单 | ✅ | — | ✅ | ✅ |
| 查看全部工单 | — | — | ✅ | ✅ |
| 回复工单（自己的） | ✅ | — | ✅ | ✅ |
| 回复工单（别人的） | — | — | ✅ | ✅ |
| 改工单状态 / severity | — | — | ✅ | ✅ |
| 创建工单 | ✅ | — | ✅ | ✅ |
| 查看全部用户 | — | — | ✅ | — |
| 改用户角色 | — | — | ✅（v1 仅日志） | — |
| 批量激活 SKU | — | ✅ | ✅ | — |
| 查看运营概览 / 趋势 / 分布 | — | — | ✅ | — |
| 查看经销商工作台 | — | ✅ | ✅ | — |

### 2.3 角色扩展规划（v1.1+）

- 新增 `support` 角色：客服仅 `/admin/tickets` + 回复，无 `/admin/overview /admin/users /admin/warranties`
- 后端通过 `@Roles('admin','support')` + `RolesGuard` 实现；前端通过 `useRequireRole(['admin','support'])` 守卫
- 不新增独立客服数据库表，复用 `User.role` 字段（值域：`customer | dealer | admin | support`）

---

## 三、信息架构与路由

### 3.1 前端页面（已实现）

| 路径 | 文件 | 鉴权 | 主要内容 |
|------|------|------|----------|
| `/admin/overview` | `apps/web/src/app/admin/overview/page.tsx` | admin | KPI 卡片（SKU/用户/保修/设备/工单）+ 紧急工单告警 + 快捷入口 |
| `/admin/users` | `apps/web/src/app/admin/users/page.tsx` | admin | 用户列表（搜索 + 分页 + role 过滤） |
| `/admin/warranties` | `apps/web/src/app/admin/warranties/page.tsx` | admin | 保修列表 + 审核弹窗 |
| `/admin/tickets` | `apps/web/src/app/admin/tickets/page.tsx` | admin | 工单列表 + 状态/严重度筛选 + KPI |
| `/admin/analytics` | `apps/web/src/app/admin/analytics/page.tsx` | admin | 趋势折线图 + 分布柱状图（SVG 自绘） |

### 3.2 后端 API 端点（已实现）

**全部位于 `apps/api/src/modules/admin/admin.controller.ts`**，均挂 `@Roles('admin')` + `JwtAuthGuard + RolesGuard`：

| 方法 | 路径 | 鉴权 | 用途 | 关键参数 |
|------|------|------|------|----------|
| GET | `/admin/sku` | admin | SKU 列表 | `?q=&page=&pageSize=` |
| GET | `/admin/warranties` | admin | 保修列表 | `?q=&page=&pageSize=&status=` |
| GET | `/admin/devices` | admin | 设备列表 | `?q=&page=&pageSize=` |
| GET | `/admin/users` | admin | 用户列表 | `?q=&page=&pageSize=&role=` |
| POST | `/admin/warranties/:id/review` | admin | 审核 / 改保修状态 | `{ status, notes? }` |
| GET | `/admin/tickets` | admin | 全部工单 | `?status=&severity=&q=&page=&pageSize=` |
| GET | `/admin/tickets/stats` | admin | 工单 KPI | — |
| GET | `/admin/overview` | admin | 平台 KPI 总览 | — |
| GET | `/admin/analytics/trends` | admin | N 日趋势 | `?days=30` |
| GET | `/admin/analytics/breakdown` | admin | 维度分布 | `?type=warranty\|device\|ticket&groupBy=sku\|country\|severity\|role` |

### 3.3 经销商独立端点（已实现，admin 同样可访问）

**位于 `apps/api/src/modules/dealer/dealer.controller.ts`**：

| 方法 | 路径 | 鉴权 | 用途 |
|------|------|------|------|
| GET | `/dealer/me` | dealer+admin | 经销商概览 |
| GET | `/dealer/warranties` | dealer+admin | 经销商触发的保修 |
| GET | `/dealer/devices` | dealer+admin | 经销商触发的设备 |
| POST | `/dealer/bulk-activate` | dealer+admin | 批量激活（事务式） |

### 3.4 IA 总览

```
/admin（admin guard）
├── /overview       → 平台 KPI 总览
├── /users          → 用户管理（搜索 + 分页 + role 过滤）
├── /warranties     → 保修管理（审核入口）
├── /tickets        → 客服工作台（筛选 + 回复）
└── /analytics      → 趋势 + 分布（图表）

/dealer（dealer + admin guard）
├── /dashboard      → 出货 / 激活 / 保修概览
├── /batch          → 批量激活
└── /pickup         → 代客绑定（占位 / v1.1）

/tickets（customer + admin guard）
├── /tickets        → 我的工单
├── /tickets/new    → 提交工单
└── /tickets/:id    → 工单详情 + 回复
```

---

## 四、模块详细规格

### 4.1 平台总览 `/admin/overview`

**用途**：admin 每天第一眼看的地方。

**KPI 卡片**（响应字段 `AdminOverviewDto.overview`）：

| 卡片 | 字段 | 来源 SQL |
|------|------|----------|
| SKU 总数 | `sku.total` / `sku.activated`（副） | `COUNT(Sku)` / `COUNT(Sku WHERE activated=1)` |
| 用户总数 | `user.total` / `user.dealer`（副） | `COUNT(User)` / `COUNT(User WHERE role='dealer')` |
| 有效保修 | `warranty.active` / `warranty.activeThisMonth`（副，highlight） | `COUNT(Warranty WHERE status='active')` |
| 设备总数 | `device.total` / `device.boundThisMonth`（副） | `COUNT(Device)` |
| 工单 open 数 | `ticket.open` | `COUNT(Ticket WHERE status IN open/in_progress/waiting_customer)` |
| 紧急工单 | `ticket.urgent` | `COUNT(Ticket WHERE severity IN high/urgent AND status NOT IN resolved/closed)` |
| 本月新增工单 | `ticket.newThisMonth`（副） | `COUNT(Ticket WHERE createdAt >= 月初)` |

**交互**：

- 紧急工单 ≥ 5 时顶部出现红色告警条
- 每个 KPI 卡片点击 → 跳到对应列表页（如「保修」卡片 → `/admin/warranties?status=active`）
- 失败时 `ErrorBlock` 组件 + 「重试」按钮（P0 UX-10）

### 4.2 用户管理 `/admin/users`

**列表字段**：`id / phone / email / displayName / role / createdAt / warrantyCount / deviceCount`

**筛选**：顶部搜索框 `?q=`（模糊匹配 phone/email/displayName/id）+ role 下拉 `?role=customer|dealer|admin`

**分页**：默认 20/页，上限 100

**操作**（v1.0 演示期）：仅展示。改 role / 封禁在 §6 P1 路线图中

### 4.3 保修管理 `/admin/warranties`

**列表字段**：`id / sku（sku / modelName / serial）/ user（phone / displayName）/ country / city / status / createdAt / endAtWhole / reviewNotes`

**筛选**：`?q=`（sku / serial / phone / displayName）+ `?status=pending|active|expired|rejected`

**审核弹窗**（`POST /admin/warranties/:id/review`）：

```ts
{
  status: 'active' | 'pending' | 'expired' | 'rejected',
  notes?: string
}
```

- 仅 admin 可调；返回 404 / 403
- 写入 `Warranty.status` 与 `Warranty.reviewNotes`
- **审计留痕**：v1.1 计划追加 `WarrantyReviewLog` 表（who/when/from/to/notes）

### 4.4 工单管理 `/admin/tickets`

**列表字段**：`id / subject / severity / status / createdAt / user（phone）/ sku / lastMessageAt`

**筛选**：`?status=open|in_progress|waiting_customer|resolved|closed` + `?severity=low|medium|high|urgent` + `?q=`

**KPI 卡**（来自 `/admin/tickets/stats`）：

- open / in_progress / waiting_customer / resolved / closed 五态数量
- urgent 数（severity ∈ high/urgent 且未 resolved/closed）
- today 新增

**详情 + 回复**：复用 `/tickets/:id`（用户态接口，admin 全权访问）

**状态机**（`ticket.service.ts` 已实现）：

```
open → in_progress → waiting_customer ↔ in_progress
   ↘ resolved → closed（不可逆）
```

### 4.5 数据分析 `/admin/analytics`

**两个端点，二选一展示**：

#### 趋势 `/admin/analytics/trends?days=30`

```ts
{
  days: 30,
  warranty: [{ day: '2026-09-01', c: 12 }, ...],  // 补齐缺失日期
  device:   [{ day, c }, ...],
  ticket:   [{ day, c }, ...]
}
```

- 前端 `<SparkLine>` 自绘 SVG 折线图
- 默认 30 天，可切 7/30/90

#### 分布 `/admin/analytics/breakdown`

| `type` | `groupBy=sku` | `groupBy=country` | `groupBy=severity` | `groupBy=role` |
|--------|----------------|-------------------|--------------------|----------------|
| `warranty` | ✅ TOP 20 SKU | ✅ | — | — |
| `device` | ✅ TOP 20 SKU | — | — | ✅ user role |
| `ticket` | — | — | ✅ severity | — ticket status |

- 前端柱状图（`<SparkLine>` 变体 / 简单 div 列表）

### 4.6 经销商工作台（admin 也走同一套）

- `/dealer/dashboard`：概览（出货 / 激活 / 待审保修 / 本月新增）
- `/dealer/warranties`：经销商触发的保修列表（按 `Sku.activatedByUserId` 过滤）
- `/dealer/devices`：经销商触发的设备列表
- `/dealer/bulk-activate`：批量激活表单（QR + 客户手机号 + 发票号/日期）

**事务式批量激活**（`dealer.service.ts.bulkActivate`）：

- 校验 SKU 全存在 + 未激活
- 找/建 customer user（按 phone upsert）
- 计算保修期（INVOICE 优先；否则 MFG+60 天）
- 写 Warranty + Device + 标记 SKU activated
- 任一失败 → 全部回滚

---

## 五、非功能需求

### 5.1 性能

| 指标 | 目标 | 实测基线 |
|------|------|----------|
| 列表页 TTFB | ≤ 500ms | 演示期 SQLite 通常 < 50ms；生产 Postgres P95 ≤ 300ms |
| overview 接口 | ≤ 500ms | 7 个 COUNT 查询并行；演示期 < 100ms |
| trends / breakdown | ≤ 800ms | GROUP BY + 补齐日期；演示期 < 200ms |
| 列表页前端首屏 | ≤ 2s（南亚弱网 3G） | H5 + Next.js 16 SSR/CSR 混合 |

### 5.2 安全

| 维度 | 要求 |
|------|------|
| 鉴权 | JWT (HS256) + `RolesGuard`（`@Roles('admin')` 装饰器 + Reflector） |
| 密码 | OTP 6 位数字（演示期后端 console 输出；生产期接 Twilio） |
| 限流 | `@nestjs/throttler`（`AppThrottlerGuard`）默认 60 req/min/IP |
| CORS | 生产期收敛到 `matoopower.com / h5-app.matoopower.com` |
| 数据加密 | 发票号 / 设备 ID HMAC-SHA256（`packages/shared/qr/signer.ts`） |
| 审计日志 | v1.1 计划：所有 admin 写操作（reviewWarranty / ticket 状态切换）写入 `AuditLog` 表 |
| 防 SQL 注入 | 全部使用参数化查询（`db.run/all/get` 第二参数 `?...args`） |

### 5.3 可观测

- 接口失败 → `AllExceptionsFilter` 统一格式 `{ ok: false, code, message, traceId }`
- 启动日志：`Nest application successfully started` + 监听端口
- e2e 覆盖：20 用例（auth / sku / warranty / device / ticket / dealer / admin / swagger / RBAC）
- 单元测试：47 用例（前端 i18n / auth-store / API client / Shop filter / Compare / Ticket 状态机 / useRequireRole）

### 5.4 数据合规

- 客户手机号 / 邮箱：可按 GDPR / 南亚本地法规导出 / 删除（v1.1 计划 `DELETE /admin/users/:id`）
- 发票信息：演示期明文；生产期列级加密（`Warranty.invoiceNo / invoiceAmount`）
- 数据保留：工单 2 年；保修 5 年；操作日志 1 年

### 5.5 多语言

- 后端错误码 / 日志：英文
- 前端后台：演示期仅 zh-CN；v1.1 计划补 en / bn
- 后台页面文案走 i18n 字典（`apps/web/src/locales/zh-CN.ts` 已包含 `adminOverview.*`）

### 5.6 可用性

- H5 手机壳内可用，但 P1 建议运营在桌面浏览器使用（管理端表格密集，手机壳单列堆叠仅作应急）
- 深链友好：`/admin/tickets?status=open&severity=urgent` 直链生效
- 失败重试：`ErrorBlock` 一键重试（P0 UX-10）
- Loading：`PageLoading`（骨架屏 / Spinner）

---

## 六、API 契约（核心端点）

> 完整契约见 Swagger UI：`http://localhost:3001/api`（演示期）

### 6.1 `GET /admin/overview`

**响应**：
```json
{
  "ok": true,
  "overview": {
    "sku":       { "total": 124, "activated": 89 },
    "user":      { "total": 412, "dealer": 7 },
    "warranty":  { "active": 89, "activeThisMonth": 23 },
    "device":    { "total": 76, "boundThisMonth": 18 },
    "ticket":    { "open": 12, "urgent": 3, "newThisMonth": 41 }
  }
}
```

### 6.2 `POST /admin/warranties/:id/review`

**请求**：
```json
{ "status": "rejected", "notes": "发票号不存在" }
```

**响应 200**：
```json
{ "ok": true, "warranty": { "id": "warranty-...", "status": "rejected", "reviewNotes": "发票号不存在", ... } }
```

**错误**：
- 404 `warranty {id} 不存在`
- 403（非 admin）
- 400（status 枚举不匹配）

### 6.3 `GET /admin/analytics/trends?days=30`

**响应**：
```json
{
  "ok": true,
  "days": 30,
  "warranty": [{ "day": "2026-09-01", "c": 12 }, ...],
  "device":   [{ "day": "2026-09-01", "c": 5  }, ...],
  "ticket":   [{ "day": "2026-09-01", "c": 8  }, ...]
}
```

### 6.4 通用分页结构

```json
{
  "ok": true,
  "items": [...],
  "total": 412,
  "page": 1,
  "pageSize": 20
}
```

---

## 七、运营 SOP（要点）

> 完整 SOP 与 `Matoo Power 管理后台运营 SOP.md`（品牌站）分开管理。

### 7.1 日常巡检（运营 / 客服）

| 频率 | 操作 | 入口 |
|------|------|------|
| **每天 09:00** | 看 `/admin/overview`：紧急工单 ≥ 3 立即处理 | `/admin/overview` |
| **每天 10:00** | 处理 `/admin/tickets?status=open` + `severity=urgent` | `/admin/tickets` |
| **每周一** | 看 `/admin/analytics`：本周新增保修 / 设备 / 工单趋势 | `/admin/analytics` |
| **每周三** | 审核 `Warranty.status='pending'`（v1.1 才启用，当前直接 active） | `/admin/warranties` |
| **每月 1 号** | 对账：经销商批量激活数 vs 实际出货数（`/dealer/dashboard`） | `/dealer/dashboard` |

### 7.2 关键操作红线

- **禁止**通过 admin 接口直接改 `User.role='admin'` 给非授权账号（v1.1 加审计日志后可放给主管理员）
- **禁止**用 `/admin/warranties/:id/review` 把 `rejected` 改回 `active` 后不写 `notes`
- **禁止**绕过 `/dealer/bulk-activate` 直接用 SQL 改 `Sku.activated`（破坏 dealerName 关联）

### 7.3 故障应急

| 现象 | 排查 | 处理 |
|------|------|------|
| `/admin/overview` 500 | 看 API 日志 `traceId` | 检查 DB 连接（`apps/api/.env` 中 `DATABASE_URL`） |
| 趋势图日期缺失 | 看 `trends` 端点是否补齐 | 已实现 `fillDays`，无需处理 |
| 工单状态改不了 | 看 `Ticket.status` 状态机 | `resolved → closed` 不可逆；`closed` 需重建工单 |
| 批量激活 409 Conflict | SKU 已被其他 dealer 激活 | 在 `/admin/sku` 查 SKU 归属 |

---

## 八、待确认 / 风险

| # | 项 | 状态 | 决策建议 |
|---|----|------|----------|
| 1 | 是否新增 `support` 角色（仅工单权限） | 待产品确认 | v1.1 加，DB schema 加枚举值 |
| 2 | `WarrantyReviewLog` 审计表 | 待产品确认 | v1.1 加，记录 who/when/from/to/notes |
| 3 | `DELETE /admin/users/:id` GDPR 合规删除 | 法务 | v1.1 加，软删 + 匿名化 |
| 4 | 经销商专属价格表（独立 Dealer 表） | 产品 | v1.1 解耦 `User.role='dealer'` 与 `Dealer` 实体 |
| 5 | 工单 SLA（首次响应 / 解决时限） | 客服 | v1.2 加，自动超时升级 severity |
| 6 | 二维码批次管理（§3.7 提到但未实现） | 运营 | v1.2 加批次表 + 导出 CSV |
| 7 | 订单 / 库存管理（§3.7 提到但未实现） | 产品 | 演示期 `/shop` 不带交易；v2 启动 |
| 8 | 多语言后台（en / bn 等） | 国际化 | v1.1 加，复用现有 i18n keys |

---

## 九、优先级路线图

### 9.1 v1.0（已实现 ✅）

- 13 个 admin 端点 + 5 个前端页面
- RBAC（admin / dealer / customer）
- SKU / 保修 / 设备 / 用户 / 工单列表 + 搜索 + 分页
- 平台 KPI 总览 + 趋势 + 分布
- Swagger / e2e / 单元测试 / CI

### 9.2 v1.1（建议下个迭代）

- `support` 角色（仅工单）
- `WarrantyReviewLog` 审计
- 关键操作审计日志中间件
- 列表 CSV 导出（`?format=csv`）
- 多语言后台（en / bn / ur / hi）

### 9.3 v1.2+

- 工单 SLA 自动升级
- 二维码批次管理（批次生成 / 导出 / 关联 SKU）
- 经销商独立 Dealer 表 + 专属价格
- 订单 / 库存管理（接入真实支付 + 物流）
- 财务结算 + 经销商分润

---

## 十、附录

### 10.1 演示账号（与 README 对齐）

| 角色 | 手机号 | 鉴权范围 |
|------|--------|----------|
| Admin | `+8801000000001` | `/admin/*` `/dealer/*` 全部 |
| Dealer | `+8801000000003` | `/dealer/*`（不含 `/admin/*`） |
| Customer | `+8801000000002` | `/auth/*` `/sku/*` `/warranty/*` `/device/*`（自己） |
| Support | — | v1.1 引入 |

### 10.2 关键文件索引

- 后端：`h5-app/apps/api/src/modules/admin/{admin.controller.ts,admin.service.ts,admin.module.ts}`
- 后端 RBAC：`h5-app/apps/api/src/common/guards/{jwt-auth.guard.ts,roles.guard.ts}`
- 后端鉴权装饰器：`h5-app/apps/api/src/common/decorators/{current-user.decorator.ts,roles.decorator.ts}`
- 后端经销商：`h5-app/apps/api/src/modules/dealer/*`
- 后端工单：`h5-app/apps/api/src/modules/ticket/*`
- 前端页面：`h5-app/apps/web/src/app/admin/{overview,users,warranties,tickets,analytics}/page.tsx`
- 前端守卫：`h5-app/apps/web/src/hooks/useRequireRole.tsx`
- 前端 API：`h5-app/apps/web/src/lib/api/{client.ts,endpoints.ts,operations.ts}`
- 前端 i18n：`h5-app/apps/web/src/locales/zh-CN.ts`（`adminOverview.*` 命名空间）
- 数据 schema：`h5-app/apps/api/prisma/schema.prisma`（User / Sku / Warranty / Device / Ticket）
- Swagger：`http://localhost:3001/api`

### 10.3 与「产品需求说明书」对照表

| 产品需求 §3.7 bullet | 本文 spec § | 状态 |
|---------------------|-------------|------|
| SKU 管理 | §4 + admin/sku | v1.0 ✅ |
| 二维码生成与批次管理 | §8 风险 6 | v1.2 规划 |
| 激活记录查询 | §4.3 + admin/warranties | v1.0 ✅ |
| 保修审核 | §4.3 + admin/warranties/:id/review | v1.0 ✅ |
| 用户与权限管理 | §4.2 + admin/users | v1.0 列表；改 role v1.1 |
| 经销商管理 | §4.6 + dealer/* | v1.0 ✅；独立 Dealer 表 v1.1 |
| 订单与库存管理 | §8 风险 7 | v2 |
| 设备数据看板 | §4.4 + admin/tickets + admin/analytics | v1.0 ✅ |
| 工单管理 | §4.4 + admin/tickets | v1.0 ✅ |
| 多语言内容管理 | §8 风险 8 | v1.1 规划 |
| 数据报表（激活量 / 保修率 / 故障率 / 复购率） | §4.5 + admin/analytics | v1.0 趋势+分布；故障率/复购率 v1.2 |

---

## 十一、总结

Matoo Power H5-App 管理后台（v1.0）已具备**运营 + 客服日常所需的全套能力**：13 个 admin 端点、5 个前端页面、RBAC 三角色完整覆盖、Swagger + e2e + 单元测试齐备、生产部署文档齐备。

**下一步建议**：在 v1.1 中优先落地 `support` 角色、`WarrantyReviewLog` 审计、CSV 导出，使后台从「能管」升级为「可审计、可导出、可分权」。