// T6 Sentry 集成：仅当 SENTRY_AUTH_TOKEN 有值时用 withSentryConfig 包裹（启用 source maps 上传 + tunnel 反代）
// - 本机/无 token：保持原 config，不拖慢 dev build
// - 生产/CI：SENTRY_AUTH_TOKEN + SENTRY_ORG + SENTRY_PROJECT 必填
import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(self), microphone=()' },
  // HSTS 仅在生产 HTTPS 下生效
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
    ];
  },
  async redirects() {
    return [
      // 根路径重定向：演示默认扫到第一个 SKU
      { source: '/', destination: '/scan/MATO-MAT12200-DEMO0001', permanent: false },
    ];
  },
};

// 条件包裹：SENTRY_AUTH_TOKEN 存在时才走 withSentryConfig（产线 source map 上传 + tunnel）
// - tunnelRoute: 经 web 转发 sentry 请求，避开广告拦截器（推荐）
// - silent: 本机 build 不打印 Sentry 插件日志（CI 仍输出）
const sentryOptions = {
  org: process.env.SENTRY_ORG ?? 'matoo-power',
  project: process.env.SENTRY_PROJECT ?? 'h5-app-web',
  silent: !process.env.CI,
  tunnelRoute: '/sentry-tunnel',
  // 仅上传 production sourcemap，避免 dev 噪音
  hideSourceMaps: true,
};

export default process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(nextConfig, sentryOptions)
  : nextConfig;