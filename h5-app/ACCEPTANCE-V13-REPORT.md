# Matoo Power H5-App · v1.3 P0「二维码 + 资料管理」验收报告

> v4.0 截至 2026-09-22 · 本地完成 · 端点矩阵 + 测试覆盖 + 部署路径

## 0. 决策基线

- **文件存储**：本地磁盘 + 反向代理（`apps/api/storage/{manuals,videos,thumbnails}/`），接口预留 `LocalStorageDriver` 与未来 `S3Driver` 切换点
- **多语言范围**：5 种全语言（zh/en/bn/hi/ur）均支持，每 SKU × 每语言 × 每版本独立记录
- **部署基线**：演示期 SQLite + 本地磁盘；生产期 Postgres + Cloudflare R2（接口兼容，本期不实现 R2 driver）
- **不在本期**：HLS 自适应码率、视频转码、CDN 防盗链（v1.3 后续增量）

---

## 1. 端点矩阵（v1.3 P0 新增 21 个端点）

### 1.1 SkuBatch 后端（admin 角色守卫）

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/admin/sku-batch` | 批次列表（搜索 + 分页） |
| GET | `/admin/sku-batch/:id` | 批次详情（含 SKU 数 + 文档数 + QR 数） |
| POST | `/admin/sku-batch` | 创建批次 |
| PATCH | `/admin/sku-batch/:id` | 编辑批次 |
| DELETE | `/admin/sku-batch/:id` | 软删（仅当未关联 SKU / 文档） |

**关键校验**：
- `batchCode` 全局唯一（正则 `BATCH-\d{4}Q[1-4]-\d{3,6}`）
- `mfgDate` 不允许未来日期
- 删除前校验：无关联 Sku + Document + QrBatch

### 1.2 SkuDocument 后端（admin 上传 + 公开下载）

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/admin/sku-document` | 文档列表（`?skuId=&type=&lang=&page=`） |
| GET | `/admin/sku-document/:id` | 文档元数据 |
| POST | `/admin/sku-document` | 上传文档（multipart/form-data） |
| DELETE | `/admin/sku-document/:id` | 软删除（写 deprecatedAt，磁盘文件 7 天后清理） |
| GET | `/admin/sku-document/:id/download` | 下载原文件（admin 走审计） |
| GET | `/public/sku-document/:skuId/:type/:lang` | **公开端点**（无 JWT）：扫码落地页拉说明书/视频 |

**上传事务化流程**：
1. multer 接收 multipart → buffer（内存）
2. 计算 sha256
3. 查重：SELECT WHERE skuId=? AND sha256=? → 命中返回 409
4. 校验版本号：SELECT WHERE skuId=? AND type=? AND lang=? AND version=?
5. storage.put(key, buffer)
6. 落 AuditLog（v1.2 AuditInterceptor 自动捕获 POST）

**安全策略**：
- PDF：MIME `application/pdf`，≤ 30 MB
- 视频：MIME `video/mp4, video/webm, video/quicktime`，≤ 200 MB
- 计算 SHA-256，**同 SKU × 同 sha256 拒绝重复上传**
- 文件名 sanitize：`storageKey = ${skuId}/${type}/${lang}/${version}-${uuid}.${ext}`，避免路径穿越

### 1.3 QR 批量生成后端

| 方法 | 路径 | 用途 |
|------|------|------|
| POST | `/admin/qr-batch` | 触发批量生成（body: `{batchId, quantity, size?}`） |
| GET | `/admin/qr-batch` | 列表（看历史任务） |
| GET | `/admin/qr-batch/:id` | 任务详情（生成数 / 状态 / 下载链接） |
| GET | `/admin/qr-batch/:id/download` | 下载 `${batchCode}-qr-${qty}.zip` |
| POST | `/admin/qr/:qrId/revoke` | 撤销单个 QR（写 revoked=true + 审计） |
| GET | `/admin/qr/revoked` | 列出已撤销 QR |

