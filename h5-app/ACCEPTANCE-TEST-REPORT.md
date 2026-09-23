# Matoo Power H5-App · 验收测试报告（v1.0）

> **范围**：`E:\MatooPower\h5-app\` 全量验收（apps/web · apps/api · packages/shared）
> **对照基线**：《Matoo Power H5-App 独立产品需求说明书》v1.0 + 现有 AUDIT.md 技术审计
> **本报告聚焦**：① 验收方法论与测试矩阵 ② **UI/UX 交互缺陷**（AUDIT.md 未覆盖层） ③ 功能缺口对照 ④ 优化方案（按 ROI 排序）
> **与 AUDIT.md 的关系**：本文档**不重复** P0/P1 代码层缺口，**专门补足**交互层 / 信息架构 / 可用性 / 一致性 / 可达性（A11y）层缺陷。

---

## 0. 测试方法论

| 维度 | 方法 | 通过准则 |
|------|------|----------|
| **功能完整性** | 用户旅程 × 路由 × 角色矩阵走查 | 角色能完成核心任务且无死链 |
| **UI 一致性** | 22 路由视觉语言审计 | token / 间距 / 色板统一 |
| **UX 交互** | 关键路径 step-by-step | 7 步内可达、错误可恢复、反馈即时 |
| **可达性 (A11y)** | WCAG 2.1 AA 速查 | 键盘可达 / 焦点可见 / 语义化 / 对比度 |
| **多语言/多模态** | 5 语言 × RTL × 暗色 | 切语言不破布局 |
| **错误处理** | 网络/会话/数据异常演练 | 不白屏、有可恢复路径 |
| **性能感知** | 关键路径响应延迟体感 | 主流程 < 2s 反馈 |

**测试执行环境**：源码静态分析 + 类型推断 + 真实路由状态机模拟（基于 db 实际行数）。

---

## 1. 验收矩阵（4 角色 × 22 路由 × 7 状态）

### 1.1 角色 × 路由矩阵

| 路由 | Customer | Dealer | Admin | 未登录 | 路由所有者 | 状态 |
|------|----------|--------|-------|--------|-----------|------|
| `/` | → `/scan/...` | → `/scan/...` | → `/scan/...` | → `/scan/...` | 客户端 redirect | ✅ |
| `/home` | ✅ | ✅ | ✅ | ✅（限 CTA） | 演示 | ⚠️ 见 UX-1 |
| `/scan` | ✅ | ✅ | ✅ | ✅ | 演示 | ⚠️ 见 UX-2 |
| `/scan/[id]` | ✅ | ✅ | ✅ | ✅ | API `/sku/:id` | ⚠️ 见 UX-3 |
| `/scan/failed` | ✅ | ✅ | ✅ | ✅ | URL sanitize | ✅（安全） |
| `/activate/[id]` | ✅ 需登录 | ✅ | ✅ | 跳登录 | API | ⚠️ 见 UX-4 |
| `/warranty/[id]` | ✅ 需登录 | ✅ | ✅ | EmptyState | API `/warranty/by-sku/:skuId` | ✅（已修复 AUDIT P0-2/P0-3） |
| `/device/[id]` | ✅ | ✅ | ✅ | 跳登录 | API | ✅ |
| `/devices` | ✅ 需登录 | ✅ | ✅ | EmptyState | API | ✅ |
| `/devices/compare` | ✅ 需登录 | ✅ | ✅ | EmptyState | API（已迁真实数据） | ✅ |
| `/dealer/batch` | 403 占位 | ✅ | ✅ | API 403 | API + mock | ⚠️ 见 UX-5 |
| `/dealer/dashboard` | 403 占位 | ✅ | ✅ | API 403 | API | ✅ |
| `/auth` | ✅ | ✅ | ✅ | ✅ | API | ⚠️ 见 UX-6 |
| `/tickets` | ✅ | ✅ | ✅ | EmptyState | API | ✅ |
| `/tickets/new` | ✅ 需登录 | ✅ | ✅ | 跳登录 | API | ✅ |
| `/tickets/[id]` | ✅（仅自己） | ✅ | ✅ | 跳登录 | API | ✅ |
| `/admin/overview` | ✅ **role 守卫前置拦截** | ✅ | ✅ | 跳登录 | API | ✅（已修复 UX-7） |
| `/admin/tickets` | ✅ **同上** | ✅ | ✅ | 跳登录 | API | ✅（已修复 UX-7） |
| `/admin/analytics` | ✅ **同上** | ✅ | ✅ | 跳登录 | API | ✅（已修复 UX-7） |
| `/admin/warranties` | ✅ **同上** | ✅ | ✅ | → /rebrand URL | 跳登录 | **未实现页** | ✅（已修复 UX-7；F-1 仍待后端） |
| `/admin/users` | ✅ **同上** | ✅ | ✅ | 跳登录 | API | ✅（已修复 UX-7） |
| `/messages` | ✅ | ✅ | ✅ | EmptyState | API + 聚合 | ⚠️ 见 UX-8 |
| `/shop` | ✅ | ✅ | ✅ | ✅ | 纯 mock | ⚠️ 见 UX-9 |
| `/profile` | ✅ | ✅ | ✅ | 显示 CTA | session | ✅ |
| `/legal/privacy` `/legal/terms` `/legal/...` | ✅ | ✅ | ✅ | ✅ | 静态 | ✅ |
| `/warranty-policy` | ✅ | ✅ | ✅ | ✅ | 静态 + i18n | ✅ |

> 🔴 表示**验收不通过**；⚠️ 表示**功能可用但有 UX 缺陷**；✅ 表示验收通过。

### 1.2 7 状态矩阵（每个页面需覆盖）

| 状态 | 是否实现 | 通用组件 | 备注 |
|------|----------|----------|------|
| **loading 初始** | ✅ | `<PageLoading />` / `<SkeletonBlock />` | 部分页直接 `<Spinner>` 无骨架 |
| **loading 局内** | ✅ | `<Spinner size="sm" />` 嵌按钮 | 一致性好 |
| **success 数据** | ✅ | 业务卡片 | — |
| **success 空** | ✅ | `<EmptyState />` | **6 处**统一使用 |
| **error 业务（401/403）** | ✅ | `<ErrorBlock showLoginLink>` | 一致性好 |
| **error 业务（404/500）** | ✅ | `<ErrorBlock onRetry>` | 一致性好 |
| **error 网络** | ⚠️ | `<ErrorBlock>` 但部分页面静默 | 见 UX-10 |

---

## 2. UI/UX 交互缺陷（按严重度分类）

### 2.1 🔴 P0 · 必须先修（影响核心任务可完成性）

#### UX-1 · 首页 `home/page.tsx` 的"demo 入口"卡片生产期必须隐藏

**位置**：`apps/web/src/app/home/page.tsx:158-165`
**问题**：首页底部直接暴露 **dealer 工作台 + 4 个失败 demo 码** 入口。
- 当前 `/scan/FAKE-CODE-0000` 任何人扫码都会进入"防伪失败"页 — 是 demo 演练用；
- 生产环境让普通用户看到 `Dealer 工作台` 是**业务泄漏** + **诱导误操作**；
- 用户看到"防伪失败" 链接会以为自己的产品是假货。

**修**：
- 顶层包 `process.env.NEXT_PUBLIC_DEMO === '1'` 条件渲染；
- 或读取 `matoo.role` session.role === 'admin'/'dealer' 才显示；
- 移到 `/admin/demos` 路由供内部演练。

#### UX-2 · `/scan` 入口页"演示二维码视觉"误当真实扫码入口

**位置**：`apps/web/src/app/scan/page.tsx:13-26`
**问题**：四个角的扫描框 + "9:41"时间显示 + "📷" 图标，**视觉上是真扫码 UI**，但其实里面全部是 demo 链接（无摄像头权限申请、无 `getUserMedia`）。普通用户进入会**尝试对准二维码**毫无反应，2 秒后才发现是"演示"。

**修**：
- 顶部加 demo banner（已加 `demoTip` 文本但视觉权重不够）；
- 改为相机权限询问 + `<video>` 预览 + `jsQR` 真实扫码库（≤ 30KB）；
- 演示模式下至少把"扫描框"换为 `DASHBOARD 演练` 标签，避免歧义。

#### UX-3 · 扫码成功后"未激活 vs 已激活"分支不直观

**位置**：`apps/web/src/app/scan/[id]/page.tsx:104-121`
**问题**：用户扫了一个**陌生二维码**，可能：
- 自己的设备（已激活）→ 出现黄底 banner 提示"已于某时间激活" → 按钮变成"查看保修卡"；
- 别人的设备（已激活）→ 同上；
- 新设备 → 出现绿底 banner → 提示激活。

**当前缺陷**：
1. "该设备已于某时间激活" 这句话**没说是谁激活的**（应显示 owner phone 末四位 或 "被经销商激活"）；
2. 没有任何"如果这不是你的设备" 安全提示文案（防冒领）；
3. 重复扫码（`qr.scanCount > 1`）没有任何"扫描次数异常"提示（防伪需求 §3.1）。

**修**：
```tsx
{isRepeated && (
  <div className="bg-amber-50 p-4">
    <div>{t.scan.repeated} · {activatedBy ?? '经销商'}</div>
    {scanCount > 5 && <div>⚠ 该码已被扫描 {scanCount} 次,请核实真伪</div>}
  </div>
)}
```

#### UX-4 · `/activate/[id]` 流程 7 步表单缺关键校验

**位置**：`apps/web/src/app/activate/[id]/page.tsx:127-211`
**问题**：
1. **invoiceDate 默认值硬编码 `'2025-01-15'`**（写死未来/过去日期），用户不主动改就直接提交 → 演示期 OK，但生产期这是**默认欺诈**漏洞；
2. **Step 3 提交按钮可以跳过"无发票"场景**（`invoiceNo` 可空），但 `invoiceDate` 的条件渲染依赖 `invNo`，**空 invNo 也带 invoiceDate 进请求**；
3. **没有"无发票时按 MFG + 60 天兜底"的明示文案**，导致用户以为是强制要求发票；
4. **发票照片"上传"按钮是伪按钮**（`pickPhoto` 只生成随机 ID），点击后没有任何视觉反馈 → 用户以为已上传实际没传；
5. **没有经销商编号查找**，纯靠手动输入字符串 → 不可信赖；
6. **提交成功后直接跳 `/warranty/[skuId]`**，没有"再激活一台"或"返回首页"的次要操作。

**修**：
- 日期默认改为当天 `new Date().toISOString().slice(0,10)`；
- 发票照片按钮改为真实 `<input type="file" accept="image/*" capture="environment">` + 缩略图预览；
- 加"我有 / 我没有发票" radio 切换（无发票走 MFG+60 兜底路径）；
- 加经销商 dropdown（先调 `GET /dealer/list?country=BD`）；
- 提交后加 `<EmptyState>` 引导"去激活下一台 / 回首页"。

#### UX-5 · 经销商 `/dealer/batch` 批量激活"成功但失败"逻辑错乱

**位置**：`apps/web/src/app/dealer/batch/page.tsx:46-81`
**问题**：
1. 后端 bulk activate 是**原子事务**，任一失败全部回滚，但前端：
   ```tsx
   setItems((arr) => arr.map((it) => it.selected ? { ...it, status: 'fail' } : it));
   ```
   即**所有选中项标红**，即使只有一项失败；
2. 进度条 `progress` 状态在 batch 调用期间从未递增（只在 success 后 setProgress 一次），用户看到的进度条**一直是 0%**；
3. "🛒 经销商角色：经销商" 字面重复；
4. `customerPhone` 默认值 `+88017220003` 是另一个手机号，**没有说明用途**（是收货客户？安装客户？）；
5. "⚠ mockNote" 文案只是硬字数字"演示数据"，**没有解释怎么切换到真实出货清单**。

**修**：
- 后端拆 `POST /dealer/bulk-activate` 为 `POST /dealer/bulk-activate-item` 单条，前端逐项调用，真实进度；
- 进度条实时更新（`done` 计数每次成功 +1）；
- 字段说明加 `?` tooltip："收件人手机号 = 接收保修通知的手机号"；
- 加 SKU 选择器（按 SKU 拉真实出货列表）。

#### UX-6 · `/auth` 三个 tab 中两个是死路

**位置**：`apps/web/src/app/auth/page.tsx:91-94, 162-171`
**问题**：
1. **Email tab**（91-94）：用户填完邮箱密码 → 点提交 → 弹 toast `emailLoginNotImplemented`。**没有任何引导**：不能去注册、不能改用 OTP；
2. **WhatsApp tab**（162-171）：整个 tab 内容是 placeholder，仅一个 `<p>comingSoonHint</p>`，用户填完手机号 → 提交按钮还是走的"OTP"逻辑 → **微信验证码根本不会发**；
3. **主按钮文案混乱**：email tab 按钮文案 `registerBtn`（应该是"登录"），其他 tab 是 `registerBtn`，逻辑不一致；
4. **无"忘记密码"入口**（即使是 email tab）；
5. **未注册手机号首次登录直接建账户**（`auth.service.ts:80-88`），但前端没有任何"首次/扫码"区分，用户不知道自己在被注册；
6. **没有 OTP 错误次数反馈**，输错 3 次还是同一个错误 toast，**用户不知道还剩几次**。

**修**：
- email tab 暂时隐藏或显示"Coming soon — 请使用手机号 OTP 登录"；
- WhatsApp tab 隐藏或合并到 phone tab 后面写"WhatsApp OTP 即将上线"；
- 区分 `login` vs `register` 按钮（首次用户走 register，已存在走 login）；
- OTP 错误次数后端返回 `{ remainingAttempts: 2, lockUntil }` → 前端展示 "还剩 2 次"；
- 增加"忘记密码"链接（即使 demo 期也是 disabled + tooltip）。

#### UX-7 · `/admin/*` 三个页面对非 admin 角色**前端未做 role 检查**

**状态**：✅ **已修复**（P0 修复；详见 AUDIT §F.P0-1）

**位置**：
- `apps/web/src/hooks/useRequireRole.tsx`（统一 hook + RoleGuardView）
- `apps/web/src/app/admin/{overview,tickets,analytics,warranties,users}/page.tsx`
- `apps/web/src/app/dealer/{dashboard,batch,pickup}/page.tsx`（白名单 = `['dealer', 'admin']`）

**问题**：
- API 端 `@Roles('admin')` 会返回 403，但**前端 UI 完全渲染**（TopBar + KPI 卡片 + Tab）后才报错 → 用户看到"后台骨架"再被踢，**信息泄漏 + 体验断裂**；
- AUDIT.md F.P0-1 已指出，但仍未修。

**修**：
- 新建 `hooks/useRequireRole.tsx`：`useRequireRole(['admin'])` 返回 `{ status: 'checking' | 'ok' | 'need-login' | 'forbidden' }`；配套 `RoleGuardView` 渲染三种守卫 UI（403 / need-login / checking 占位）；
- 状态机基于 `localStorage` 中的 `AuthSession.role`：未登录 → 登录 CTA；角色不匹配 → 403（显示当前角色 + 所需角色 + 返回首页/退出按钮）；匹配 → 正常渲染；
- admin 角色**可访问 dealer 路由**（白名单 `['dealer', 'admin']`），与后端 `@Roles('dealer', 'admin')` 对齐；
- 全部 5 个 admin 页 + 3 个 dealer 页已接入；`useAbortedFetch` 在 admin/tickets/users 上叠加 → 切换 Tab/搜索时取消旧请求；
- 12 项单元测试覆盖状态机全部分支 + RoleGuardView 三态可见性：`apps/web/test/useRequireRole.test.tsx`。

```tsx
// hooks/useRequireRole.tsx（核心 API）
export function useRequireRole(allowed: Role[]): RoleGuardState {
  const [state, setState] = useState<RoleGuardState>({ status: 'checking' });
  useEffect(() => {
    const s = getSession();
    if (!s?.token) return setState({ status: 'need-login' });
    if (!allowed.includes(s.role as Role))
      return setState({ status: 'forbidden', session: s, allowed });
    setState({ status: 'ok', session: s });
  }, [allowed.join(',')]);
  return state;
}

// admin/overview/page.tsx
const guard = useRequireRole(['admin']);
if (guard.status !== 'ok') return <RoleGuardView state={guard} title={...} />;
```

#### UX-8 · `/messages` 消息中心实际不是消息中心

**位置**：`apps/web/src/app/messages/page.tsx`
**问题**：
- 标题叫"消息"（tabbar `messages`），用户预期是**系统通知 + 站内信 + 工单回复**的统一收件箱；
- 实际只是"我的工单列表 + admin 系统告警聚合"；
- **非 admin 用户看到的"系统" tab 永远是空的**（系统消息只在 admin 角色下发）；
- **没有未读计数 / 红点**，用户不知道有新回复；
- 工单回复通知 = 进入 `/tickets/[id]`，无 push 提醒；
- **title 文案不一致**：`t.messages.title` 在不同地方分别叫"消息中心"、"消息"。

**修**：
- 重新定义"消息中心"为 `inbox = tickets ∪ systemAlerts ∪ systemBroadcasts ∪ marketingMessages`，每条带 `read` 状态 + 已读/未读 UI；
- 接入 Web Push 或 SSE 实时推送（详见优化方案 §3）；
- TabBar 消息图标上加未读数红点。

#### UX-9 · `/shop` 加购按钮 disabled 但视觉是 active

**位置**：`apps/web/src/app/shop/page.tsx:136-143`
**问题**：
1. 按钮文案 `addToCart`（"加入购物车"）+ 价格 `USD 18`，视觉上是"可购买"；
2. 实际 `<button disabled className="disabled:opacity-50">`，opacity 0.5 仍是绿色填充；
3. 点击 toast `comingSoon`，但用户**预期会被加到购物车** → 加购失败感；
4. 没有"何时上线"预期管理（"Q3 上线？Q4？"）；
5. 收藏（★）按钮无障碍 + 增加完整体验（OK），但与加购按钮视觉权重一样 → 用户分不清主次操作。

**修**：
- disabled 状态同时改文案"即将上线 Q3"+ 改背景为灰；
- 拆"加入愿望单"和"加入购物车"为两个独立按钮，主次分明；
- 加购物车按钮完全隐藏（P2 内不暴露）。

#### UX-10 · 多个页面错误处理静默失败

**位置**：
- `apps/web/src/app/home/page.tsx:25-28`：`devices` 失败设全局 error，但 `tickets` 失败静默
- `apps/web/src/app/admin/tickets/page.tsx:43-53`：search 变化触发新请求，**未取消旧请求** → 用户输入"abc"快速打字可能看到旧结果
- `apps/web/src/app/admin/analytics/page.tsx:30-40`：同上，未加 `AbortController`

**问题**：
1. `listMyTickets().catch(() => ({ items: [] }))` → 工单列表加载失败用户完全感知不到；
2. 搜索/筛选快速切换时，旧 fetch 未 abort，新数据可能比旧数据晚回来 → **列表闪烁/覆盖**；
3. `Promise.all([...])` 任一 reject 全部 reject，部分成功部分失败用户看不到。

**修**：
```tsx
const ac = new AbortController();
function load() {
  ac.abort(); // 取消上一次的
  fetchData({ signal: ac.signal })
    .catch(e => { if (e.name !== 'AbortError') setError(e); });
}
```

---

### 2.2 🟡 P1 · 演示期可用但生产必修

#### UX-11 · 暗色模式支持不完整

**位置**：`apps/web/src/app/globals.css:28-45` + 各组件 className
**问题**：
1. CSS 中定义了 `.dark` 变量，但**没有任何 UI 入口**让用户切换暗色模式；
2. 只通过 `localStorage.matoo.theme` 手动写入才生效；
3. 即便用户改 localStorage，**所有 `bg-white` / `text-slate-500` / `bg-slate-100` 等 className 都没有 `dark:` 前缀**：
   - 实际验证：`TopBar` 的 `bg-matoo-surface` 是 CSS 变量（已暗色适配），但内部的 `text-slate-500` 是 Tailwind 静态色 → **暗色模式下仍是灰字色**，对比度差；
   - `tabbar` 同样：背景通过变量切换，但 `text-matoo-tab-fg` 在暗色是 `#94A3B8`，对比度 4.5:1 勉强通过；
4. 暗色模式策略：跟随系统 vs 手动 → 没有用户选择面板。

**修**：
- 主题切换入口：放在 `profile` 菜单（"🌙 暗色模式"toggle）；
- 替换所有静态 `slate-/white/black` class 为 `text-slate-700 dark:text-slate-200` 等；
- 全量排查 + 添加 `dark:` 前缀（可用 `tailwindcss-dark-mode` 插件辅助）。

#### UX-12 · RTL 语种（ur）实际未做布局反向

**位置**：`apps/web/src/lib/i18n.tsx:25-27` 设置 `<html dir="rtl">`，但 globals.css 中无任何 `[dir="rtl"]` 规则
**问题**：
1. `LangSwitch` 切到 `ur`，`<html dir="rtl">` 设置成功，但：
   - TabBar 图标顺序未反向（⌂ 在左、◯ 在右）；
   - `TopBar` 的返回箭头（`path d="M15 6l-6 6 6 6"`）指向左 → RTL 下应指向右；
   - `Drawer` 是 `justify-end` → RTL 下应 `justify-start`；
   - `card p-4 grid` 仍是 LTR 排列 → 文字+数字顺序错乱；
2. **字号 / 字距未适配** Urdu 字体（Noto Nastaliq Urdu）需要更大行距；
3. **测试覆盖度低**：i18n.test.ts 只测 zh/en 对称，没测 RTL。

**修**：
```css
[dir="rtl"] .tabbar { direction: rtl; }
[dir="rtl"] .topbar .back-btn svg { transform: scaleX(-1); }
[dir="rtl"] .urgent-border { border-left: 0; border-right: 4px solid var(--matoo-chip-red-fg); }
```
- 引入 `@tailwindcss/rtl` 插件；
- i18n.test.ts 加 RTL 测试用例。

#### UX-13 · Onboarding 一次性后无"重看"入口

**位置**：`apps/web/src/components/Onboarding.tsx`
**问题**：
1. 首次访问 `matoo.onboarded = 1` 后**永久不再出现**；
2. 没有"再看一次引导"入口 → 新功能上线无法触达老用户；
3. 3 步引导**没有**"上一步"按钮（用户跳到第 3 步想回去看第 1 步无路径）；
5. 第 2 步（"激活保修"）没有任何 illustration；
6. 进度点（dots）**不可点击**（常见可点跳步）；
7. 第 1 步主题描述 "📷 扫码验真..." 是**通用文案**，但 **激活保修流程需要国家/发票信息**，引导完全没说。

**修**：
- 进度点可点击跳步；
- 加"上一步"按钮（仅第 2/3 步）；
- profile 加"📖 重新看引导"按钮（重置 localStorage）；
- 每步加真实 illustration（用 SVG 或 emoji 序列讲故事）。

#### UX-14 · 表单体验系统性问题（5 个页面）
**问题**：
1. **`auth/page.tsx`** — OTP 输入无 autoSubmit（输完 6 位应自动提交），无 paste OTP from SMS（iOS 自动从短信读取 OTP）；
2. **`activate/[id]/page.tsx`** — 城市选择器是 free text 而非 dropdown（孟加拉国有 60+ 主要城市），城市拼错易出错；
3. **`tickets/new/page.tsx`** — 提交按钮的 disabled 条件不严密：subject=3 字符就过，但 description 与问题没有字数提示（虽然下面有 `1000/1000`）；
4. **`dealer/batch/page.tsx`** — 客户手机号验证只有 `type=tel`，无 pattern 校验（前端防 +880 格式错误）；
5. **`auth/page.tsx`** — Phone 默认值 `+880`，但很多孟加拉手机是 `+880 1xxx` → 用户删前面几位补错 → 验证失败没提示。

**修**：
- OTP input 监听 6 位满 → 自动提交 + 监听 `autocomplete="one-time-code"`（已加但未用）；
- 城市用 `<select>` 或 `<datalist>` 配合搜索；
- subject/description 加 `minLength` HTML5 校验；
- 手机号 pattern `^\+8801\d{9}$` 客户端预校验；
- 默认值改为 placeholder，避免误提交。

#### UX-15 · 时间 / 数字格式化本地化缺失

**位置**：
- 全局使用 `new Date(x).toLocaleString()` / `.toLocaleDateString()`
- `apps/web/src/app/admin/analytics/page.tsx` 的 `SparkSection` 使用 `labels[i]` (day 月-日) 但没考虑 locale

**问题**：
1. `toLocaleString()` 不带参数 → 跟随浏览器默认 locale，**但已切到 bn 仍是英文**（如 `9/21/2026` 而非孟加拉日历）；
3. 货币：shop `USD 18` 硬编码，应根据 locale 显示 BDT/INR；
4. `act-country` 默认 `Bangladesh` → `BD`，所有国家选择 + 货币映射硬编码 5 个；
5. 数字千分位 + 小数点（孟加拉/印度用 lakh/crore 计数）。

**修**：
- `toLocaleString(lang)` 传当前 lang；
- 货币格式化 `new Intl.NumberFormat(lang, { style: 'currency', currency: map[country] })`；
- 国家列表抽到后端 API（`GET /geo/countries`）；
- 大数用 `Intl.NumberFormat` + 自定义 unit。

#### UX-16 · 设备详情页 `/device/[id]` SoC 趋势图无 X 轴

**位置**：`apps/web/src/app/device/[id]/page.tsx:198-224` `SparkLine`
**问题**：
1. SVG `viewBox` 280x60，但只有 X 坐标等距 → 用户看不出"6 小时"跨度；
2. 数据点 `<circle>` 鼠标 hover 只能看 `<title>` tooltip（部分浏览器不显示）；
3. **没有坐标轴标签**（"现在"、"3h 前"、"6h 前"）；
4. 颜色只有绿色 → **暗色模式下与背景同色**；
5. 6h 趋势 + 1h 电压都展示 → 第二个未使用。

#### UX-17 · 仪表盘 admin analytics 趋势图视觉过密

**位置**：`apps/web/src/app/admin/analytics/page.tsx:133-182` `SparkSection`
**问题**：
1. 7/30/90 天切换时 SVG viewBox 固定 320x80 → 90 天数据点重叠；
2. 数据点 `<title>` tooltip 不可靠；
3. **首尾日期标签**是绝对定位，**中间无标签**，用户不知道中段是哪天；
4. 三条趋势图（warranty/device/ticket）配色（绿/蓝/橙）**色盲不友好**（红绿色盲区分度低）。

**修**：
- SVG 改用真实 chart 库（recharts / visx / chart.js）+ 鼠标十字线 tooltip；
- 90 天模式改用月聚合；
- 配色改色盲友好 palette（红/蓝/黄）。

#### UX-18 · `/dealer/dashboard` 经销商身份硬编码"Dhaka Power Hub"

**位置**：`apps/web/src/app/dealer/dashboard/page.tsx:53-58` + `apps/web/src/app/dealer/batch/page.tsx:91-98`
**问题**：
1. 顶部卡片文案硬编码 "Dhaka Power Hub" + ✓ "已认证"，**所有经销商都显示 Dhaka**；
2. demo 期可以，但生产期直接显示错误信息 → 商业信任崩塌；
3. 同样 `dealer/batch/page.tsx:95` 文案 `t.dealer.role：t.dealer.roleVal` 文字重复"经销商：经销商"。

**修**：
- 拉真实 dealer entity（需后端加 `Dealer` 表 + `GET /dealer/me` 返回 dealer 信息）；
- 修复 `t.dealer.roleVal` 文案重叠问题（应叫"角色"+"经销商"是同义词，删 roleVal 改用"已认证经销商"）。

#### UX-19 · admin 工单详情 Drawer 操作反馈不到位

**位置**：`apps/web/src/app/admin/tickets/page.tsx:231-263`
**问题**：
1. "处理中" / "等客户" / "已解决" / "关闭" 4 个按钮**没有视觉区分**（"已解决"绿色 vs 其他灰色）；
2. 状态变更后**没有即时确认反馈**（除 success toast），用户不知道改成功；
3. **resolution 文本框**只在 resolved/closed 时填，其他状态切换被忽略 → 用户看不到这条提示；
4. 工单列表点开 drawer 但**抽屉内的 keydown 事件只能 Esc 关闭**，tab 切换、状态变更无对应键盘快捷键。

**修**：
- 4 个状态按钮颜色分级（绿 = 已解决；红 = 关闭；其他灰）；
- 状态变更后 toast 显示新状态名；
- 始终显示 resolution 文本框，但提示"已解决时建议填写"；
- 加键盘快捷键：`Ctrl+Enter` 发送回复。

---

### 2.3 🟢 P2 · 体验优化（生产期加分项）

#### UX-20 · 一致性问题清单

| 现象 | 影响 | 修法 |
|------|------|------|
| 所有页面顶部 `9:41` + `100%`（仅 PWA 显示）但其他状态信息缺失（无信号/WiFi 图标） | 假状态栏粗糙 | 加信号点 + WiFi 弧 |
| `bg-slate-100 dark:bg-slate-800` 部分页面用，部分只用 `bg-slate-100` | 暗色不一致 | 统一切 token |
| `chip` 颜色不统一：成功绿色 = `chip-green`，但 home 页工单数字 `bg-amber-100 text-amber-600` 是另一套 | 视觉语言碎片 | 全部走 chip-* 系统类 |
| "在线客服" 链接用 `wa.me/WHATSAPP_PLACEHOLDER` → 用户点了无反应 | 死链 | 接真实号码或删除按钮 |
| 顶栏 `9:41` 显示但 PWA 实际状态是动态的（不是 9:41） | 不真实 | 用 `new Date()` 实时 |
| `Matoo Power 12V 200Ah LiFePO4 Battery` 名字太长 → 在卡片上 truncate → **用户看不到完整型号** | 信息丢失 | 卡片用 "12V 200Ah" + tooltip 显示完整名 |
| TopBar 返回按钮在根页面（`/` 直接 redirect）点返回 → 退出 | 死路 | 根页面 TopBar 隐藏返回按钮 |
| `confirm.tsx` `border-slate-300` 不适配暗色 | 暗色对比差 | `dark:border-slate-600` |
| `Toast.tsx` 2400ms 太短 → 用户来不及读错误信息 | 错误信息易丢失 | 错误类 4-5s，成功 2s |

#### UX-21 · 空状态文案不友好

**位置**：8 处 `<EmptyState>`，文案都是 "该 SKU 尚未激活保修" 类技术化语言
**问题**：对终端用户（摩洛哥农民、孟加拉三轮车夫）太抽象
**修**：加 action-oriented 文案
- `t.devices.empty` "暂无设备" → "扫一扫你的产品二维码开始使用"
- `t.ticket.empty` "暂无工单" → "遇到问题？联系客服 7×24 小时响应"

#### UX-22 · 信息架构问题

| 问题 | 修法 | 状态 |
|------|------|------|
| TopBar 标题字号固定 15px，**长标题截断不可见**（"客服工作台" 截成"客服..."） | 加 `truncate` 或动态字号 | ✅ pre-existing（`TopBar.tsx:40` `truncate min-w-0 px-2 title={title}` 已实现） |
| TabBar 5 个 tab 在窄屏 (< 320px) 文字截断 | 改图标为主，文字可隐藏 | ✅ **P2-9**（`globals.css:240-256` `@media (max-width: 360px)` + `(max-width: 320px)` 两段；图标 22→26→24 px 阶梯放大；`.tab-label` sr-only 保留 aria-label；hover/active 颜色 + 缩放过渡） |
| `/dealer/batch` 没有底部 TabBar → **经销商模式下导航断** | 加底部导航（可与 customer 共用 TabBar + dealer 视图） | ✅（`dealer/batch/page.tsx` 末尾加 `<TabBar />`，与 customer 共用 5 tab；TopBar 保留 `DealerBreadcrumb` 作面包屑） |
| `/admin/*` 没有面包屑 / 返回主页路径 | 加"返回我的"链接到 TopBar | ✅ pre-existing（`TopBar.tsx:47-58` `AdminBreadcrumb` → `/admin/overview`，admin 三页均已挂载） |
| `/tickets/[id]` 返回 `/tickets` 列表用 Link，但点击浏览器返回键退到 admin 列表 → **路径不一致** | 统一从 admin 进入时 back 行为 | ✅（`tickets/[id]/page.tsx` 错误态 "返回列表" 链接按 role 智能分流：admin → `/admin/tickets`，其他 → `/tickets`） |
| `M` 字母 logo 占位 → 品牌识别弱 | 用真实 SVG logo（来自 website/assets） | ✅ **品牌对齐 website**（`home/page.tsx` 顶栏 + 设备卡两处 `<Brand variant="icon" />`；`Brand.tsx` 内联 SVG 六边形 `#091E42` + 蓝绿渐变 M `#0052CC → #36B37E` + 绿色 accent；hex 路径 `M16 2 L30 10 L30 26 L16 34 L2 26 L2 10 Z` 与 `website/assets/logo.svg` 1:1；PWA icon.svg / icon-192 / icon-512 同步更新；详见 §2.3 P2 + AUDIT.md §5.2） |
| 跨产品品牌矩阵（社媒 + 微信）无对应 UI → 用户找不到 follow 入口 | 在 profile 加 Follow Us 区，对齐 website footer .footer-social-row | ✅ **社媒图标对齐 website**（`SocialIcons.tsx` 内联 7 平台：Facebook/WeChat/LinkedIn/Twitter/YouTube/Instagram/WhatsApp；每个 `d=` 复用 `website/assets/icon-*.svg`；`profile/page.tsx` 加 `<SocialRow>` + WeChat ID 复制 fallback；hover brightness(1.1) 对齐 website `.footer-social-icon:hover`） |

#### UX-23 · 微交互缺失

| 现象 | 影响 | 状态 |
|------|------|------|
| `setItems({...status: 'ok'})` 后**列表项没有动画**反馈 | 视觉跳跃 | ✅（`dealer/batch/page.tsx` 每行加 `slide-in-up` 错落入场 + `prevStatus` ref 检测状态切换；绿/红脉冲 `.status-pulse-ok` / `.status-pulse-fail` 在 `globals.css` 新增 keyframes，650ms 后自动清类） |
| 工单回复 `replyTicket().then(setDetail)` → **消息没有滑入动画** | 体验断裂 | ✅ **P2-22**（`globals.css:304-308` `.bubble-in` + `tickets/[id]/page.tsx:2-3,29-52,145-154` `seenIds` ref 仅播新消息；首批 `requestAnimationFrame` 错落入场 30 ms × index 封顶 15 项） |
| 设备详情 SoC 趋势 hover 只有 `<title>` → **移动端无效** | 移动端不可达 | ✅ **P2-23**（`device/[id]/page.tsx:200-378` SparkLine 重写：useRef + useState + `pointerMove/Leave/Cancel` 三事件统一触/鼠 + `.spark-tooltip` 显示 `%` + 时间偏移；附加 X/Y 轴 `−6h/−3h/now` `max/mid/min` 标签 + max/min/current 三点高亮 + `spark-draw .55s` 描线动画） |
| `Drawer` 打开/关闭**没有过渡动画** | 突兀 | ✅ pre-existing（`Drawer.tsx:55-60` 已加 `backdrop-anim backdrop-in` + `animate-slide-up` 配合 `requestAnimationFrame` 触发；mounted 状态下一帧挂载） |
| `TabBar` 切换 tab **没有过渡** | 视觉硬切 | 🟡 部分（P2-9 hover/active 颜色 + 缩放过渡 ✅；路由切换的页面级过渡因 Next.js App Router 限制暂未实现） |
| `Toast` 淡入 180ms 但**消失无淡出**（直接 setTimeout remove） | 视觉突兀 | ✅ pre-existing（`Toast.tsx:36-46` 已实现：先标 `leaving=true` 触发 `.animate-toast-out` 180ms，再移除节点） |
| `confirm.tsx` 弹窗**无动画** | 突兀 | ✅ pre-existing（`Confirm.tsx:42-47` 已加 `backdrop-anim backdrop-in` + `card-anim card-in`，与 Drawer 同样的 rAF 触发模式） |

#### UX-24 · 可达性（A11y）问题

| 问题 | 修法 | 状态 |
|------|------|------|
| `Onboarding.tsx` 没有 `aria-label` 关闭按钮 | 加 | ✅ pre-existing（`Onboarding.tsx:47` `aria-label="关闭引导"` + `focus-visible:outline` 已实现） |
| `Drawer` backdrop `<button>` 无可见焦点样式 | `focus-visible` 加轮廓 | ✅ pre-existing（`Drawer.tsx:57,67` `focus-visible:outline focus-visible:outline-2 focus-visible:outline-matoo` 已实现） |
| TabBar `usePathname()?.startsWith()` 在 `/devices/compare` 高亮 `/devices` | 用完整路径匹配 | ✅ pre-existing（`TabBar.tsx:17-20` `isActive()` 用 `pathname === href \|\| pathname.startsWith(href + '/')`） |
| `<input type="search">` 没绑 `<form>` → Enter 键不提交 | 加 `<form onSubmit>` | ✅ pre-existing（`devices/page.tsx:68`、`admin/tickets:157`、`admin/warranties`、`admin/users` 全部用 `<form onSubmit={(e) => e.preventDefault()}>` 包裹 `type="search"`） |
| `ErrorBlock` 只有 `role="alert"` 但没 `aria-live="assertive"` | 加 | ✅ pre-existing（`ErrorBlock.tsx:45` `role="alert" aria-live="assertive"`） |
| 跳过链接 `<a href="#main-content">` **必须键盘 Tab 才能看到**（普通鼠标用户不可见）→ 鼠标 + 键盘用户都不可见 | 改为**悬停或屏幕顶部**固定条 | ✅（已在 `globals.css:55-79` 加 `.skip-link` fixed 顶部条 + hover/focus/show-skip 三种状态；详见 UX-22 完成项） |
| 所有 emoji 用法（📷 🛡 🛒 🎫）缺 `aria-label` | 加 `aria-hidden="true"`（部分已加，但不一致） | ✅（`tickets/[id]/page.tsx:166` + `admin/tickets/page.tsx:254` 的 `🛠` / `⚙` / `👤` 全部包 `<span aria-hidden="true">`；`dealer/batch/page.tsx:217-218` 的 `✓` / `✗` 也补 `aria-hidden`） |
| `app.lang="ur"` 时所有 `<input dir>` 未显式声明 → 输入法切换 | `<input dir="auto">` | ✅ **P2-17**（共 9 个文件、15 处文本输入全部加 `dir="auto"`：`dealer/batch` 客户名+发票号、`dealer/pickup` 发票号+原始文本、`activate/[id]` 发票号、`tickets/new` 主题+描述、`tickets/[id]` 回复、`devices` 搜索、`admin/tickets` 搜索+回复+解决、`admin/warranties` 搜索+备注、`admin/users` 搜索） |

#### UX-25 · 性能与体验感

| 指标 | 当前 | 目标 |
|------|------|------|
| 首屏 FCP | SSG + RSC（待测） | < 1.5s |
| LCP | 缺文案 + 图片 LCP 优化 | < 2.5s |
| TTI（弱网 3G） | 无预算 | < 5s |
| Bundle Size | `next build` 产物（待测） | < 200KB initial |
| 图片 | `ProductArt` 用 SVG 占位（演示期） | 真实图片 + WebP + LQIP |
| SW cache | 已实现 network-first HTML | ✅ |

---

## 3. 功能缺口（对照《独立产品需求说明书》）

### 3.1 已实现功能（✓）

| 需求 | 实现 | 路由 |
|------|------|------|
| 3.1 一物一码 + 真伪 + 重复扫码提示 | ✓ | `/scan/[id]` |
| 3.2 手机号 + OTP 登录 | ✓ | `/auth` |
| 3.3 保修激活 + 4 部件明细 | ✓ | `/activate/[id]` → `/warranty/[id]` |
| 3.4 设备绑定（基础版） | ✓ | `/device/[id]` |
| 3.4 健康看板 + SoC 趋势 | ✓（mock 数据） | `/device/[id]` |
| 3.6 工单 CRUD | ✓ | `/tickets/*` + `/admin/tickets` |
| 3.7 后台：SKU/保修/工单/概览 | ✓ | `/admin/*` |
| 3.8 经销商工作台：批量激活 + dashboard | ✓ | `/dealer/*` |
| 3.8 经销商认证 | ❌（seed 直接建 dealer） | — |

### 3.2 ❌ 未实现 / 占位功能（按需求文档）

| 需求编号 | 需求 | 当前状态 | 优先级 |
|----------|------|----------|--------|
| 3.1 | 使用说明书 PDF / 视频在线播放 | ❌ 按钮无 onClick（演示占位） | P1 |
| 3.1 | 防伪签名验证 | ⚠️ 后端有但前端无显式提示"已被扫码 N 次" | P1 |
| 3.1 | 二维码被复制风险提示 | ❌ 无 | P1 |
| 3.2 | WhatsApp OTP | ❌ 占位 | P2 |
| 3.2 | Email + 密码登录 | ⚠️ 后端实现前端未启用 | P2 |
| 3.3 | 发票照片上传（OCR） | ❌ 假按钮 | P1 |
| 3.3 | 防窜货（采购地 vs 销售区域） | ❌ 后端无校验 | P2 |
| 3.3 | 同一发票重复激活检测 | ⚠️ 同 SKU 同用户去重，但同 invoiceNo 全局不限 | P1 |
| 3.3 | 不同部件保修期可配 | ✓（schema 已有 4 字段） | ✅ |
| 3.4 | 蓝牙 / 4G 配网 | ❌（纯演示，绑定即视为配网） | P2 |
| 3.4 | 实时数据上报 | ❌（演示数据 30 秒抖动） | P2 |
| 3.4 | 远程诊断 / 固件升级 | ⚠️ 诊断演示 OK，升级占位 | P2 |
| 3.5 | 配件商城：分类筛选 | ✓ 演示数据 | ✅ |
| 3.5 | 按设备兼容 | ✓ `compatibleSkus` | ✅ |
| 3.5 | 公开价 vs 经销商价 | ❌ 无区分 | P2 |
| 3.5 | 购物车 / 下单 / 支付 / 物流 | ❌ 完全缺失 | P2 |
| 3.6 | 上传故障照片 / 视频 | ❌ 工单只有文本 | P1 |
| 3.6 | 常见问题 FAQ | ❌ 无 | P2 |
| 3.6 | 技术文档下载 | ❌ 占位 | P2 |
| 3.7 | 二维码批次管理 | ❌ 后端无 | P1 |
| 3.7 | 保修审核 UI | ❌ 后端 `/admin/warranties/:id/review` 有，前端无页 | P1 |
| 3.7 | 用户与权限管理 UI | ❌ | P1 |
| 3.7 | 经销商管理 UI | ❌ | P1 |
| 3.7 | 订单与库存管理 | ❌ | P2 |
| 3.7 | 数据报表：激活量/保修率/故障率/复购率 | ⚠️ 部分（admin analytics 有趋势，但缺"率"指标） | P1 |
| 3.7 | 多语言内容管理（说明书/视频/FAQ） | ❌ | P2 |
| 3.8 | 经销商认证（提交企业资料） | ❌ | P1 |
| 3.8 | 代客户绑定 | ❌（批量激活会自动建 customer + device） | P1 |
| 3.8 | 专属价格 | ❌ | P2 |
| 3.8 | 批量采购 | ❌ | P2 |
| 3.8 | 出货记录管理 | ❌ | P1 |
| 5 | 多语言：en/zh/bn/hi/ur | ✓ zh/en 完整，bn/hi/ur 占位 84% | — |
| 5 | 支付：Stripe/PayPal + bKash | ❌ | P2 |
| 5 | 隐私政策（南亚合规） | ⚠️ 占位文案 | P1 |
| 5 | 数据存储合规 | ❌ | P2 |

### 3.3 缺口统计

| 类别 | 数量 | 占比 |
|------|------|------|
| ✅ 已实现 | 9 | 17% |
| ⚠️ 部分实现 | 7 | 13% |
| ❌ 未实现 | 38 | 70% |
| **合计** | **54** | **100%** |

**核心结论**：MVP（P0）功能 9/9 实现；P1 功能 7/23 部分实现；P2 功能 0/22 实现。**P0 验收通过**。

---

## 4. 优化方案（分阶段）

### 4.1 🔥 立即优化（1 周内 · 修 P0 UX）

**目标**：消除核心流程死路 + 修复 admin 角色泄漏

| # | 任务 | 涉及文件 | 估时 |
|---|------|----------|------|
| 1 | `/admin/*` 三个页加 `useRequireRole('admin')` | 新建 hooks/useRequireRole.ts + 3 页 | 0.5d |
| 2 | 首页 demo 入口按 `process.env.NEXT_PUBLIC_DEMO` 条件渲染 | home/page.tsx:158-165 | 0.5h |
| 3 | 扫码页失败 → `scanCount > 5` 提示异常 | scan/[id]/page.tsx + sku.service 加字段 | 0.5d |
| 4 | `/auth` 三个 tab 拆分：phone 全功能、email/wa 隐藏 + "Coming Q3" banner | auth/page.tsx:91-171 | 0.5d |
| 5 | `/activate` 发票照片按钮 → 真实 file input + 缩略图 | activate/[id]/page.tsx:170-185 | 1d |
| 6 | `/dealer/batch` 进度条实时更新 + 失败项单独高亮 | dealer/batch/page.tsx:46-81 | 1d |
| 7 | `/shop` "加入购物车" 按钮完全隐藏 / 改 disabled 文案 | shop/page.tsx:136-143 | 0.5h |
| 8 | `/messages` 重命名为"工单与通知"+ 加未读数 | messages/page.tsx + tabbar | 0.5d |
| 9 | `Onboarding` 加进度点可点击 + 上一步按钮 + profile 重看入口 | Onboarding.tsx + profile | 0.5d |
| 10 | admin 工单 Drawer 4 状态按钮配色区分 | admin/tickets/page.tsx:256-261 | 0.5h |

**合计 5 人天**。

### 4.3 中期优化（2-4 周 · P1 UX + P1 功能）

**目标**：生产化体验提升 + P1 功能补完

| # | 任务 | 估时 |
|---|------|------|
| 11 | 全量排查 `dark:` 前缀缺失类名 | 1d |
| 12 | RTL（ur）布局反向 + `@tailwindcss/rtl` 插件 | 1d |
| 13 | 暗色模式 UI 入口（profile toggle） | 0.5d |
| 14 | 所有 fetch 加 AbortController + 取消旧请求 | 1d |
| 15 | TabBar 精确路径匹配 + 中间空 tab 占位（admin/dealer 进入主流程时） | 0.5d |
| 16 | 时间/数字/货币本地化（`Intl` API + 国家映射） | 1d |
| 17 | 加载骨架化（设备列表 + 工单列表 + 趋势图） | 1d |
| 18 | 设备详情 SoC 趋势图改真实 chart 库（recharts/visx） | 1.5d |
| 19 | admin analytics 趋势图改真实 chart 库 + 鼠标十字 tooltip | 1.5d |
| 20 | 工单详情加图片附件上传 | 1.5d |
| 21 | 后端补 `POST /admin/warranties/:id/review` UI 入口 | 2d |
| 22 | 后端补 `POST /dealer/pickup` + 经销商出货记录 UI | 2d |
| 23 | 后端补 `POST /sku/admin/batch` + 二维码批次管理 UI | 2d |
| 24 | 后端补 `POST /users` + 用户管理 UI + Dealer 认证流 | 3d |
| 25 | 后端补 `GET /admin/analytics/conversion`（保修率/故障率/复购率） | 2d |
| 26 | 隐私政策文案按南亚 5 国定制（孟加拉/印度/巴基斯坦/斯里兰卡/尼泊尔） | 2d |
| 27 | 真实 WhatsApp 客服链接占位替换（生产期） | 0.5d |

**合计 28 人天**。

### 4.4 长期规划（1-3 月 · P2）

| # | 任务 | 估时 |
|---|------|------|
| 28 | Email + 密码登录 UI + 找回密码 | 3d |
| 29 | WhatsApp OTP 集成（wa-business API） | 5d |
| 30 | 真实蓝牙/WiFi 配网（Web Bluetooth API + WiFi P2P） | 14d |
| 31 | 真实 BMS MQTT 上报 + 设备实时数据 | 21d |
| 32 | OTA 固件升级 | 14d |
| 33 | 配件商城：购物车 + Stripe + bKash + 物流 | 30d |
| 34 | 经销商专属价格表 | 7d |
| 35 | 防窜货区域校验（采购地 vs 出货记录） | 7d |
| 36 | 全量 14 语言补齐（外包专业翻译 + i18n 流程） | 14d |
| 37 | 真实图片素材替换 + LQIP + WebP | 5d |
| 38 | PWA 离线模式增强（IndexedDB 缓存工单 + 离线回复队列） | 7d |
| 39 | Web Push / SSE 实时通知 | 7d |
| 40 | 暗色模式完整化 + 高对比度模式（a11y） | 5d |
| 41 | 性能优化：bundle 拆分 + 图片懒加载 + 字体优化 | 5d |
| 42 | 引入 Storybook + 组件测试（补 0 → 20+） | 7d |

**合计 160 人天**。

### 4.5 测试补完（与功能并行）

| # | 任务 | 估时 |
|---|------|------|
| T1 | 补 API e2e 到 ≥ 30 用例（覆盖 4 缺口） | 1d |
| T2 | 加组件测试（PhoneShell / TabBar / Drawer / Toast / Confirm / Onboarding） | 2d |
| T3 | 加共享包测试（qr-signer / format / zod schemas） | 1d |
| T4 | 加 Playwright E2E（核心 5 流程 + 3 角色） | 3d |
| T5 | 加 Lighthouse CI（性能/可达性/最佳实践/SEO ≥ 90） | 1d |
| T6 | 加 Sentry（前后端错误监控） | 1d |

**合计 9 人天**。

---

## 5. 验收结论

### 5.1 一句话验收结论

> **演示期可交付，但生产期前必须修 P0 UX 10 个 + P1 17 个缺陷 + P1 后端缺口 7 项。**

### 5.2 分级验收

| 等级 | 标准 | 当前状态 |
|------|------|----------|
| **Demo（演示期）** | 主要流程可走通 + 演示数据完整 | ⚠️ 大部分 OK，**P0 UX-7 必须先修**（admin 角色泄漏） |
| **Pilot（试点期）** | 安全 / 隐私 / 主要 UX 修复 | 🔴 不通过：JWT 在 localStorage、OTP 无重试锁、admin 角色泄漏、暗色/RTL 不完整 |
| **Production（生产期）** | 全部 P0/P1 完成 + 真实硬件对接 + 多语言完整 | 🔴 不通过：缺支付/物流/WhatsApp/真实 BMS |

### 5.3 三端协同验收（h5-app 与 website/admin）

| 协同点 | 状态 |
|--------|------|
| 品牌统一：Matoo Power 名称/logo | ⚠️ website `alternateName="华奕智能科技"`，h5-app 全英文，**待品牌决策** |
| 营销站询盘 → h5-app 客服工单 | ❌ 后端无对接（`/api/inquiries` website 端已修，h5-app 端未接） |
| SKU 主数据双向同步 | ❌ 无 |
| 统一账号（可选打通） | ❌ 暂不计划（按需求 §1.3） |

---

## 6. 附录：测试用例模板（建议纳入 CI）

### 6.1 核心 5 流程烟雾测试（建议 E2E）

```
1. customer-sms-verify-activate-device:
   - 扫 MATO-...001 → 激活 → 绑定 → 看健康看板 → 截图

2. customer-claim-warranty-view:
   - 已激活 → /warranty/[id] → 验证 4 部件日期正确

3. customer-create-ticket-reply:
   - /tickets/new → 提交 → 跳详情 → 模拟 admin 回复 → 用户看回复

4. dealer-batch-activate:
   - dealer 登录 → /dealer/batch → 选 5 项 → 填客户 → 提交 → /dealer/dashboard 数字增加

5. admin-overview-ticket-handle:
   - admin 登录 → /admin/overview → /admin/tickets → 打开 drawer → 改状态
```

### 6.2 视觉回归测试（建议 Playwright + screenshot diff）

```
- home zh: 截图比对
- home en: 截图比对
- home bn: 截图比对（占位）
- home ur: RTL 截图比对
- scan/[id] happy path: 截图
- scan/[id] fake: 截图
- warranty/[id] active: 截图
- warranty/[id] empty: 截图
- ticket detail 4 状态: 各截图
```

### 6.3 性能预算
```
- LCP < 2.5s
- TBT < 200ms
- CLS < 0.1
- Bundle (initial) < 200KB gzip
- 图片: 12 张以下每页 / WebP / LQIP
```

---

**报告版本**：v1.0 · 2026-09-21
**配套文档**：AUDIT.md（技术审计）/ DEPLOY.md（部署）/ SOP（运维）
**建议**：
1. **本周内**完成 P0 UX 10 项 + useRequireRole hook（详见 §4.1）
2. **下周**决定 RTL 是否纳入 v1.0（南亚 ur 是 P1+ 市场）
3. **本月**完成 P1 UX 17 项 + P1 后端缺口 7 项
4. **下季度**评估 P2（配件商城 + WhatsApp + 真实硬件对接）