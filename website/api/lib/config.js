/**
 * Matoo Admin API · Config loader
 *
 * Single source of truth for environment variables. Loads api/.env
 * if present, then exposes a frozen config object.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ENV_FILE = path.join(ROOT, '.env');

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(ENV_FILE);

function int(name, def) {
  const v = process.env[name];
  if (v === undefined || v === '') return def;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

function bool(name, def) {
  const v = process.env[name];
  if (v === undefined || v === '') return def;
  return /^(1|true|yes|on)$/i.test(v);
}

const config = Object.freeze({
  port: int('PORT', 8000),
  bind: process.env.BIND || '127.0.0.1',
  adminPassword: process.env.ADMIN_PASSWORD || '',
  sessionSecret: process.env.SESSION_SECRET || '',
  maxUploadMB: int('MAX_UPLOAD_MB', 10),
  sharpEnabled: bool('SHARP_ENABLED', true),
  // v1.4 T-2d X2:website 询盘转发到 h5-app 公开端点
  // 默认指向本机 dev API(可由 .env 的 H5_APP_API_URL 覆盖)
  // 生产期应设为 https://api.matoopower.com/public/inquiry-from-web
  // 注:h5-app main.ts 未设 setGlobalPrefix('api'),所以路径不带 /api 前缀(与 smoke 脚本 /auth/otp/request 一致)
  h5AppApiUrl: process.env.H5_APP_API_URL || 'http://127.0.0.1:3001/public/inquiry-from-web',
  // 转发超时(超过即丢弃,不影响本地 inquiries.log 落盘)
  h5AppApiTimeoutMs: int('H5_APP_API_TIMEOUT_MS', 4000),
  // 转发开关(演示期可显式关闭,只在 .env 设 H5_APP_API_DISABLED=1 即可)
  h5AppApiDisabled: bool('H5_APP_API_DISABLED', false),
  paths: Object.freeze({
    root: ROOT,
    websiteRoot: path.resolve(ROOT, '..'),
    i18nDir: path.resolve(ROOT, '..', 'i18n'),
    assetsDir: path.resolve(ROOT, '..', 'assets'),
    dataDir: path.join(ROOT, 'data'),
    auditLog: path.join(ROOT, 'data', 'audit.log'),
    sessionsFile: path.join(ROOT, 'data', 'sessions.json'),
    adminFile: path.join(ROOT, 'data', 'admin.json'),
    i18nBackupDir: path.join(ROOT, 'data', '.bak'),
  }),
});

module.exports = config;