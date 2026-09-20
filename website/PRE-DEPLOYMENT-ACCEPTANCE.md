# Matoo Power — 部署前验收手册

> **目的**：在 `matoopower.com` 上线前，按顺序跑过每一步、勾掉每一条，给“能不能上”一个明确答案。
> **总耗时**：自动验收 ≈ 5 分钟；人工验收 ≈ 60–90 分钟
> **签字**：技术负责人 + 内容/法务负责人 + 业务负责人，三方全签方可上线
> **验收轮次**：v1.1（2026-09-20，调试残留已清理，14 语言全量上线）

---

## 第 0 步：环境就绪（5 分钟）

```powershell
# 启动本地 HTTP 服务器（必须，禁止 file:// 直接打开）
cd e:\MatooPower\website
python -m http.server 8000
# 浏览器访问 http://localhost:8000/
```

> ⚠️ 项目规范：禁止用 `file://` 协议预览——所有 `/assets/...` 绝对路径会解析失败。

---

## 第 1 步：自动验收（5 分钟）

打开 PowerShell 跑三个脚本，全部通过才进入第 2 步。

### 1.1 静态资源全部 HTTP 200

```powershell
powershell -ExecutionPolicy Bypass -File .\verify-resources.ps1
```

**期望输出**：
```
Total URLs to check: 208
Passed: 208
Failed: 0
```

> v1.1 调整：`verify-resources.ps1` 使用 `-Force` 枚举 assets 但过滤隐藏文件/目录，避免 `.archive` 等隐藏目录返回 404。

### 1.2 HTML 内部引用全部 HTTP 200

```powershell
powershell -ExecutionPolicy Bypass -File .\verify-html-refs.ps1
```

**期望输出**：
```
Total unique referenced URLs in HTML: 157
Referenced URLs passed: 157
Referenced URLs failed: 0
```

### 1.3 srcset 反引号污染检查

```powershell
powershell -ExecutionPolicy Bypass -File .\verify-srcset.ps1
```

**期望输出**：
```
about.html : backtick=0 srcset=1
configurator.html : backtick=0 srcset=0
contact.html : backtick=0 srcset=0
cookies.html : backtick=0 srcset=0
index.html : backtick=0 srcset=5
insights.html : backtick=0 srcset=10
manufacturing.html : backtick=0 srcset=4
partnership.html : backtick=0 srcset=9
privacy.html : backtick=0 srcset=0
products.html : backtick=0 srcset=30
technology.html : backtick=0 srcset=0
terms.html : backtick=0 srcset=0
Total backticks: 0
```

> ⚠️ 关键陷阱：PowerShell 单引号字符串里的反引号 `` ` `` 不会转义，会原样写入 HTML 造成 srcset 失效。v1.1 后所有页面 backtick=0，包括 products.html。

### 1.4 自动验收判定

- [ ] **1.1 通过**（208/208）
- [ ] **1.2 通过**（157/157）
- [ ] **1.3 通过**（全站 backtick=0，products.html srcset=30）

如未全部通过 → **停止验收**，回到 `generate-*.ps1` 修复。

---

## 第 2 步：视觉验收（20 分钟）

在 `http://localhost:8000/` 浏览器逐页检查。

### 2.1 全站页面外观（12 页）

| 页面 | URL | 验收点 |
|------|-----|--------|
| 首页 | `/index.html` | Hero 图清晰、4 个场景卡片显示正确、CTA 按钮可点 |
| 产品 | `/products.html` | 6 张产品图（Power01/02、Power Box 1/2/4、Motor Controller）渲染正常、渐变填充 + LCD + LED 显示 |
| 合作 | `/partnership.html` | 4 个区域卡 + 4 个场景卡显示 |
| 制造 | `/manufacturing.html` | 3 张工厂图、3 张 hero 多尺寸正确切换 |
| 洞察 | `/insights.html` | 6 张洞察封面、列表排版整齐 |
| 关于 | `/about.html` | Hero 多尺寸切换 |
| 技术 | `/technology.html` | 内容完整无错位 |
| 联系 | `/contact.html` | 表单字段完整、提交按钮位置正确 |
| 配置器 | `/configurator.html` | 4 步选择器交互正常 |
| 隐私 / Cookie / 条款 | `/privacy.html` 等 | 排版整洁，无乱码 |

**验收点**：
- [ ] 所有图加载完整，无 alt 错配
- [ ] 文字不溢出 / 不截断
- [ ] 按钮 hover / focus 状态正常
- [ ] 没有视觉错位、留白崩塌

### 2.2 srcset 实际切换

