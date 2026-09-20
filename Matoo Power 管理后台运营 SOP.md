# Matoo Power · 品牌站管理后台 · 运营 SOP

> 版本：v1.0 · 最后更新：2026-09-20
> 适用范围：`e:\MatooPower\website\` 下属的全部代码与资源
> 维护者：内容/技术

---

## 0. 一句话简介

本后台是一个**本地单进程 Node 服务**，让内容运营在浏览器里直接改前端文本和图片，**无需触碰代码或服务器**。它只在 127.0.0.1:8000 监听，**不可外网访问**——上线前请勿把它部署到公网主机。

---

## 1. 首次启动（一次性）

```powershell
# 1) 进入后台 API 目录
cd e:\MatooPower\website\api

# 2) 安装依赖（一次性）
npm install

# 3) 创建 .env（决定管理员密码和会话密钥）
copy .env.example .env
notepad .env
# 必改项：
#   ADMIN_PASSWORD=你的强密码
#   SESSION_SECRET=随机长字符串
```

> **当前开发默认值**：账号 `admin`，密码 `admin123`（在 `api/.env` 中）。
> **重置密码**：删除 `api/data/admin.json` 后重启 server，系统会重新用 `.env` 中的 `ADMIN_PASSWORD` 生成 hash。
> **生产部署**：务必改成强随机密码，并同时修改 `SESSION_SECRET`。

启动方式有三种，任选其一：

| 方式 | 命令 | 适用场景 |
|---|---|---|
| **一键脚本** | `.\website\start-admin.ps1` | 日常启动（推荐） |
| 后台进程 | `cd website\api ; node server.js` | 调试 / 日志查看 |
| 守护进程 | 用 nssm / PM2 包成服务 | 长时间无人值守（不建议） |

启动成功后：

```
==============================================================
 Matoo Power · Admin & Website
==============================================================
 Frontend   : http://127.0.0.1:8000/
 Admin UI   : http://127.0.0.1:8000/admin/
 API base   : http://127.0.0.1:8000/api
 Health     : http://127.0.0.1:8000/health
 Listening  : 127.0.0.1:8000
