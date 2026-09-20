# Matoo Power API · 演示期后端

NestJS 10 + SQLite（node:sqlite 内置驱动）。H5/PWA 演示环境。

> **关于 Prisma**：原始方案使用 Prisma + SQLite，但当前 Windows 沙盒拒绝派生 `prisma generate` 的 query-engine 二进制。本仓库采用 **`node:sqlite`（Node 22+ 内置）+ 原生 SQL**，完全绕过 Prisma engine 子进程。`prisma/schema.prisma` 保留作为数据模型契约 + 文档参考；运行时由 `src/common/db/db.ts` 的 `DbService` 走 node:sqlite。
>
> 切换到无沙盒环境后，可执行 `prisma generate && prisma migrate dev` 完成真正的 Prisma 迁移；services 后续可逐步替换回 `PrismaClient`。

## 监听

- 默认端口：`http://localhost:3001`
- CORS：放行 `http://localhost:3000`（apps/web dev）

## 演示账号（prisma/seed.ts 或 prisma/run-seed.cjs 生成）

| 角色 | 标识 | 备注 |
| --- | --- | --- |
| admin | phone `+8801000000001` | Demo Admin |
| customer | phone `+8801000000002` | Demo Customer（演示扫码激活 / 设备绑定的标准用户） |
| dealer | phone `+8801000000003` | Demo Dealer (BD) |

演示 SKU（4 个，与 apps/web DEMO_DEVICES 对齐）：

- `MATO-MAT12200-DEMO0001` · 200Ah · 未激活
- `MATO-MAT12200-DEMO0002` · 200Ah · 已激活
- `MATO-MAT12200-DEMO0003` · 200Ah · 已激活
- `MATO-MAT12300-DEMO0004` · 300Ah · 已激活

## 第一次启动

> ⚠️ 当前 DSH 沙盒拒绝派生 `npm.cmd` / `node.exe`。以下命令请在**普通 PowerShell 终端**（非 sandbox）执行。

```bash
cd E:\MatooPower\h5-app\apps\api
# 若需要纯 node:sqlite 启动，可直接 node --env-file=.env dist/src/main.js
# 若要从源码编译：
npm install --ignore-scripts   # 避免 bcrypt 等 native binding 报错，改用 bcryptjs
# 生成 dist/：
npx tsc -p tsconfig.json --outDir dist --rootDir .
# 初始化 SQLite schema（首次）：
node prisma/init-sqlite.cjs
# 填充演示数据：
node prisma/run-seed.cjs
```

## 启动

```bash
# 生产模式（直接跑编译后的 dist）：
node --env-file=.env dist/src/main.js

# 开发模式（增量编译 + watch）：
npm run start:dev
```

## 演示 OTP 流程

1. 调用方：`POST /auth/otp/request` `{ "phone": "+8801000000002" }` → 200 `{ok, sent, ttl}`
2. **从后端终端日志读 OTP**：形如

   ```
   [AuthService] 📨 [OTP] phone=+8801000000002 code=482917 ttl=300s (从后端终端读取验证码)
   ```

3. `POST /auth/otp/verify` `{ "phone": "+8801000000002", "code": "482917" }` → 200 + JWT

> 演示策略：服务端随机生成 6 位数字、**打印到 console.log**、**落库 OtpRequest**。**不接 Twilio**，不写"123456"硬编码。

## 端点清单