> 浏览器 DevTools → Network → Img → 过滤条件 `Srcset`：
> 不同视口下大图应自动选 `@800` / `@1200` / `@1920`。

- [ ] 桌面 1440px：products.html 的 `product-power01-front` 加载 `@800.jpg`
- [ ] 移动 375px：同上加载 `@480.jpg`
- [ ] Hero 图（index.html）：桌面加载 `@1920.jpg`，移动加载 `@1200.jpg`

### 2.3 LCP preload 命中

> DevTools → Network → 过滤 `preload`：
> 第一个请求应是 hero 图，且 `from=preload` 标记。

- [ ] `index.html` 首屏 hero 命中 preload
- [ ] `about.html` / `partnership.html` / `insights.html` / `manufacturing.html` 同上

---

## 第 2.4 步：多语言验收（10 分钟）

> v1.1 起，项目支持 14 种语言，需逐语种验证。

### 2.4.1 i18n 完整性

- [ ] `/i18n/{lang}.json` 14 个文件全部可访问（208 资源验收已覆盖）
- [ ] 12 个 HTML 页面的 `<script id="i18n-data">` 块均嵌入 14 语种完整词条（en, zh, bn, ja, ko, vi, hi, ur, ta, te, ar, fr, pt, es）

**检查命令**（PowerShell）：

```powershell
# 验证每个 HTML 都嵌入了 14 个语种
foreach ($f in (Get-ChildItem *.html)) {
  $content = Get-Content $f.FullName -Raw
  $start = $content.IndexOf('<script id="i18n-data"')
  $end = $content.IndexOf('</script>', $start)
  $block = $content.Substring($start, $end - $start + 9)
  $langs = (([regex]::Matches($block, '"([a-z]{2})":\s*{')) | ForEach-Object { $_.Groups[1].Value }) -join ','
  Write-Host ("{0,-25} embedded: {1}" -f $f.Name, $langs)
}
```

### 2.4.2 语种交互验收（人工）

逐语种点语言切换器、刷新、点导航：

| 语种 | 代码 | 验证重点 |
|------|------|----------|
| English | `en` | 默认语种，主题文字、CTA、导航全部正常 |
| 中文 | `zh` | 联系渠道应切换为微信入口；数据指标 / 法律页面为简中 |
| বাংলা | `bn` | 孟加拉语字体回退正常，无方框乱码 |
| 日本語 | `ja` | CJK 字体渲染一致 |
| 한국어 | `ko` | CJK 字体渲染一致 |
| Tiếng Việt | `vi` | 拉丁带变音符号正常 |
| हिन्दी | `hi` | 天城文字体渲染正常 |
| اردو | `ur` | **RTL 布局**生效（`<html dir="rtl">`），导航 / 卡片 / 表格反向 |
| தமிழ் | `ta` | 泰米尔文渲染正常 |
| తెలుగు | `te` | 泰卢固文渲染正常 |
| العربية | `ar` | **RTL 布局**生效 |
| Français | `fr` | 拉丁字体正常 |
| Português | `pt` | 拉丁字体正常 |
| Español | `es` | 拉丁字体正常 |

### 2.4.3 RTL 专项验收（人工，必做）

仅 `ur` 和 `ar`：

- [ ] `<html dir>` 切到 `rtl`，`<html lang>` 切到 `ur`/`ar`
- [ ] 顶部导航条反向、Logo 移到右侧
- [ ] Hero 文本右对齐、CTA 按钮左右镜像
- [ ] 产品 / 场景 / 洞察卡片网格方向反转
- [ ] 语言菜单、Footer 文本对齐反转
- [ ] 表单输入框右对齐
- [ ] 表格 / 规格表 th、td 右对齐
- [ ] 认证徽章保持 LTR 方向（图标不镜像）

### 2.4.4 字体加载验收（P0）

- [ ] 任意 HTML 查看源码，`<head>` 包含 `fonts.googleapis.com/css2?family=...` 预连接与样式表链接
- [ ] 切换孟加拉语（`bn`）→ Noto Sans Bengali 生效，无方框乱码
- [ ] 切换泰米尔语（`ta`）→ Noto Sans Tamil 生效
- [ ] 切换泰卢固语（`te`）→ Noto Sans Telugu 生效
- [ ] 切换印地语（`hi`）→ Noto Sans Devanagari 生效
- [ ] 切换乌尔都语（`ur`）→ Noto Nastaliq Urdu 生效（RTL）
- [ ] 切换阿拉伯语（`ar`）→ Noto Sans Arabic 生效（RTL）

### 2.4.5 公司主体名错误（华奕/华溢）

