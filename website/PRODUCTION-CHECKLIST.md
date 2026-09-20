# Matoo Power - 生产部署检查清单

> **状态**：✅ 已完成原型 → 生产转换（2026-09-20）
> **版本**：v1.1 production-ready（清理调试残留 + 多语言扩容）
> **目标域**：https://matoopower.com

---

## 一、资源清单

| 类别 | 数量 | 说明 |
|------|------|------|
| HTML 页面 | 12 | index, products, partnership, manufacturing, insights, about, technology, contact, configurator, privacy, cookies, terms |
| 静态资源（assets/） | 174 | 含基础图、srcset 多尺寸、favicon 套件、OG 图（已清理 36 张 verify-overview 调试截图） |
| i18n | 14 | en, zh, bn, ja, ko, vi, hi, ur, ta, te, ar, fr, pt, es（12 页 HTML 均内嵌完整多语包） |
| 顶层 meta | 3 | sitemap.xml, robots.txt, site.webmanifest |
| styles / scripts | 2+2 | main.css, tokens.css, main.js, whatsapp-config.js |
| **总计** | **208** | **全部 HTTP 200 验证通过** |

---

## 二、视觉质量升级 ✅

- [x] **产品渲染升级**（6 张）：Power01、Power02、Power Box 单/双/四模块、Motor Controller
  - 加入渐变填充、圆角、LCD 显示屏、LED 指示灯、闪电标识
- [x] **场景图升级**（2 张）：home-evening、telecom
- [x] 全部输出为渐进式 JPEG（quality 88），体积可控

---

## 三、性能优化 ✅

- [x] **多尺寸 srcset 变体**：102 张（480/800/1200/1920）
- [x] **响应式图片**：59 处 `<img>` 已注入 `srcset`
  - products.html: 30 imgs
  - insights.html: 10 imgs
  - partnership.html: 9 imgs
  - index.html: 5 imgs
  - manufacturing.html: 4 imgs
  - about.html: 1 img
- [x] **LCP preload**：5 个核心页面（index、about、partnership、insights、manufacturing）
  - 含 `imagesrcset` 让浏览器在首屏前预取最优尺寸
- [x] **重复 og:image 清理**：避免社交爬虫被多张图困惑

### 尺寸档映射

| 类别 | 尺寸档 | 适用 |
|------|--------|------|
| `product-*` | 480w, 800w | 产品图（缩略图/卡片） |
| `scenario-*` | 800w, 1200w | 场景图（卡片/全幅） |
| `hero-*` | 1200w, 1920w | 首屏 hero |
| `region-*` / `factory-*` / `insight-cover-*` | 800w, 1200w | 区域/工厂/洞察封面 |

---

## 四、SEO & 社交分享 ✅

### 4.1 每页元数据

12 个 HTML 全部具备：
- `<meta name="description">`
- `<meta name="theme-color" content="#0052CC">`
- `<meta name="robots" content="index, follow">`
- `<link rel="canonical">`
- 完整 Open Graph（type / url / title / description / image / image:width / image:height / locale / site_name）
- Twitter Card（summary_large_image）
- 针对每页定制的标题与描述

### 4.2 OG / Twitter 图（1200×630）

- `og-default.jpg`：通用
- `og-products.jpg`：产品页
- `og-partnership.jpg`：合作页
- `og-insights.jpg`：洞察页
- `og-manufacturing.jpg`：制造页
- `twitter-card.jpg`：Twitter 专用

### 4.3 Favicon 套件

| 文件 | 用途 |
|------|------|
| `favicon.svg` | 现代浏览器矢量 |
| `favicon-16x16.png` | 旧浏览器 |
| `favicon-32x32.png` | 标签页 |
| `favicon-48x48.png` | Windows 站点图标 |
| `apple-touch-icon.png` (180×180) | iOS 主屏幕 |
| `mstile-150x150.png` | Windows 磁贴 |
| `android-chrome-192x192.png` | Android PWA |
| `android-chrome-512x512.png` | Android PWA 启动 |

### 4.4 PWA 清单

- [x] `site.webmanifest`：name、short_name、theme_color、background_color、icons (192/512)、display: standalone、start_url

### 4.5 站点地图 & 指令

- [x] `sitemap.xml`：12 个页面，最后修改日期固定为发布日
- [x] `robots.txt`：允许全站抓取，指向 sitemap

---

## 五、资源验证 ✅

```
Total URLs to check: 208
Passed: 208
Failed: 0

Total unique referenced URLs in HTML: 157
Referenced URLs passed: 157
Referenced URLs failed: 0
```

- 所有 208 个静态资源 HTTP 200（隐藏目录 `.archive` 已从验证脚本中排除）
- 所有 157 个 HTML 内引用 URL HTTP 200
- 验证脚本：`verify-resources.ps1`、`verify-html-refs.ps1`
- 详细结果：`verify-results.txt`、`html-references.txt`

