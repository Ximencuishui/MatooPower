# Matoo Power · 管理后台

> **本地内容编辑工具** —— 在浏览器里直接修改网站文案与图片，无需部署即可见。

详细需求与决策见根目录：`../Matoo Power 品牌站管理后台需求规格说明书.md`

---

## 一键启动

在 `website/` 目录下执行：

```powershell
.\start-admin.ps1
```

首次启动会自动：

1. 检查 Node.js ≥ 18
2. 安装后端依赖（`express` / `cookie-parser` / `multer`）
3. 生成随机管理员密码并打印到终端
4. 启动服务（默认端口 8000，绑定 `127.0.0.1`）

启动成功后访问：
- 前台：<http://localhost:8000/>
- 后台：<http://localhost:8000/admin/>

> **首次登录密码**会显示在终端，丢失请删除 `api/data/admin.json` 后重启（会生成新密码）。

---

## 目录

```
website/
├── admin/                       ← 后台前端（HTML + CSS + JS，静态）
│   ├── index.html               登录页
│   ├── app.html                 主工作台
│   ├── assets/
│   │   ├── admin.css
│   │   ├── admin.js             主逻辑
│   │   └── login.js
│   └── README.md                ← 你正在看
│
├── api/                         ← 后端（Node.js + Express）
│   ├── server.js                入口（前台 + 后台 + API 同进程）
│   ├── lib/                     工具模块
│   ├── routes/                  鉴权 / i18n / 图片 / 日志
│   ├── data/                    运行时数据（被 .gitignore）
│   │   ├── admin.json           密码哈希 + salt
│   │   ├── sessions.json        当前会话
│   │   ├── audit.log            操作日志（追加写）
│   │   └── .bak/                i18n 自动备份
│   ├── package.json
│   └── .env.example
│
└── start-admin.ps1              ← 一键启动脚本
```

---

## 功能速览

| 模块 | 能力 |
|------|------|
| **Translations** | 三语（EN/ZH/BN）翻译编辑；键搜索；自动备份；多语言对照 |
| **Images** | 列表/缩略图/上传/替换/删除；引用页反查；拖拽上传；多尺寸自动生成（依赖 sharp） |
| **Key Audit** | 找出 HTML 引用但 JSON 未定义的翻译键；标红 + 一键跳转编辑 |
| **Activity Log** | 所有变更（含新旧对比），按时间倒序；可按类型筛选 |

---

## 配置

环境变量（可选，复制 `api/.env.example` 为 `api/.env` 后修改）：

| 变量 | 默认 | 说明 |
|------|------|------|
| `PORT` | 8000 | HTTP 端口 |
| `BIND` | 127.0.0.1 | 监听地址 |
| `ADMIN_PASSWORD` | 首次启动随机生成 | 管理员密码（设置后覆盖随机值） |
| `SESSION_SECRET` | 自动生成并落盘 | 会话签名密钥 |
| `MAX_UPLOAD_MB` | 10 | 上传文件大小上限 |
| `SHARP_ENABLED` | true | 启用 sharp 自动生成 480/800/1200 变体 |

---

## 安全

- 密码使用 Node.js 内置 scrypt 哈希（`api/data/admin.json` 中存储 salt+hash）
- 会话为 HttpOnly + SameSite=Strict Cookie
- 写操作要求 `X-CSRF-Token` 头
- 5 次失败登录锁定 15 分钟
- 路径穿越防御：拒绝 `..`、`\\`、绝对路径
- 上传校验：MIME 魔数双重验证（拒绝通过改后缀名绕过）
- **默认仅监听 127.0.0.1**，不暴露公网

生产部署建议：

- 后台**不**部署到生产环境（生产仍用 Vercel/Netlify/CF Pages 静态托管）
- 本地修改后 `git push`，生产环境自动更新

---

## 操作流程

### 改文案

1. 登录后台 → `Translations`
2. 切换语言（EN/ZH/BN）
3. 左侧键列表点选；右侧编辑
4. **自动保存**：编辑后失焦即保存；或按 `Ctrl+S`
5. 浏览器新窗口打开前台页面刷新查看

### 换图片

1. 登录后台 → `Images`
2. 拖拽图片到上传区（或点 `Upload`）
3. 文件名按现有命名规则（`hero-home.jpg`、`hero-home@1200.jpg` 等）
4. 系统自动备份原图到 `assets/.archive/`，并尝试生成多尺寸变体
5. 替换前台 HTML 引用（若仅替换同名文件，引用自动生效）

> 自动多尺寸变体依赖 `sharp`。如未安装，会降级为"仅原图"，此时需手动跑 `scripts/generate-srcset.ps1`。

### 找翻译漏洞

1. 登录后台 → `Key Audit`
2. 列出 HTML 引用但 JSON 缺失的键
3. 点击键名跳转到对应编辑面板

### 误改恢复

- 最近 50 个 i18n 备份位于 `api/data/.bak/<lang>.<timestamp>.json`
- 操作日志 `api/data/audit.log` 记录 `before` / `after`，可手动回写

---

## 与现有 `start-preview.ps1` 的关系

| 场景 | 用哪个脚本 |
|------|-----------|
| 仅看网站、不需要后台 | `start-preview.ps1`（Python 静态托管，更轻） |
| 看网站 + 编辑内容（推荐） | `start-admin.ps1`（Node.js 单进程） |
| 生产部署 | 用 Vercel/Netlify/CF Pages 静态托管，无需脚本 |

两者端口都是 8000，不要同时运行。

---

## 常见问题

**Q：忘记密码怎么办？**
A：删除 `api/data/admin.json` 后重启（会生成新密码并打印）。或在 `api/.env` 中设置 `ADMIN_PASSWORD=...` 重启。

**Q：上传图片失败？**
A：检查文件类型（仅 `.jpg/.png/.webp/.svg`）、大小（≤ `MAX_UPLOAD_MB`）、文件内容是否真为图片（非魔数校验）。控制台日志会说明具体原因。

**Q：后台能否部署到生产？**
A：不建议。后台仅供本地维护；生产请用静态托管 + `git push`。

**Q：i18n 编辑后前台没变？**
A：浏览器缓存。Ctrl+F5 强刷。或后台 → "View site ↗" 新窗口查看。

**Q：怎样看到后台的错误？**
A：终端窗口会打印 `[error] METHOD URL · message`。

---

## 依赖说明

| 依赖 | 必需？ | 用途 |
|------|--------|------|
| `express` | 必需 | HTTP 框架 |
| `cookie-parser` | 必需 | 解析会话 cookie |
| `multer` | 必需 | 处理 multipart 上传 |
| `sharp` | 可选 | 多尺寸图片变体生成；缺失时降级 |