- [ ] 全站品牌名应统一为「华奕智能科技」，不可出现「华溢」
- [ ] 中英文混排环境下企业实体名显示完整

### 2.4.6 语言持久化验收

- [ ] 选中语种 → 刷新页面 → 语种保持
- [ ] 跨页面跳转 → 语种保持
- [ ] 清理 `localStorage` → 回退默认 `en`

---

## 第 3 步：SEO 与社交分享验收（15 分钟）

### 3.1 HTML 标签检查

任一 HTML 页面右键 → 查看源代码，head 区域应包含：

```html
<!-- Production SEO Meta -->
<meta name="description" content="...">
<meta name="theme-color" content="#0052CC">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://matoopower.com/...">

<!-- Favicon Suite -->
<link rel="icon" type="image/png" sizes="16x16" href="/assets/favicon-16x16.png">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32x32.png">
<link rel="apple-touch-icon" sizes="180x180" href="/assets/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">

<!-- Open Graph -->
<meta property="og:type" content="website">
<meta property="og:title" content="...">
<meta property="og:image" content="https://matoopower.com/assets/og-...jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://matoopower.com/assets/twitter-card.jpg">

<!-- LCP Preload -->
<link rel="preload" as="image" href="/assets/hero-...jpg"
      imagesrcset="/assets/hero-...@1200.jpg 1200w, /assets/hero-...@1920.jpg 1920w"
      imagesizes="100vw">
```

- [ ] 12 页全部具备以上标签
- [ ] `canonical` 链接是绝对路径（`https://matoopower.com/...`）

### 3.2 离线第三方验证工具（部署到生产域名后再跑）

| 工具 | URL | 用途 |
|------|-----|------|
| Google Search Console | https://search.google.com/search-console | 提交 sitemap |
| Bing Webmaster | https://www.bing.com/webmasters | 提交 sitemap |
| Facebook Sharing Debugger | https://developers.facebook.com/tools/debug/ | 验证 og:image |
| Twitter Card Validator | https://cards-dev.twitter.com/validator | 验证 twitter:card |
| LinkedIn Post Inspector | https://www.linkedin.com/post-inspector/ | 验证 LinkedIn 分享 |
| Rich Results Test | https://search.google.com/test/rich-results | 验证结构化数据 |

- [ ] sitemap.xml 提交成功
- [ ] OG 图在 FB / LinkedIn 显示正常（1200×630，无截断）
- [ ] Twitter Card 显示为 `summary_large_image`

---

## 第 4 步：合规与内容验收（20 分钟）

> 项目规范：客户保密、界面简洁、场景卡不加人群标签。

### 4.1 法务

- [ ] `privacy.html` 经法务审阅（GDPR / CCPA / 中国《个人信息保护法》适配）
- [ ] `cookies.html` 经法务审阅
- [ ] `terms.html` 经法务审阅
- [ ] 决定是否需要 Cookie 同意横幅

### 4.2 内容合规

- [ ] 无真实客户名 / 合同金额 / 联系方式泄露（保密红线）
- [ ] 案例展示只用通用场景图（`scenario-*`），不出现客户品牌
- [ ] 联系信息统一为 `hello@matoopower.com` / 表单，无个人手机号

### 4.3 内容准确性

- [ ] 产品型号、容量数据（1 kWh / 2 kWh 等）正确
- [ ] 工厂参数（产线数、员工数、产能）已用最新数字
- [ ] "20+ 年制造经验" / "30+ 活跃市场" 等关键数据已与业务方核对

### 4.4 业务按钮

- [ ] 联系表单 → 后端 API 接通（目前是 mailto，需替换）
- [ ] "下载产品手册" → 真实 PDF URL
- [ ] "预约演示" / "询价" CTA 链路通畅

---

## 第 5 步：部署配置验收（部署到生产环境后，10 分钟）

### 5.1 域名 & HTTPS

- [ ] `matoopower.com` DNS 解析到生产 IP
- [ ] SSL 证书已部署（Let's Encrypt / DigiCert）
- [ ] HTTP → HTTPS 301 重定向生效
- [ ] `www.matoopower.com` → `matoopower.com` 301 重定向
- [ ] HSTS 头存在（`Strict-Transport-Security: max-age=31536000`）

### 5.2 CDN & 缓存策略

- [ ] CDN 已接入（Cloudflare / CloudFront / Bunny）
- [ ] 缓存头配置：
  - `*.html` → `Cache-Control: public, max-age=0, must-revalidate`
  - `/assets/*` → `Cache-Control: public, max-age=31536000, immutable`
  - `sitemap.xml` / `robots.txt` / `site.webmanifest` → `max-age=3600`