==============================================================
```

打开 [http://127.0.0.1:8000/admin/](http://127.0.0.1:8000/admin/) → 用 `.env` 里的密码登录。

---

## 2. 日常操作（运营人员）

### 2.1 改一段文案

1. 打开 `/admin/` 登录 → 进入「**i18n**」视图。
2. 顶部选择语言（EN / 中），中间表格自动按页面分组列出所有翻译键。
3. 在搜索框输入关键字（例如 `hero.title`）过滤。
4. 点对应单元格的编辑图标，输入新文案，**实时保存**。
5. 所有改动都会在 14 种语言目录下独立保存，前台按用户当前选择的语言加载。

### 2.2 上传/替换一张图片

1. 进入「**Images**」视图。
2. 在列表中找到要替换的图片：
   - **替换现有文件**：选中原文件 → 点「Replace」→ 选择本地图片（jpg/png/webp，≤ 10 MB）。
   - **上传新文件**：用「Upload」表单，输入子目录（可选）+ 文件名 + 勾选 `replace=true`（如需覆盖）。
3. 上传成功后，sharp 会自动生成 `@480 / @800 / @1200` 三档尺寸；旧的原图自动归档到 `assets/.bak/`。

### 2.3 翻译骨架（JavaScript）文件

仓库内置 14 个翻译骨架文件 (`i18n/<lang>.json`)，其中 11 个 (ja/ko/vi/hi/ur/ta/te/ar/fr/pt/es) 仍是英文占位。完整翻译节奏：

1. **机翻**：用 DeepL / Google Translate 批量翻译 en.json → 保留 100% 的键结构。
2. **人审**：母语运营人员校对（重点：CTA、Hero、CTA 副标题）。
3. **导入**：在后台「i18n」视图用「Files」模式上传整个 JSON 文件；服务器会**自动合并**而非覆盖，以保留已有的人工校对。

### 2.4 新增一个翻译键

如果前端开发新增了 `data-i18n="..."`：

1. 后台首页会显示 `? Missing keys used in HTML`，列出所有未翻译键。
2. 点击「Add to all languages」→ 自动在 14 个 JSON 中**插入空值**。
3. 翻译人员填入实际文案（默认会回退到英文）。

### 2.5 备份与回滚

每次 `PUT /api/i18n/<lang>/<key>` 之前，服务器会自动把当前 `<lang>.json` 复制到 `api/data/.bak/<lang>.<timestamp>.bak`。
- 列表：`GET /api/i18n/backups/<lang>`
- 回滚：`POST /api/i18n/restore/<lang>`，body `{backup: "en.1234567890.bak"}`
- 保留策略：**每语种保留最近 50 份**（代码为 `pruneBackups(lang, 50)`），超过的按 ISO 时间戳字典序被刪除；如需手动清理，删除 `api/data/.bak/` 下旧文件即可。

### 2.6 审计日志

所有登录、写入、图片操作都记录在 `api/data/audit.log`（append-only JSON Lines）。
- 后台「**Audit**」视图查看最近 200 条。
- 单条记录：`{ts, user, action, target, before?, after?}`。
- 关键事件：`auth.login / auth.fail / i18n.update / images.upload / images.replace / images.delete / i18n.restore`。

### 2.7 会话缓存与性能特性

session 文件 `api/data/sessions.json` 采用**内存层 + 30 秒刷盘**设计：
- 启动时一次加载到内存 Map；所有验证只查内存。
- 滑动过期、session 创建/销毁仅标记脏位；后台 `setTimeout(30s)` 才同步写盘。
- 创建/销毁登录立刻同步刷盘一次（怕崩溃丢失刚刚发证的 token）。
- 进程退出（`beforeExit / SIGINT / SIGTERM`）会同步刷盘。

实际效果：连续 100 次认证读请求期间 `sessions.json` 的 mtime 不变（O(1) 摊销）。

---

## 3. 故障排查

| 现象 | 排查路径 |
|---|---|
| `/admin/` 打开是空白 | 浏览器 console 是否报 401 → 重新登录 |
| 登录提示 "Too many attempts" | 等 15 分钟，或在 `api/data/admin.json` 中清空 `lockUntil` |
| 改完文案前台没生效 | 浏览器硬刷新（Ctrl+Shift+R）；检查 main.js 控制台是否报 `[loaderror]` |
| 图片上传报 "File content does not match extension" | 文件被改过后缀；用真实图片重新保存 |
| `audit/keys` 报 missing | 翻译人员还没补；先用英文占位，前端会 fallback |
| 启动报 `EADDRINUSE` | 8000 端口被占用，`netstat -ano \| findstr 8000` 查 PID 后结束 |
| 启动报 `Cannot find module 'express'` | `cd api ; npm install` 重装 |

---

## 4. 端到端自检（部署/变更前必跑）

```powershell
# 1) 启动 server
cd e:\MatooPower\website\api ; node server.js