| Method | Path | 鉴权 | 说明 |
| --- | --- | --- | --- |
| POST | `/auth/otp/request` | 公开 | 申请 OTP |
| POST | `/auth/otp/verify` | 公开 | 校验 OTP，发 JWT |
| POST | `/auth/email/login` | 公开 | email + password 登录 |
| GET  | `/sku/:id` | 公开 | 查 SKU + QR 签名（自动累计 scan_count） |
| POST | `/sku/admin/seed` | 公开 | 演示用 seed |
| POST | `/warranty/activate` | JWT | 激活保修（策略 A + C 兜底） |
| GET  | `/warranty/mine` | JWT | 我的保修 |
| GET  | `/warranty/:id` | JWT | 保修详情 |
| POST | `/device/bind` | JWT | 绑定设备 |
| GET  | `/device/mine` | JWT | 我的设备 |
| GET  | `/device/:id/health` | JWT | 设备健康板（mock + 趋势） |
| GET  | `/admin/sku` | JWT | 后台：所有 SKU |
| GET  | `/admin/warranties` | JWT | 后台：所有保修 |
| GET  | `/admin/devices` | JWT | 后台：所有设备 |
| GET  | `/admin/users` | JWT | 后台：所有用户 |
| POST | `/admin/warranties/:id/review` | JWT | 后台审核保修 |

错误响应统一为：

```json
{ "statusCode": 404, "error": "NOT_FOUND", "message": "SKU UNKNOWN 不存在" }
```

## curl 验证

```bash
# 1. 申请 OTP
curl -X POST http://localhost:3001/auth/otp/request \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+8801000000002"}'

# 2. 从后端终端日志读 OTP，然后验证
OTP=482917   # ← 替换为日志中真实数字
curl -X POST http://localhost:3001/auth/otp/verify \
  -H 'Content-Type: application/json' \
  -d "{\"phone\":\"+8801000000002\",\"code\":\"$OTP\"}"

# 3. 拿到 JWT 后访问受保护端点
TOKEN=eyJhbGciOi...
curl http://localhost:3001/sku/MATO-MAT12200-DEMO0002

curl -X POST http://localhost:3001/warranty/activate \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"skuId":"MATO-MAT12200-DEMO0001","country":"BD","city":"Dhaka","invoiceDate":"2025-02-01","invoiceAmount":76000}'

curl http://localhost:3001/device/dev-1/health -H "Authorization: Bearer $TOKEN"
```

## 保修期计算（策略 A + C 兜底）

- **策略 A**：有发票 → `startAt = invoiceDate`（不得早于 MFG）
- **策略 C**：无发票 → `startAt = sku.mfgDate + 60 days`
- 各部件独立计算：
  - `endAtWhole = startAt + warrantyMonthsWhole`
  - `endAtCell = startAt + warrantyMonthsCell`
  - `endAtBms = startAt + warrantyMonthsBms`
  - `endAtParts = startAt + warrantyMonthsParts`
- 激活响应里 `policy` 字段标记 `'INVOICE'` 或 `'MFG_FALLBACK'`，便于前端展示来源。

## 二维码 HMAC

- 算法：`HMAC-SHA256(QR_HMAC_SECRET, payload)` → hex
- 签发格式：`{skuId}|{serial}|{batch}|{nonce}`
- 默认 secret（演示）：`dev-only-secret-change-me`（写在 `.env`）
- 验签：`QrSignerService.verify(qrId, signature)` → `{ok, reason?}`

## 已知限制（演示期）

- SQLite 单文件（node:sqlite），不支持并发写
- OTP 走 console.log，不是真短信
- 没有 refresh token，没有密码找回
- 没有 OpenAPI / Swagger（演示期不开）
- 没有 Webhook / IoT 设备真实接入（健康数据是 mock + jitter）
- Admin 端点当前只需登录 JWT，未做 role-based 鉴权（演示期简化）

## 重启 / 调试

```bash
# 干净重启 SQLite + 重新 seed
rm -f prisma/dev.db prisma/dev.db-journal
node prisma/init-sqlite.cjs
node prisma/run-seed.cjs

# 调试模式：tsc + node inspect
node --env-file=.env --inspect dist/src/main.js

# 类型检查
npx tsc -p tsconfig.json --noEmit

# 跑 e2e 烟雾测试（可选，未依赖 jest runtime）
node dist/test/app.e2e-spec.js
```