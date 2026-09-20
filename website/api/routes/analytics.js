/**
 * Matoo Admin API · Analytics routes
 *
 * Read-only endpoints serving the Overview dashboard.
 *   GET /api/analytics/summary?range=24h|7d|30d|all
 *   GET /api/analytics/logins?range=24h|7d|30d|all
 *   GET /api/analytics/views?range=...&limit=...
 */
'use strict';

const express = require('express');
const analytics = require('../lib/analytics');
const tracker = require('../lib/tracker');
const { requireAuth } = require('./auth');

const router = express.Router();

const VALID_RANGES = new Set(['24h', '7d', '30d', 'all']);

function normaliseRange(req) {
  const r = String(req.query.range || '24h');
  return VALID_RANGES.has(r) ? r : '24h';
}

router.get('/summary', requireAuth('read'), (req, res) => {
  const range = normaliseRange(req);
  res.json({ ok: true, range, data: analytics.summary({ range }) });
});

router.get('/logins', requireAuth('read'), (req, res) => {
  const range = normaliseRange(req);
  res.json({ ok: true, range, data: analytics.loginStats({ range }) });
});

router.get('/views', requireAuth('read'), (req, res) => {
  const range = normaliseRange(req);
  const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 100, 500));
  const { since, until } = analytics.resolveRange(range);
  const items = tracker.readViews({ since, until, limit });
  res.json({ ok: true, range, count: items.length, items });
});

module.exports = router;
