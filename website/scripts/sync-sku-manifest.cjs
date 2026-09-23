#!/usr/bin/env node
/**
 * sync-sku-manifest.cjs · v1.4 T-2d X3
 *
 * 拉取 h5-app /sku/manifest 公开端点 → 写入 website/data/sku-manifest.json
 *
 * 用途:
 *  - admin 后台增/删/改 SKU 后,运营/CI 跑一次同步,把 SKU 清单拉到 brand 站
 *  - brand 站 products.html 启动时 JS 读取 sku-manifest.json 渲染产品列表
 *  - 解耦:brand 站不依赖 h5-app 在线(快照文件可作为 fallback)
 *
 * 用法:
 *   node scripts/sync-sku-manifest.cjs                              # 默认 http://127.0.0.1:3001
 *   node scripts/sync-sku-manifest.cjs https://api.matoopower.com   # 生产 API
 *   MATOO_API_URL=https://api.matoopower.com node scripts/sync-sku-manifest.cjs
 */
'use strict';

const fs = require('fs');
const path = require('path');

const apiBase = process.argv[2] || process.env.MATOO_API_URL || 'http://127.0.0.1:3001';
const manifestUrl = apiBase.replace(/\/$/, '') + '/sku/manifest';
const outDir = path.join(__dirname, '..', 'data');
const outFile = path.join(outDir, 'sku-manifest.json');

(async () => {
  console.log('[sync-sku-manifest] GET ' + manifestUrl);
  let resp;
  try {
    resp = await fetch(manifestUrl, { headers: { accept: 'application/json' } });
  } catch (e) {
    console.error('[sync-sku-manifest] fetch failed: ' + (e?.message || e));
    process.exit(1);
  }
  if (!resp.ok) {
    console.error('[sync-sku-manifest] HTTP ' + resp.status + ' from ' + manifestUrl);
    process.exit(1);
  }
  const payload = await resp.json();
  if (!payload || payload.ok !== true || !Array.isArray(payload.items)) {
    console.error('[sync-sku-manifest] payload shape unexpected: ' + JSON.stringify(payload).slice(0, 300));
    process.exit(1);
  }
  fs.mkdirSync(outDir, { recursive: true });
  // 顶层补个 _meta 便于 brand 站前端判断 staleness
  const out = {
    _meta: {
      syncedAt: new Date().toISOString(),
      source: manifestUrl,
      count: payload.count,
    },
    items: payload.items,
  };
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log('[sync-sku-manifest] wrote ' + outFile + ' (' + payload.count + ' SKUs)');
})();