### 5.1 本轮清理动作（v1.1）

- [x] 删除 36 张未引用的 `assets/verify-overview-*.png` 调试截图
- [x] 删除隐藏目录 `assets/.archive/`（1 个同名历史文件）
- [x] `verify-resources.ps1` 增强：使用 `-Force` 枚举但过滤隐藏项，避免隐藏目录报 404

---

## 六、部署前最后检查（人工）

> 这些项无法由脚本验证，需在部署前人工确认：

### 6.1 域名 & HTTPS

- [ ] `matoopower.com` 已解析到目标服务器
- [ ] SSL 证书已部署（HSTS 推荐启用）
- [ ] HTTP → HTTPS 重定向生效（301）
- [ ] `www` → apex 重定向决策（建议 301 → apex）

### 6.2 CDN & 缓存

- [ ] 静态资源走 CDN（Cloudflare / Bunny / CloudFront）
- [ ] 缓存策略：
  - `*.html` → `Cache-Control: public, max-age=0, must-revalidate` 或短时间（≤ 5min）
  - `/assets/*.jpg`, `/assets/*.svg` → `Cache-Control: public, max-age=31536000, immutable`
  - `/assets/*@480.jpg` 等多尺寸 → 同上 immutable
  - `site.webmanifest`, `sitemap.xml`, `robots.txt` → `max-age=3600`
- [ ] 启用 Brotli / gzip 压缩（HTML/CSS/JS）

### 6.3 第三方验证

- [ ] [Google Search Console](https://search.google.com/search-console) 提交 sitemap
- [ ] [Bing Webmaster Tools](https://www.bing.com/webmasters) 提交 sitemap
- [ ] [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) 验证 og:image
- [ ] [Twitter Card Validator](https://cards-dev.twitter.com/validator) 验证 twitter:card
- [ ] [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/) 验证 LinkedIn 分享
- [ ] [Lighthouse](https://developers.google.com/web/tools/lighthouse) 跑性能/SEO/可访问性

### 6.4 浏览器兼容

- [ ] Chrome / Edge / Safari / Firefox 最新版测试
- [ ] iOS Safari（iPhone）测试 PWA 添加到主屏幕
- [ ] Android Chrome 测试 PWA 安装
- [ ] 平板/桌面响应式断点测试（≥ 360px, 768px, 1024px, 1440px）

### 6.5 分析 & 监控

- [ ] 接入 Google Analytics 4 / Plausible / Umami
- [ ] 接入 Sentry 或类似前端错误监控
- [ ] 接入 uptime 监控（UptimeRobot / Better Uptime）
- [ ] 配置 Core Web Vitals 监控（web-vitals.js + GA4）

### 6.6 法务 & 内容

- [ ] 法律团队审阅 `privacy.html` / `cookies.html` / `terms.html`
- [ ] Cookie 同意横幅（如适用 GDPR / CCPA）
- [ ] 联系表单后端接通（当前是 mailto，需要替换）
- [ ] 「下载产品手册」按钮接通真实 PDF

---

## 七、上线后 24h 监控

- [ ] Google Search Console → Coverage / Enhancements
- [ ] 真实用户 Core Web Vitals（LCP / INP / CLS）
- [ ] 404 / 5xx 错误率
- [ ] 关键页面爬取成功率
- [ ] 社交分享卡片在主流平台显示正确

---

## 八、回滚预案

- 保留最近 3 个版本的静态资源快照
- DNS TTL 调至 300s（5 分钟）以便快速切换
- CDN 缓存清除命令提前准备好

---

## 九、附：PowerShell 脚本清单

| 脚本 | 用途 | 是否可重跑 |
|------|------|------|
| `generate-pro-renders.ps1` | 产品精修图 | ✅ idempotent |
| `generate-srcset.ps1` | 多尺寸变体 | ✅ idempotent |
| `generate-production-assets.ps1` | favicon + OG + manifest + robots | ✅ idempotent |
| `inject-production-meta.ps1` | SEO meta 注入 | ⚠️ 检测已注入则跳过 |
| `inject-lcp-preload.ps1` | LCP preload + 清理重复 og | ⚠️ 检测已注入则跳过 |
| `inject-srcset.ps1` | srcset 注入 | ⚠️ 检测已注入则跳过 |
| `cleanup-buggy-srcset.ps1` | 一次性 bug 清理 | ✅ 可保留 |
| `verify-resources.ps1` | 全站 HTTP 200 验证 | ✅ |
| `verify-html-refs.ps1` | HTML 引用深度验证 | ✅ |
| `start-preview.ps1` | 本地预览服务器 | ✅ |

> 调试用临时脚本（test-*.ps1, find-backticks.ps1, check-imaging.ps1）建议在上线后清理。