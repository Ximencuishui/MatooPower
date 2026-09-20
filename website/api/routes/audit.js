/**
 * Matoo Admin API · Audit log routes
 */
'use strict';

const express = require('express');
const logger = require('../lib/logger');
const { requireAuth } = require('./auth');

const router = express.Router();

router.get('/', requireAuth('read'), (req, res) => {
  const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 200, 1000));
  const action = req.query.action ? String(req.query.action) : null;
  let items = logger.readAll(limit);
  if (action) items = items.filter((it) => (it.action || '').startsWith(action));
  res.json({ ok: true, items });
});

module.exports = router;