**批量签名流程**：
1. 校验：quantity ∈ [1, 5000]（演示期上限）；size ∈ [128, 1024]px
2. 查 SkuBatch 下的 SKU（可能一批次多型号）→ 若未关联 SKU → 400
3. 创建 QrBatch(status='running')
4. 同步生成（演示期 ≤ 5k）：
   - nonce = randomBytes(6).toString('hex')
   - text = `${sku.id}|${sku.serial}|${sku.batch.batchCode}|${nonce}`
   - sig = HMAC-SHA256(text)
   - INSERT QrSignature(qrId=`${sku.id}:${nonce}`, skuId, signature)
   - QRCode.toBuffer(text + '|' + sig, { width: 512 })
   - collect 到内存（5000 × ~5KB ≈ 25MB）
5. adm-zip → zip → 写 storage.put
6. UPDATE QrBatch(status='done', zipPath, finishedAt)
7. 返回 { taskId, statusUrl, downloadUrl }

### 1.4 前端 - admin 4 Tab

| 路由 | 文件 | 内容 |
|------|------|------|
| `/admin/sku` | `app/admin/sku/page.tsx` | **4 Tab 主页面** |
| Tab1 SKU 列表 | SkuListTab | 表格 + "上传文档"快捷 |
| Tab2 批次管理 | SkuBatchesTab | 卡片网格 + 新建/删除 Drawer |
| Tab3 文档管理 | SkuDocumentsTab | 列表 + 筛选(type/lang) + 上传 Drawer |
| Tab4 QR 批量 | QrBatchTab | 历史任务列表 + 新建 Drawer |

**5 个 admin 组件**：
- `AdminSkuTabs` - 4 Tab 导航
- `SkuBatchForm` - 批次创建/编辑 Drawer（带正则验证）
- `DocumentUploadDrawer` - 多语言文档上传（SKU + type + lang + version + file）
- `QrBatchDialog` - QR 批量生成表单 + 进度展示
- `LangChips` / `DocTypeChips` - 5 语言 / 4 文档类型 chip 单选

### 1.5 前端 - 用户态扫码页 + 公开 API 代理

| 路径 | 文件 | 用途 |
|------|------|------|
| `/scan/[id]` | `app/scan/[id]/page.tsx` | 真链接化（移除硬编码占位） |
| `/api/public/sku-document/[skuId]/[type]/[lang]/route.ts` | 服务端代理 | 转发到 `/public/sku-document/...` |

---

## 2. 测试覆盖

### 2.1 后端 e2e（新增 19 个，总计 66 个）

| 文件 | 用例数 | 通过 |
|------|------|------|
| `sku-batch.e2e-spec.ts` | 6 | 6 ✅ |
| `sku-document.e2e-spec.ts` | 7 | 7 ✅ |
| `qr-batch.e2e-spec.ts` | 6 | 6 ✅ |
| 旧用例（auth / sku / warranty / device / ticket / dealer / admin / swagger） | 47 | 47 ✅ |
| **合计** | **66** | **66** |

### 2.2 前端单测（新增 19 个，总计 120 个）

| 文件 | 用例数 | 通过 |
|------|------|------|
| `admin-sku.test.tsx` | 19 | 19 ✅ |
| `SparkLine.test.tsx` | 8 | 8 ✅ |
| `i18n.test.ts` | 40 | 40 ✅ |
| `useRequireRole.test.tsx` | 15 | 15 ✅ |
| `components.test.tsx` | 38 | 38 ✅ |
| **合计** | **120** | **120** |

### 2.3 Playwright e2e（新增 5 个用例 F8-F12）

| 文件 | 用例 | 验证点 |
|------|------|--------|
| `admin-sku.spec.ts` | F8 | admin → /admin/sku 看到 4 Tab |
| `admin-sku.spec.ts` | F9 | admin → 切批次 Tab → 「+ 新建批次」 |
| `admin-sku.spec.ts` | F10 | admin → 文档 Tab → 「+ 上传文档」 |
| `admin-sku.spec.ts` | F11 | admin → QR Tab → 「+ 新建 QR 任务」 |
| `admin-sku.spec.ts` | F12 | customer → /scan/[id] → 真文档卡片 |

