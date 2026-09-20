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

export default nextConfig;