/**
 * Matoo Power · Admin & Website unified server
 *
 * Single Node.js process that:
 *   1. Serves the admin UI at  /admin/                (admin/)
 *   2. Exposes the admin REST API at  /api/*          (api/routes/)
 *   3. Serves the production website at  /*           (website root)
 *
 * Designed for local content editing only. The admin UI is
 * intentionally NOT shipped to production hosting.
 */
'use strict';

const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const config = require('./lib/config');
const { ensureAdmin, installExitHooks } = require('./lib/auth');
const authRoutes = require('./routes/auth');
const i18nRoutes = require('./routes/i18n');
const imageRoutes = require('./routes/images');
const auditRoutes = require('./routes/audit');
const analyticsRoutes = require('./routes/analytics');
const inquiriesRoutes = require('./routes/inquiries');
const tracker = require('./lib/tracker');

const app = express();
const STARTED_AT = Date.now();

app.disable('x-powered-by');
app.set('trust proxy', false);

// ---------- Security headers (helmet) ----------
// helmet() sets a sane default set of headers: CSP, X-Content-Type-Options,
// Referrer-Policy, X-DNS-Prefetch-Control, X-Download-Options,
// X-Frame-Options, X-Permitted-Cross-Domain-Policies, Cross-Origin-*-Policy.
// The website serves its own inline <script id="i18n-data"> JSON blocks
// (which helmet would otherwise block via CSP). We disable CSP here and
// trust the path traversal / MIME magic / file extension checks already in
// lib/images.js + lib/store.js + routes/*.js. Production deployments
// behind Cloudflare should layer a strict CSP at the edge.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  // HSTS only meaningful behind HTTPS proxy
  strictTransportSecurity: { maxAge: 63072000, includeSubDomains: true, preload: false },
}));

// ---------- Rate limiting ----------
// Brute-force protection for unauthenticated endpoints. Authenticated
// routes (which carry a valid session cookie + CSRF header) are not
// rate-limited at the app layer; instead, the lockout in lib/auth.js
// (5 fails → 15 min) backs them.
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,                  // 10 attempts per minute per IP
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { ok: false, code: 'RATE_LIMITED', message: 'Too many requests. Try again later.' },
});
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,                  // 60 writes per minute per IP (i18n + image uploads)
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { ok: false, code: 'RATE_LIMITED', message: 'Too many requests. Try again later.' },
});

// Body parsing
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));
app.use(cookieParser());

// ---------- View tracker middleware ----------
// Records GET requests that hit the public website (NOT /api, /admin,
// /health, asset files) into api/data/views.log. Hooked on 'finish'
// so we capture the final status code; any failure is swallowed by
// tracker.trackView itself, so this middleware cannot break responses.
const ASSET_EXT = /\.(png|jpe?g|webp|svg|gif|ico|css|js|map|woff2?|ttf|otf|mp4|mp3|pdf|json|xml|txt)(\?|#|$)/i;
function shouldTrackRequest(p) {
  if (!p || p === '/') return true; // root counts
  const first = '/' + p.replace(/^\/+/, '').split('/')[0];
  if (first === '/api' || first === '/admin' || first === '/health') return false;
  if (ASSET_EXT.test(p)) return false;
  return true;
}
app.use((req, res, next) => {
  if (req.method === 'GET' && shouldTrackRequest(req.path)) {
    res.on('finish', () => tracker.trackView(req, res));
  }
  next();
});

// Static: admin UI (no caching — local dev tool)
app.use(
  '/admin',
  express.static(path.join(config.paths.root, '..', 'admin'), {
    index: 'index.html',
    dotfiles: 'deny',
    etag: false,
    lastModified: false,
  })
);

// Health
app.get('/health', (req, res) => {
  let i18nBytes = 0;
  // Match SUPPORTED_LANGS in lib/store.js
  for (const lang of ['en', 'zh', 'bn', 'ja', 'ko', 'vi', 'hi', 'ur', 'ta', 'te', 'ar', 'fr', 'pt', 'es']) {
    const f = path.join(config.paths.i18nDir, lang + '.json');
    if (fs.existsSync(f)) i18nBytes += fs.statSync(f).size;
  }
  let assetsBytes = 0;
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const child = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile()) assetsBytes += fs.statSync(child).size;
    }
  }
  walk(config.paths.assetsDir);
  // Best-effort view-log size; tolerate missing / corrupt files.
  let viewsBytes = 0;
  try {
    const vf = path.join(config.paths.dataDir, 'views.log');
    if (fs.existsSync(vf)) viewsBytes = fs.statSync(vf).size;
  } catch (_) {}
  res.json({
    ok: true,
    version: '1.0.0',
    uptime_sec: Math.round((Date.now() - STARTED_AT) / 1000),
    i18n_languages: ['en', 'zh', 'bn', 'ja', 'ko', 'vi', 'hi', 'ur', 'ta', 'te', 'ar', 'fr', 'pt', 'es'],
    storage: {
      i18n_kb: Math.round(i18nBytes / 1024),
      assets_mb: Math.round(assetsBytes / 1024 / 1024),
      views_kb: Math.round(viewsBytes / 1024),
    },
  });
});

// API
// auth/* and write endpoints get extra rate limiting; read endpoints
// (audit/analytics/health) are unlimited inside this single-user CMS
// because the lockout at lib/auth.js + session check already rate-limits
// the actual write surface.
app.use('/api/auth/login', authLimiter);
app.use('/api/auth', authRoutes.router);
app.use('/api/i18n', writeLimiter, i18nRoutes);
app.use('/api/images', writeLimiter, imageRoutes);
app.use('/api/inquiries', writeLimiter, inquiriesRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/analytics', analyticsRoutes);

// Frontend: serve website root (HTML, CSS, JS, assets, i18n)
const frontendStatic = express.static(config.paths.websiteRoot, {
  index: 'index.html',
  etag: true,
  lastModified: true,
  dotfiles: 'deny',
  extensions: ['html'],
});
app.use(frontendStatic);

// SPA-style fallback: any non-API, non-admin route → index.html
// (Configurator page deep links etc. need this)
// But only for non-asset paths (no dot in last segment).
app.get(/^\/(?!api\/|admin\/|health).*/, (req, res, next) => {
  if (req.path.includes('.')) return next();
  const indexPath = path.join(config.paths.websiteRoot, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) next();
  });
});

// Centralised error handler — never leak stack to clients
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.status || 500;
  console.error('[error]', req.method, req.originalUrl, '·', err.message);
  res.status(status).json({
    ok: false,
    code: err.code || 'STORAGE_ERROR',
    message: err.message || 'Internal error',
  });
});

// Boot
ensureAdmin();
installExitHooks();
app.listen(config.port, config.bind, () => {
  const url = 'http://' + config.bind + ':' + config.port;
  console.log('');
  console.log('==============================================================');
  console.log(' Matoo Power · Admin & Website');
  console.log('==============================================================');
  console.log(' Frontend   : ' + url + '/');
  console.log(' Admin UI   : ' + url + '/admin/');
  console.log(' API base   : ' + url + '/api');
  console.log(' Health     : ' + url + '/health');
  console.log(' Listening  : ' + config.bind + ':' + config.port);
  console.log('==============================================================');
  console.log('');
});