- [ ] 启用 Brotli / gzip（HTML/CSS/JS）
- [ ] HTTP/2 或 HTTP/3 已启用

### 5.3 监控

- [ ] Uptime 监控（UptimeRobot / Better Uptime）
- [ ] 前端错误监控（Sentry / Rollbar）
- [ ] 分析接入（GA4 / Plausible / Umami）
- [ ] Core Web Vitals 上报至分析工具

---

## 第 6 步：浏览器与设备兼容（10 分钟）

| 浏览器 | 视口 | 重点页 | 通过 |
|--------|------|--------|------|
| Chrome 最新 | 1440 / 768 / 375 | index, products | ☐ |
| Safari 最新 | 1440 / 375 | index, products | ☐ |
| Firefox 最新 | 1440 | index | ☐ |
| Edge 最新 | 1400 | products | ☐ |
| iOS Safari (iPhone 14) | 390 | products, configurator | ☐ |
| Android Chrome (Pixel) | 412 | index, contact | ☐ |
| iPad Safari | 1024 | products | ☐ |

验收点：
- [ ] 所有页面渲染正常无错位
- [ ] 触控按钮 ≥ 44×44px
- [ ] 横竖屏切换不破版

---

## 第 7 步：性能基线（可选，Lighthouse）

部署到生产域名后跑：

```powershell
# 用 Chrome DevTools Lighthouse，或 CLI：
lighthouse https://matoopower.com/ --output=json --output-path=./lh.json --view
```

**目标值**：

| 指标 | 目标 | 优秀 |
|------|------|------|
| Performance | ≥ 80 | ≥ 95 |
| SEO | = 100 | = 100 |
| Accessibility | ≥ 90 | = 100 |
| Best Practices | ≥ 90 | = 100 |
| LCP | < 2.5s | < 1.8s |
| CLS | < 0.1 | < 0.05 |
| INP | < 200ms | < 100ms |

- [ ] Performance ≥ 80
- [ ] SEO = 100
- [ ] Accessibility ≥ 90
- [ ] 三项 Core Web Vitals 达标

---

## 第 8 步：上线签收

| 角色 | 姓名 | 签字 | 日期 |
|------|------|------|------|
| 技术负责人 | _________ | _________ | _________ |
| 内容/法务负责人 | _________ | _________ | _________ |
| 业务负责人 | _________ | _________ | _________ |

> 三方全部签字方可执行上线。

---

## 第 9 步：上线后 24h 监控

- [ ] Google Search Console → Coverage / Enhancements 无新增 404
- [ ] 真实用户 Core Web Vitals 三项达标率 ≥ 75%
- [ ] uptime ≥ 99.9%
- [ ] 关键页面（index / products / contact）真实访问无 5xx
- [ ] 至少 1 条真实分享链接在 FB / LinkedIn 显示 OG 图正确

---

## 附录 A：一键验收命令汇总

```powershell
# 0. 启动本地预览
cd e:\MatooPower\website
python -m http.server 8000

# 1. 自动验收（三脚本）
powershell -ExecutionPolicy Bypass -File .\verify-resources.ps1
powershell -ExecutionPolicy Bypass -File .\verify-html-refs.ps1
powershell -ExecutionPolicy Bypass -File .\verify-srcset.ps1

# 2. 验证规范 OK 后，再人工跑 2-9 步

# 3. v1.1 新增：逐页验证 i18n 嵌入完整性
foreach ($f in (Get-ChildItem *.html)) {
  $content = Get-Content $f.FullName -Raw
  $start = $content.IndexOf('<script id="i18n-data"')
  $end = $content.IndexOf('</script>', $start)
  $block = $content.Substring($start, $end - $start + 9)
  $langs = (([regex]::Matches($block, '"([a-z]{2})":\s*{')) | ForEach-Object { $_.Groups[1].Value }) -join ','
  Write-Host ("{0,-25} embedded: {1}" -f $f.Name, $langs)
}
```

## 附录 B：回滚预案

- DNS TTL 已调至 300s（5 分钟）
- CDN 已保留最近 3 个版本快照
- 回滚命令：`git revert HEAD && 触发 CDN 刷新`
- 回滚触发条件：上线 1h 内 P95 错误率 > 1%、LCP > 4s、社交卡片全平台异常

---

## 附录 C：相关文档

- [PRODUCTION-CHECKLIST.md](./PRODUCTION-CHECKLIST.md) — 完整资源清单与自动化脚本说明
- [IMAGE-PRODUCTION-GUIDE.md](./IMAGE-PRODUCTION-GUIDE.md) — 图片生成规范与替换指南
- [README.md](./README.md) — 启动与项目结构说明