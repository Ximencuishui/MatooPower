# Matoo Power H5-App 原型 (Prototype)

> 阶段 1 MVP 主链路可点击原型，覆盖：扫码 → 真伪验证 → 说明书/视频 → 登录 → 保修激活 → 电子保修卡 → 我的设备 → 设备详情。
> 后续阶段（P1 商城/工单/智能模块、P2 数据分析/远程升级）在本原型基础上扩展。

## 运行

```bash
cd prototype
npm install     # 或 pnpm install
npm run dev     # 浏览器打开 http://localhost:3000
```

打开后会直接重定向到 `/scan/MATO-MAT12200-DEMO0001`（未激活演示码）。

## 推荐演示路径

1. **首页** `/home` — 浏览服务入口、语言切换（中/英）
2. **扫码入口** `/scan` — 三个模拟扫码按钮：
   - 未激活演示码 → 走完整激活
   - 已激活演示码 → 显示已激活 + 电子保修卡
   - 伪造码 → 风险提示
3. **落地页** `/scan/MATO-MAT12200-DEMO0001`
   - 看验真状态、产品参数、说明书/视频、3 个主要动作
4. **登录** `/auth?next=/activate/MATO-MAT12200-DEMO0001` — 演示 3 种登录方式 UI
5. **保修激活** `/activate/MATO-MAT12200-DEMO0001`
   - 三步表单：采购信息 → 发票信息 → 确认规则并提交
6. **电子保修卡** `/warranty/MATO-MAT12200-DEMO0001` — 视觉保修卡 + 部件明细
7. **我的设备** `/devices` — 演示设备列表
8. **设备详情** `/device/MATO-MAT12200-DEMO0001` — 健康看板 + 告警 + 升级占位
9. **配件商城** `/shop` — 静态占位
10. **我的** `/profile` — 设置/语言/客服占位

## 已锁定的关键决策（来自 9 个待确认问题）

| # | 问题 | 决策 |
|---|------|------|
| 1 | 保修起算 | A：有发票按发票日；C 兜底：无发票按出厂日 + 60 天宽限；激活日仅记录 |
| 2 | 不同部件保修期 | 按 SKU 配置：整机/电芯/BMS/配件分别设置（演示 SKU：36/60/36/12 月） |
| 3 | 智能模块 | 平台能力先行；演示 SKU 标记有/无；联调放到阶段 2 |
| 4 | 模块商城 | 公开价 + 经销商价双轨；阶段 1 占位、阶段 2 上线 |
| 5 | 经销商体系 | 阶段 1 仅认证申请 + 专属价格；出货记录作为保修依据放阶段 3 |
| 6 | 支付/物流 | 阶段 2 接 Stripe/PayPal；bKash 适配器留位 |
| 7 | 数据合规/存储 | 新加坡主库；发票/设备数据字段级加密（实施阶段细化） |
| 8 | 品牌命名 | 沿用 Matoo Power，独立图标 + PWA 名称 |
| 9 | 二维码防伪 | HMAC-SHA256 签名 + 首次扫码激活 + 重复扫码告警；伪造码提示风险 |

## 技术栈

- Next.js 16 (App Router) + React 19 + TypeScript
- See package.json for exact versions (
ext 16.3.5, eact 19.2.0).
- Tailwind CSS（自定义 Matoo 绿能品牌色）
- Context i18n（zh-CN / en，预留 bn/hi/ur）
- PWA：manifest.webmanifest + icon.svg + 元信息（可"添加到主屏幕"）

## 目录结构

```
prototype/
├── public/                  # manifest、icon、占位 sw
├── src/
│   ├── app/                 # App Router 页面
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── home/page.tsx
│   │   ├── scan/page.tsx
│   │   ├── scan/[id]/page.tsx
│   │   ├── auth/page.tsx
│   │   ├── activate/[id]/page.tsx
│   │   ├── warranty/[id]/page.tsx
│   │   ├── devices/page.tsx
│   │   ├── device/[id]/page.tsx
│   │   ├── shop/page.tsx
│   │   └── profile/page.tsx
│   ├── components/          # PhoneShell / TopBar / TabBar / LangSwitch / ProductArt
│   ├── data/mock.ts         # 演示 SKU + 演示设备 + 演示配件
│   ├── lib/i18n.tsx         # 语言上下文
│   └── locales/{zh-CN,en}.ts # 词典
└── README.md
```

## 接下来的路

- **确认本原型** → 启动阶段 1 后端（NestJS + Postgres + 真实 OTP/二维码签名）→ 替换原型中的 mock
- **不确认 → 调整样式/文案/流程** → 在本仓库继续迭代