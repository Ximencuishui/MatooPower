// T5 Lighthouse CI 配置
// 目标：核心 5 页 mobile + desktop 双预设，先 warn-only 收集基线（不阻塞 CI）
//
// 阈值策略：Lighthouse 默认阈值（performance/90, a11y/90, best-practices/85, seo/85）
//   → 先放宽到 50/70/70/70 等基线收集期阈值，等真正优化后再回调到默认
//
// 浏览器：
//   本机（Windows + Playwright 走 msedge channel）→ LHCI_CHROME_PATH=msedge.exe
//   CI（ubuntu）→ Playwright install --with-deps chromium 提供 chrome-stable
//
// URL 选择：演示入口 + OTP + 设备列表/详情 + 工单列表（核心 5 页）

module.exports = {
  ci: {
    collect: {
      // 演示入口在 next.config.mjs 重定向到第一个 SKU
      url: [
        'http://localhost:3100/scan/MATO-MAT12200-DEMO0001',
        'http://localhost:3100/auth',
        'http://localhost:3100/devices',
        'http://localhost:3100/tickets',
        'http://localhost:3100/home',
      ],
      // 1 跑即可（节省 CI 时间）；本地手测可改 3 跑取均值
      numberOfRuns: 1,
      // lhci autorun 自起 web 服务；api 暂不依赖（页面 fetch 失败不影响 LCP/SEO 基线收集）
      startServerCommand: 'npx next start -p 3100',
      startServerReadyPattern: 'Ready in|started server on',
      startServerReadyTimeout: 60000,
      // chromePath 优先用环境变量；缺省走 msedge（系统 Edge，Playwright 同款）
      chromePath: process.env.LHCI_CHROME_PATH || undefined,
      // chromeFlags：headless 模式 + 关 GPU 加速（CI 与本机一致）
      chromeFlags: '--no-sandbox --disable-gpu --headless=new',
      // 模拟出口带宽 + CPU 限制（mobile profile）用 lighthouse 自身的 throttling
      throttling: {
        // lighthouse 默认 mobile throttling（4G + 4x CPU slowdown）
        // 关闭后只跑 desktop preset（如上）→ 与生产差距小但分数好看
        // 暂保留默认 throttling（performance 真实基线）
        cpuSlowdownMultiplier: 4,
        requestLatencyMs: 150,
        downloadThroughputKbps: 1638.4,
        uploadThroughputKbps: 750,
      },
    },
    assert: {
      // 基线已确认（实测 perf 91-95 / a11y 86-87 / bp 96-100 / seo 100），
      // 收紧到接近默认阈值（90/90/85/85 → 0.85 起步），warn 不阻塞 CI
      // a11y 86 略低于默认 90（受 ARIA 命名影响，后续 SSR 后再回调到 0.9）
      assertions: {
        'categories:performance': ['warn', { minScore: 0.85 }],
        'categories:accessibility': ['warn', { minScore: 0.8 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.9 }],
      },
    },
    upload: {
      // 临时公共存储：lhci 服务器免费 30 天，无需 token
      // 后续接入项目可改 filesystem 或 lighthouse-ci.app
      target: 'temporary-public-storage',
    },
  },
};