# 2) 新窗口跑烟雾测试
cd e:\MatooPower\website ; node scripts\smoke-admin.js
```

预期输出末尾为 `SMOKE OK.`，关键指标：

```
[1] /health                  PASS  PASS
[2] POST /api/auth/login     PASS
[3] GET /api/i18n/<lang>     14 × PASS  (每种 ≥20 键)
[4] GET /api/i18n/audit/keys PASS  used ≥ 56, missing = 0
[5] PUT /api/i18n/<lang>/<k> PASS  PASS  PASS
[6] GET /api/images          PASS  count ≈ 174
[7] GET /api/audit           PASS  entries ≥ 1
```

如果 `missing > 0` → 翻译骨架补齐前**不要**部署；如果 `images count == 0` → 检查 `assets/` 目录是否被打包。

---

## 5. 数据一致性维护脚本

`website/` 根目录有一组幂等的 Node 维护脚本，可单独或组合执行：

> **共享层**：`_lib/i18n-file.js` 集中了 6 个脚本复用的样板（路径解析、读写 JSON、迭代 14 种语言、嵌套键删除）。重构后所有脚本从平均 50 行降到 20~70 行且去重。

> ⚠️ **脚本依赖顺序**：`prune-orphan-keys.js` 会删除 i18n 中 HTML 不使用的键，
> 但 `insights.section2_title / section2_sub / subscribe` 现在被 HTML 重新绑定，
> 所以脚本中有一个保护白名单 `PROTECTED_KEYS`。修改后请确认：
> 1. 如果某些被保护的键以后真的不再使用，先从白名单移除，再跑 `prune-orphan-keys.js`；
> 2. 不要单独跑 `prune-orphan-keys.js` 期望全库清理——白名单里的键会存活。
>
> **推荐顺**：`prune-orphan-keys.js` → `prune-newsletter-sub.js` →
> `reseed-insights-keys.js` → `flatten-module-keys.js` → `strip-bom.js` →
> `prune-smoke-residue.js`（需要时）。

| 脚本 | 用途 | 何时跑 |
|---|---|---|
| `expand-html-i18n.js` | 补齐所有 HTML 的 14 种 hreflang + 语言切换器 | 新增页面后 |
| `generate-i18n-skeleton.js` | 基于 en.json 给新语言生成骨架 | 新增语言时 |
| `inject-i18n-blocks.js` | 把 14 种 i18n JSON 注入到所有 HTML 的 `<script id="i18n-data">` | i18n 改完后 |
| `flatten-module-keys.js` | 把 `modules.mod1.title` 提升为顶层 `mod1.title` | en.json 结构微调后 |
| `prune-orphan-keys.js` | 移除 i18n 中 HTML 不使用的键（尊重 `PROTECTED_KEYS` 白名单） | 翻译键审计后 |
| `prune-newsletter-sub.js` | 移除已废弃的 `insights.newsletter_sub` | 仅一次 |
| `reseed-insights-keys.js` | 重新写入 `insights.section2_*` + `subscribe` | HTML newsletter 块变更后 |
| `strip-bom.js` | 移除 i18n JSON 文件多余的 UTF-8 BOM | 第三方工具编辑后 |
| `prune-smoke-residue.js` | 清理 `__smoke_test__` 残留键 | 跑完 smoke 后 |

> 所有脚本 `node --check xxx.js` 通过；输出 `[ok] / [skip]` 区分幂等。

---

## 6. 上线前必检

```powershell
# 1) 关闭后台
#    Ctrl+C 在跑 server 的窗口

# 2) 确认 admin/ 与 api/ 不被打进 deploy zip
#    （已通过 CI 在 deploy-fix-all.ps1 中强制排除）

# 3) 前端 5 项核心检查：
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/admin/  # 应 200（开发期）
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/health
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/i18n/en.json
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/i18n/zh.json
```

部署到公网时务必把 `admin/` 目录从 zip 里排除——它只对内网开发者开放。

---

## 7. 联系与升级

- 需求文档：[Matoo Power 品牌站管理后台需求规格说明书.md](../Matoo%20Power%20品牌站管理后台需求规格说明书.md)
- 后端 API 路由：`api/routes/{auth,i18n,images,audit}.js`
- 管理后台 UI 入口：`admin/index.html` / `admin/app.html`
- 加新语言：① `api/lib/store.js` 的 `SUPPORTED_LANGS` + `RTL_LANGS`；② `scripts/main.js` 的 `LangSwitcher.SUPPORTED`；③ `styles/tokens.css` 加 `html[lang="xx"]` 字体规则；④ `generate-i18n-skeleton.js` 自动生成骨架。