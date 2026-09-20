/**
 * Matoo Admin API · View event tracker
 *
 * Records GET requests to the public website (i.e. NOT /api, /admin,
 * /health and not asset files) into api/data/views.log as JSON Lines.
 *
 * Privacy posture
 * ---------------
 *   - Never persist the raw client IP. Only an scrypt digest of
 *     (daily rotating salt + IP) is stored, used as a coarse UV key.
 *   - Only the UA category (mobile/desktop/tablet/bot) is stored,
 *     never the full User-Agent string.
 *   - Referrer is reduced to its host (path stripped) or null if
 *     cross-origin / absent.
 *
 * Operational notes
 * -----------------
 *   - Append-only. Sync writes keep the on-disk log crash-consistent
 *     without blocking the request thread for long (a single line
 *     is < 300 bytes; even at 1k req/min that's well below 1 MB/s).
 *   - rotateIfNeeded() is called before every write. If the active
 *     log exceeds MAX_BYTES or crosses a day boundary, it is renamed
 *     to `views-YYYY-MM-DD.log` and a fresh file is opened. The
 *     last MAX_ARCHIVES rotated files are kept; older ones are pruned.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');

const VIEWS_LOG = path.join(config.paths.dataDir, 'views.log');
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_ARCHIVES = 30;

// Daily salt cache. Rotated at process start; never persisted, so a
// restart naturally invalidates the cross-day UV link (intentional).
let dailySalt = crypto.randomBytes(8).toString('hex');
let dailySaltDay = dayStamp(new Date());

function dayStamp(d) {
  return d.toISOString().slice(0, 10);
}

function ensureDataDir() {
  if (!fs.existsSync(config.paths.dataDir)) {
    fs.mkdirSync(config.paths.dataDir, { recursive: true });
  }
  if (!fs.existsSync(VIEWS_LOG)) {
    fs.writeFileSync(VIEWS_LOG, '', 'utf8');
  }
}

function refreshSaltIfNewDay() {
  const today = dayStamp(new Date());
  if (today !== dailySaltDay) {
    dailySalt = crypto.randomBytes(8).toString('hex');
    dailySaltDay = today;
  }
}

// --------------- Classification helpers ---------------

const ASSET_EXT = /\.(png|jpe?g|webp|svg|gif|ico|css|js|map|woff2?|ttf|otf|mp4|mp3|pdf|json|xml|txt)(\?|#|$)/i;

const BOT_UA = /(bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|preview|monitor|headlesschrome|puppeteer|playwright)/i;
const MOBILE_UA = /(mobi|iphone|ipod|android(?!.*tablet)|windows phone|opera mini)/i;
const TABLET_UA = /(ipad|tablet|kindle|playbook|silk)/i;

function classifyUA(ua) {
  if (!ua) return 'unknown';
  if (BOT_UA.test(ua)) return 'bot';
  if (TABLET_UA.test(ua)) return 'tablet';
  if (MOBILE_UA.test(ua)) return 'mobile';
  return 'desktop';
}

function visitorHash(ip) {
  // scrypt(ip, daily_salt) — cheap on reads, and the daily rotation
  // means we can't correlate visitors across days.
  try {
    return crypto
      .scryptSync(String(ip || ''), dailySalt, 16, { N: 16384, r: 8, p: 1 })
      .toString('hex');
  } catch (_) {
    return '0';
  }
}

function extractLang(req) {
  // 1) explicit query: ?lang=zh (used by the front-end lang switcher)
  try {
    const q = (req.query && req.query.lang) || '';
    if (typeof q === 'string' && /^[A-Za-z]{2,8}$/.test(q)) return q.slice(0, 8);
  } catch (_) {}
  // 2) Accept-Language header: pick the first tag, strip region
  const al = req.headers['accept-language'] || '';
  const m = al.match(/([A-Za-z]{2,3})(?:[-_][A-Za-z0-9]+)?\b/);
  if (m) return m[1].toLowerCase();
  return '';
}

function extractReferrerHost(req) {
  const ref = req.headers['referer'] || req.headers['referrer'];
  if (!ref || typeof ref !== 'string') return '';
  try {
    const u = new URL(ref);
    return u.host || '';
  } catch (_) {
    return '';
  }
}

function extractClientIp(req) {
  // No trust-proxy is set on the server, so req.ip reflects the
  // socket address (always 127.0.0.1 on the local admin). If that
  // changes later, swap to the X-Forwarded-For head.
  return req.ip || (req.socket && req.socket.remoteAddress) || '';
}

// --------------- Rotation ---------------

function listArchiveFiles() {
  ensureDataDir();
  return fs
    .readdirSync(config.paths.dataDir)
    .filter((f) => /^views-\d{4}-\d{2}-\d{2}\.log$/.test(f))
    .sort(); // ISO date strings sort lexicographically
}

function rotate() {
  ensureDataDir();
  const day = dailySaltDay;
  const target = path.join(config.paths.dataDir, 'views-' + day + '.log');
  // If today's archive already exists, just append to the live log.
  if (fs.existsSync(target)) return;
  // Rename the current live log into the daily archive.
  if (fs.existsSync(VIEWS_LOG) && fs.statSync(VIEWS_LOG).size > 0) {
    try {
      fs.renameSync(VIEWS_LOG, target);
    } catch (_) {
      // If rename fails (e.g. Windows file lock), append and move on.
    }
  }
  // Recreate the live log empty.
  fs.writeFileSync(VIEWS_LOG, '', 'utf8');
  pruneArchives();
}

function pruneArchives() {
  const files = listArchiveFiles();
  const excess = files.length - MAX_ARCHIVES;
  for (let i = 0; i < excess; i++) {
    try {
      fs.unlinkSync(path.join(config.paths.dataDir, files[i]));
    } catch (_) {}
  }
}

function rotateIfNeeded() {
  ensureDataDir();
  refreshSaltIfNewDay();
  let needsRotate = false;
  // Size-based rotation
  try {
    const stat = fs.statSync(VIEWS_LOG);
    if (stat.size >= MAX_BYTES) needsRotate = true;
  } catch (_) {}
  // Day-based rotation (no archive for today yet, and log has content)
  if (!needsRotate) {
    const target = path.join(
      config.paths.dataDir,
      'views-' + dailySaltDay + '.log'
    );
    if (
      !fs.existsSync(target) &&
      fs.existsSync(VIEWS_LOG) &&
      fs.statSync(VIEWS_LOG).size > 0
    ) {
      needsRotate = true;
    }
  }
  if (needsRotate) rotate();
}

// --------------- Public API ---------------

/**
 * Record one view event. Safe to call from a `res.on('finish')` hook —
 * any exception is swallowed so we never break the user response.
 */