### 2.4 冒烟脚本

| 文件 | 用例数 | 用途 |
|------|------|------|
| `apps/api/_smoke-v13.ps1` | 16 | Phase A 批次 CRUD (5) / Phase B 文档 (5) / Phase C QR 批量 + 撤销 (4) / Phase D RBAC (2) |

### 2.5 总测试统计

| 层 | 旧 | 新增 | 总计 |
|----|----|----|------|
| 后端 e2e | 47 | 19 | 66 |
| 前端单测 | 101 | 19 | 120 |
| Playwright | 7 | 5 | 12 |
| 冒烟脚本 | — | 16 | 16 |
| **合计** | **155** | **59** | **214** |

---

## 3. 关键文件清单

### 新建

| 路径 | 用途 |
|------|------|
| `apps/api/src/modules/storage/{storage.module.ts,storage.service.ts,storage.controller.ts,drivers/local.driver.ts,drivers/storage.driver.ts,dto/upload.dto.ts}` | 文件存储基础设施 |
| `apps/api/src/modules/sku-batch/{sku-batch.controller.ts,sku-batch.service.ts,sku-batch.module.ts,dto/}` | 批次管理 |
| `apps/api/src/modules/sku-document/{sku-document.controller.ts,sku-document.service.ts,sku-document.module.ts,public.controller.ts,dto/}` | 文档管理 |
| `apps/api/src/modules/qr-batch/{qr-batch.controller.ts,qr-batch.service.ts,qr-batch.module.ts,dto/,qr-png.util.ts}` | QR 批量生成 |
| `apps/web/src/app/admin/sku/page.tsx` | SKU 管理主页（4 Tab） |
| `apps/web/src/components/admin/{AdminSkuTabs,DocumentUploadDrawer,SkuBatchForm,QrBatchDialog,LangChips}.tsx` | 5 个 admin 组件 |
| `apps/web/src/app/api/public/sku-document/[skuId]/[type]/[lang]/route.ts` | 用户态代理路由 |
| `apps/api/test/e2e/{sku-batch,sku-document,qr-batch}.e2e-spec.ts` | 3 个新 e2e 文件 |
| `apps/web/test/admin-sku.test.tsx` | 前端单测（19 用例） |
| `apps/web/e2e/admin-sku.spec.ts` | Playwright 视觉（F8-F12） |
| `apps/api/_smoke-v13.ps1` | 冒烟脚本（16 项） |

### 修改

| 路径 | 修改内容 |
|------|---------|
| `apps/api/prisma/schema.prisma` | 新增 SkuBatch / SkuDocument / QrBatch 模型 + Sku.batchId 关联 |
| `apps/api/prisma/init-sqlite.cjs` | 自动跑 v13 迁移 |
| `apps/api/src/modules/admin/admin.module.ts` | 导入新模块（sku-batch / sku-document / qr-batch / storage） |
| `apps/api/src/modules/sku/sku.controller.ts` | 新增 `/sku/:id/qr` 端点 + revoked 校验 |
| `apps/api/src/modules/sku/sku.service.ts` | `findOne` 补 revoked 校验 |
| `apps/api/src/modules/scan-public/scan-public.module.ts` | 增加 revoked 处理 |
| `apps/api/package.json` | 新增依赖 `qrcode @types/qrcode adm-zip`（archiver 移除：被 adm-zip 替换） |
| `apps/web/src/app/scan/[id]/page.tsx` | 真链接化 + loading + 404 fallback |
| `apps/web/src/lib/api/operations.ts` | 新增 13 个 API 函数（listAdminSkuBatches / uploadAdminSkuDocument 等） |
| `apps/web/src/lib/api/client.ts` | 补齐 PATCH / DELETE 方法 |
| `apps/web/src/lib/api/endpoints.ts` | 新增端点常量 |
| `apps/web/src/locales/{zh-CN,en,bn,hi,ur}.ts` | 新增 adminSku.* + scan.manualUnavailable / videoUnavailable |
| `README.md` | 路由表 + v1.3 P0 章节 + 演示 PDF 提示 |
| `DEPLOY.md` | 文件存储章节 + Nginx X-Accel-Redirect + S3 切换点 |

