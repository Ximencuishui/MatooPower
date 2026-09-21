// 安全响应头配置（helmet）— P0-5
//
// 说明：
//  - Swagger UI（/api）由 swagger-ui-express 从 cdn.jsdelivr.net 加载样式/脚本，
//    且页面内联初始化脚本，故 CSP 放行 'unsafe-inline' + jsdelivr；
//    生产期收紧选项见 ACCEPTANCE-V2-REPORT §9.2（替换为本地静态 swagger-dist 后可移除）
//  - frameAncestors 'none'：禁止 iframe 嵌套（点击劫持）
//  - 单点导出：main.ts（生产入口）与 test/e2e/helpers.ts（测试对齐）共用同一配置

import type { HelmetOptions } from 'helmet';

export const SECURITY_HEADERS: HelmetOptions = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
      fontSrc: ["'self'", 'data:', 'https://cdn.jsdelivr.net'],
      imgSrc: ["'self'", 'data:', 'https://cdn.jsdelivr.net'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'same-origin' },
};