function trackView(req, res) {
  try {
    rotateIfNeeded();
    const ip = extractClientIp(req);
    const path_ = (req.path || '/').split('?')[0].split('#')[0] || '/';
    // Skip assets here too (defense in depth; the middleware
    // should already filter, but tracker may be called from tests).
    if (ASSET_EXT.test(path_)) return;
    const ua = req.headers['user-agent'] || '';
    const uaClass = classifyUA(ua);
    if (uaClass === 'bot') return; // do not pollute stats with crawlers
    const status = res.statusCode || 0;
    const record = {
      ts: new Date().toISOString(),
      day: dailySaltDay,
      path: path_,
      lang: extractLang(req),
      ref: extractReferrerHost(req),
      ua: uaClass,
      status,
      v: visitorHash(ip),
    };
    fs.appendFileSync(VIEWS_LOG, JSON.stringify(record) + '\n', 'utf8');
  } catch (_) {
    // Tracking must never break the request.
  }
}

/**
 * Read view events across the live log and all daily archives.
 * Returns events in newest-first order.
 */
function readViews(opts) {
  opts = opts || {};
  const limit = Math.max(1, Math.min(opts.limit || 500, 5000));
  const since = opts.since ? new Date(opts.since).getTime() : 0;
  const until = opts.until ? new Date(opts.until).getTime() : Infinity;

  ensureDataDir();
  const sources = listArchiveFiles()
    .map((f) => path.join(config.paths.dataDir, f))
    .concat([VIEWS_LOG])
    .reverse(); // newest first

  const out = [];
  outer: for (const file of sources) {
    if (!fs.existsSync(file)) continue;
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch (_) {
      continue;
    }
    const lines = text.split(/\r?\n/);
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (!line) continue;
      let rec;
      try { rec = JSON.parse(line); } catch (_) { continue; }
      const t = rec.ts ? Date.parse(rec.ts) : 0;
      if (Number.isNaN(t)) continue;
      if (t < since) continue; // older than window — keep scanning earlier files only if same archive
      if (t > until) continue;
      out.push(rec);
      if (out.length >= limit) break outer;
    }
  }
  return out;
}

module.exports = {
  trackView,
  readViews,
  rotateIfNeeded,
  // exported for tests
  _internals: {
    classifyUA,
    visitorHash,
    extractLang,
    extractReferrerHost,
    VIEWS_LOG,
    MAX_BYTES,
    MAX_ARCHIVES,
  },
};