---

## 4. 演示路径（管理员视角）

```
1. admin 登录 (+8801000000001) → /home
2. 进 /admin/sku → 切到 Tab2 批次管理
3. 点「+ 新建批次」 → 输入 BATCH-2026Q3-001 + 日期 → 卡片出现
4. 切到 Tab3 文档管理
5. 点「+ 上传文档」 → 选 SKU + 类型 + 语言 + 版本 + PDF → 上传成功 → 列表出现
6. 切到 Tab4 QR 批量
7. 点「+ 新建 QR 任务」 → 选批次 + 数量(2) → 生成完成 → 下载 ZIP
8. 解压 ZIP → 取任意 PNG → 手机扫码 → 进 /scan/[id] → 看到真 PDF 链接
9. 点击 PDF → 浏览器渲染正确
10. admin 撤销该 qrId → 用户再扫码 → 看到「二维码已停用，请联系客服」
```

---

## 5. 关键技术决策

| 决策 | 选择 | 原因 |
|------|------|------|
| ZIP 库 | `adm-zip` | CommonJS 友好；archiver 是 ESM-only 在 Jest VM 下报错 |
| 文件路径 | `apps/api/storage/` | 演示期本地磁盘；接口预留 S3Driver |
| 软删字段 | `deprecatedAt` | 保留历史 + 自动审计 + 7 天后清理 |
| QR 签名 | HMAC-SHA256(text) | 文本含 skuId/serial/batchCode/nonce，单向难伪造 |
| QR 生成数量上限 | 5000 | 演示期防止误操作 |
| QR PNG 大小 | 512×512 (默认) | 贴标 + 扫码两不误 |
| 多语言 | zh/en/bn/hi/ur 5 种 | 与国际化战略对齐（南亚 3 国） |
| 公开端点路径 | `/public/sku-document/:skuId/:type/:lang` | 路径含 lang 让前端无需二次解析 |

---

## 6. 不在本期范围（v1.4+ 候选）

- HLS 自适应码率 / 视频转码（ffmpeg worker）
- Cloudflare R2 driver（接口已预留）
- 二维码样式定制（Logo 嵌入 / 颜色 / 容错等级 UI）
- 文档全文检索（Meilisearch）
- 文档版本 diff / 审批流
- 经销商专属文档（v1.3 dealer 模块增强）
- 文件分发统计（按国家 / 经销商看下载量）

---

## 7. 验证 DoD

1. ✅ **admin 可演示**：登录 admin → /admin/sku → 4 Tab 切换 → 文档上传 → QR 批量 → 下载 ZIP → 扫码 → 真 PDF
2. ✅ **撤销链路**：admin 撤销 qrId → 用户扫码 → 看到"二维码已停用"
3. ✅ **多语言**：admin 上传 5 语言说明书 → customer 扫码（zh/en/bn/hi/ur）→ 对应语言 PDF
4. ✅ **角色隔离**：customer 调 /admin/sku-batch → 403（e2e 自动验证）
5. ✅ **审计**：所有 admin POST/PATCH/DELETE 落 AuditLog（v1.2 AuditInterceptor）
6. ✅ **测试**：后端 e2e 66/66 + 前端单测 120/120 + Playwright 12/12 + 冒烟 16/16
7. ✅ **文档**：ACCEPTANCE-V13-REPORT.md + README 路由表更新 + DEPLOY.md 增加存储章节

**状态：🟢 全部 DoD 已达成，可发布。**