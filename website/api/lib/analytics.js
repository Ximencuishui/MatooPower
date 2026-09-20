/**
 * Matoo Admin API · Analytics aggregator
 *
 * Pure read-only aggregation over:
 *   - tracker.readViews()  (api/data/views*.log)
 *   - logger.readAll()     (api/data/audit.log)
 *
 * Two entry points:
 *   summary({ since, until })      → browsing KPIs and breakdowns
 *   loginStats({ since, until })   → auth event KPIs and IP rankings
 *
 * 30-second in-memory cache keeps the front-end snappy without
 * hammering the disk on every refresh.
 */
'use strict';

const crypto = require('crypto');
const logger = require('./logger');
const tracker = require('./tracker');

const CACHE_TTL_MS = 30 * 1000;
const cache = new Map(); // key -> { expires, value }

// Display salt for IP short-hashes. Rotates on process restart; never
// persisted, so an operator restarting the server cannot reverse-look
// historical logs without re-reading them in real time.
const IP_DISPLAY_SALT = crypto.randomBytes(8).toString('hex');

function maskIp(ip) {
  if (!ip) return '';
  // 4-char prefix of scrypt digest. Enough to distinguish a small set
  // of addresses in the Top-N list, not enough to recover the original.
  try {
    const d = crypto
      .scryptSync(String(ip), IP_DISPLAY_SALT, 4, { N: 16384, r: 8, p: 1 })
      .toString('hex');
    return 'ip_' + d;
  } catch (_) {
    return 'ip_????';
  }
}

function cached(key, build) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = build();
  cache.set(key, { expires: Date.now() + CACHE_TTL_MS, value });
  return value;
}

// --------------- Range resolution ---------------

const RANGE_PRESETS = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

function resolveRange(range) {
  if (!range || range === 'all') {
    return { since: 0, until: Infinity };
  }
  const span = RANGE_PRESETS[range];
  if (!span) {
    return { since: Date.now() - RANGE_PRESETS['24h'], until: Infinity };
  }
  return { since: Date.now() - span, until: Infinity };
}

// --------------- Browsing summary ---------------

function summarizeViews(events) {
  const total = events.length;
  let error = 0;
  const visitors = new Set();
  const pages = new Set();
  const byDay = new Map(); // day -> { views, visitors:Set }
  const topPages = new Map();
  const topLangs = new Map();
  const topRefs = new Map();
  const topUA = new Map();
  const status = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 };

  for (const e of events) {
    if (typeof e.status === 'number') {
      const s = Math.floor(e.status / 100);
      if (status[s + 'xx'] !== undefined) status[s + 'xx']++;
      if (s >= 4) error++;
    }
    if (e.v) visitors.add(e.day + ':' + e.v);
    if (e.path) {
      pages.add(e.path);
      topPages.set(e.path, (topPages.get(e.path) || 0) + 1);
    }
    if (e.day) {
      const d = byDay.get(e.day) || { views: 0, visitors: new Set() };
      d.views++;
      if (e.v) d.visitors.add(e.v);
      byDay.set(e.day, d);
    }
    if (e.lang) topLangs.set(e.lang, (topLangs.get(e.lang) || 0) + 1);
    if (e.ref) topRefs.set(e.ref, (topRefs.get(e.ref) || 0) + 1);
    if (e.ua) topUA.set(e.ua, (topUA.get(e.ua) || 0) + 1);
  }

  const byDayArr = Array.from(byDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, v]) => ({ date: day, views: v.views, visitors: v.visitors.size }));

  function toSorted(map, limit) {
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([k, v]) => ({ key: k, count: v }));
  }

  return {
    totalViews: total,
    uniqueVisitors: visitors.size,
    uniquePages: pages.size,
    errorRate: total > 0 ? error / total : 0,
    byDay: byDayArr,
    topPages: toSorted(topPages, 10),
    topLangs: toSorted(topLangs, 8),
    topReferrers: toSorted(topRefs, 8),
    uaClasses: toSorted(topUA, 6),
    statusBreakdown: status,
  };
}

function summary(opts) {
  opts = opts || {};
  const range = opts.range || '24h';
  const { since, until } = resolveRange(range);
  const cacheKey = 'summary:' + range + ':' + since + ':' + until;
  return cached(cacheKey, () => {
    const events = tracker.readViews({ since, until, limit: 5000 });
    return summarizeViews(events);
  });
}

// --------------- Login stats ---------------

function classifyAuthEvent(entry) {
  // Older entries may have target = just an IP (no UA suffix).
  // We never throw on schema variance — defensive parsing only.
  const action = entry.action || '';
  const target = entry.target || '';
  // ip is whatever precedes the first "@" (if UA was appended) or
  // the whole target if no UA was attached.
  const ip = target.includes('@') ? target.split('@')[0] : target;
  return { action, ip };
}

function summarizeAuth(entries) {
  let logins = 0;
  let fails = 0;
  const byDay = new Map(); // day -> { logins, fails }
  const recentLogins = [];
  const recentFails = [];
  const failIps = new Map();
  const successIps = new Map();

  // We want newest-first; logger.readAll() already returns newest first.
  for (const e of entries) {
    if (!e || !e.action) continue;
    if (!/^auth\./.test(e.action)) continue;
    const ts = e.ts ? Date.parse(e.ts) : 0;
    if (Number.isNaN(ts)) continue;
    const day = (e.ts || '').slice(0, 10);
    const d = byDay.get(day) || { logins: 0, fails: 0 };
    const cls = classifyAuthEvent(e);
    if (e.action === 'auth.login') {
      logins++;
      d.logins++;
      if (cls.ip) successIps.set(cls.ip, (successIps.get(cls.ip) || 0) + 1);
      if (recentLogins.length < 20) recentLogins.push(e);
    } else if (e.action === 'auth.fail') {
      fails++;
      d.fails++;
      if (cls.ip) failIps.set(cls.ip, (failIps.get(cls.ip) || 0) + 1);
      if (recentFails.length < 20) recentFails.push(e);
    } else if (e.action === 'auth.logout') {
      // not counted in KPI but we keep timeline accurate
    }
    byDay.set(day, d);
  }

  const byDayArr = Array.from(byDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({ date, logins: v.logins, fails: v.fails }));

  function toSorted(map, limit) {
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([ip, count]) => ({ ip: maskIp(ip), count }));
  }

  return {
    totalLogins: logins,
    totalFails: fails,
    failRate: logins + fails > 0 ? fails / (logins + fails) : 0,
    byDay: byDayArr,
    recentLogins,
    recentFails,
    topFailIps: toSorted(failIps, 10),
    topSuccessIps: toSorted(successIps, 10),
  };
}

function loginStats(opts) {
  opts = opts || {};
  const range = opts.range || '24h';
  const { since, until } = resolveRange(range);
  const cacheKey = 'logins:' + range + ':' + since + ':' + until;
  return cached(cacheKey, () => {
    // logger.readAll caps at limit; pull 1000 to give a generous
    // historical window for the 7d/30d ranges.
    const entries = logger.readAll(1000).filter((e) => {
      const t = e && e.ts ? Date.parse(e.ts) : 0;
      if (Number.isNaN(t)) return false;
      return t >= since && t <= until;
    });
    return summarizeAuth(entries);
  });
}

module.exports = {
  summary,
  loginStats,
  resolveRange,
  // exported for tests
  _internals: {
    summarizeViews,
    summarizeAuth,
    CACHE_TTL_MS,
  },
};
