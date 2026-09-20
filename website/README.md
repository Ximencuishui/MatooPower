# Matoo Power · To B 品牌站

> B2B 品牌官网 · 全球市场（除中国外）· 三语切换 · 弱网友好

---

## 📁 项目结构

```
website/
├── index.html              # 首页 P0 ✓
├── pages/                  # 后续页面（建设中）
├── assets/
│   ├── logo.svg            # 主 Logo（科技蓝） ✓
│   ├── logo-white.svg      # 反白 Logo ✓
│   └── favicon.svg         # 浏览器图标 ✓
├── styles/
│   ├── tokens.css          # 设计 Token（颜色/字体/间距） ✓
│   └── main.css            # 主样式 ✓
├── scripts/
│   └── main.js             # 交互（导航/i18n/表单） ✓
└── i18n/
    ├── en.json             # 英文 ✓
    ├── zh.json             # 中文 ✓
    └── bn.json             # বাংলা（孟加拉语）✓
```

---

## 🚀 快速开始

### 本地预览（推荐）

```bash
# 进入项目目录
cd website

# 启动本地服务器（任选其一）
python -m http.server 8080
# 或
npx serve .
# 或
php -S localhost:8080
```

浏览器访问 `http://localhost:8080`

### 直接打开

双击 `index.html` 即可在浏览器查看（部分功能如 fetch JSON 需要服务器）。

---

## 🎨 设计规范

### 品牌主色（科技蓝）

```
--color-matoo-600: #0052CC   /* 主色 */
--color-matoo-700: #003D99   /* Hover */
--color-matoo-50:  #E6F0FF   /* 背景区块 */
--color-navy-900:  #091E42   /* 信任深色 / 标题 */
```

### 字体策略（弱网友好）

- **英文**：Inter → 系统字体兜底
- **中文**：思源黑体 → 苹方等本地字体
- **孟加拉语**：Noto Sans Bengali

所有自定义字体按需加载，缺省回退到系统字体，确保南亚弱网环境下也能快速渲染。

---

## 🌐 多语言

支持三种语言，通过右上角语言切换器切换：

| 语言 | 代码 | 默认 |
|------|------|------|
| English | `en` | ✓ |
| 中文 | `zh` |  |
| বাংলা | `bn` |  |

切换逻辑：
- 选择持久化到 `localStorage`
- `<html lang>` 同步更新
- 所有带 `data-i18n` 属性的元素自动替换
- 即时通讯入口按语言切换（中文站显示微信，其他站显示 WhatsApp）

### 添加翻译

编辑 `i18n/{lang}.json`，键路径用 `.` 分隔（如 `hero.title`）。在 HTML 中通过 `data-i18n="hero.title"` 绑定。

---

## 📝 表单

### 五大转化组件

1. **预约验厂** - 落地于 `/contact.html#factory-visit`
2. **规格书下载拦截** - 产品页"下载规格书"按钮
3. **ROI 计算器** - 经销商页面
4. **生态认证申请** - 电控方案页
5. **BP 获取** - 投资者关系页面

### 集成方式

```html
<form data-form="inquiry" action="/api/inquiries" method="POST">
  <input name="company_name" required>
  <input name="email" type="email" required>
  <button type="submit">提交</button>
</form>
```

JS 自动接管提交，POST 到 `/api/inquiries`，携带语言、来源页、UTM 参数。

---

## ⚡ 性能优化（已实施）

- ✅ 关键 CSS 内联到 tokens.css（< 5KB）
- ✅ 无 JS 依赖（vanilla JS，仅 ~10KB）
- ✅ Logo SVG 矢量（< 1KB）
- ✅ 图片懒加载（loading="lazy"）
- ✅ 字体回退到系统字体
- ✅ 减弱动效支持（prefers-reduced-motion）
- ✅ 无障碍标签（aria-*、skip link）

---

## 📦 部署

### 静态托管（推荐）

适合纯 HTML/CSS/JS 项目：

- **Vercel**：直接拖拽 `website/` 目录
- **Netlify**：同上
- **Cloudflare Pages**：同上
- **AWS S3 + CloudFront**：新加坡节点

### CDN 配置

按目标市场分布：

| 地区 | CDN 节点 |
|------|---------|
| 南亚 | Cloudflare Mumbai / Singapore |
| 东南亚 | Cloudflare Singapore |
| 非洲 | Cloudflare Frankfurt |
| 中东 | Cloudflare Dubai |
| 全球兜底 | Cloudflare Anycast |

---

## 🔧 待办（开发路线图）

### Phase 1：MVP（已完成基础）

- [x] Logo 矢量
- [x] 设计 Token
- [x] 首页
- [x] 三语 i18n 基础
- [x] 主样式 + 响应式
- [x] 主交互 JS

### Phase 2：P0 页面（进行中）

- [ ] `/about.html` 关于我们
- [ ] `/products.html` 产品与解决方案
- [ ] `/technology.html` 技术与研发
- [ ] `/contact.html` 联系我们（含 4 类分流表单）
- [ ] `/configurator.html` 场景化模块搭配器

### Phase 3：P1 页面

- [ ] `/manufacturing.html` 制造与 PACK 产线
- [ ] `/partnership.html` 合作与招商
- [ ] `/insights.html` 新闻与洞察
- [ ] ROI 计算器组件
- [ ] 预约验厂落地页

### Phase 4：P2 与后端

- [ ] 后端 API（询盘接收、CRM 路由）
- [ ] CMS 接入（Strapi / Sanity）
- [ ] Google Analytics / Matomo
- [ ] SEO 优化（Sitemap、robots.txt、OG 图片）
- [ ] 隐私政策 / Cookie 声明页

---

## 📞 联系人

| 角色 | 联系方式 |
|------|---------|
| 产品/技术问题 | sales@matoopower.com |
| WhatsApp | +65 XXXX XXXX（占位） |
| 微信企业号 | （待提供） |

---

## 📄 许可

© 2026 深圳华溢智能科技有限公司 · 新加坡华溢科技有限公司

All rights reserved.