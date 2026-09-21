/**
 * Matoo Admin API · Site settings routes
 *
 *   GET  /api/settings         public (no auth) — used by website main.js
 *   GET  /api/settings/admin   admin only — returns full schema with metadata
 *   PUT  /api/settings         admin only — body = { settings }, writes atomically
 *
 * Public GET intentionally returns a narrow shape (no secret material).
 * Admin GET returns the full document so the form can render every key.
 */
'use strict';

const express = require('express');
const settingsLib = require('../lib/settings');
const logger = require('../lib/logger');
const { requireAuth } = require('./auth');

const router = express.Router();

/**
 * Public projection — only what the front-end needs to render the
 * footer / WhatsApp CTA / social URLs. No secrets, no admin-only fields.
 */
function publicProjection(s) {
  return {
    whatsapp: {
      enabled: s.whatsapp.enabled !== false,
      number: s.whatsapp.number,
      defaultMessage: s.whatsapp.defaultMessage,
      byRegion: s.whatsapp.byRegion || {},
      // disabledInProd only honoured in the production admin rewrite.
      // Public visitors never see this flag — the rewrite logic is
      // shipped in scripts/whatsapp-config.js and gates itself.
    },
    contact: {
      email: s.contact.email,
      wechatId: s.contact.wechatId,
      wechatQrUrl: s.contact.wechatQrUrl,
      phones: s.contact.phones || [],
      hqLine: s.contact.hqLine,
      address: s.contact.address || {},
    },
    social: s.social || {},
    legalEntity: s.legalEntity || {},
    meta: {
      siteName: s.meta.siteName,
      tagline: s.meta.tagline,
      responseSlaHours: s.meta.responseSlaHours,
    },
  };
}

router.get('/', (req, res) => {
  try {
    const s = settingsLib.read();
    res.json({ ok: true, data: publicProjection(s) });
  } catch (e) {
    res.status(500).json({ ok: false, code: 'STORAGE_ERROR', message: e.message });
  }
});

router.get('/admin', requireAuth('read'), (req, res) => {
  try {
    const s = settingsLib.read();
    res.json({
      ok: true,
      data: s,
      defaults: settingsLib.DEFAULT_SETTINGS,
      file: settingsLib.SETTINGS_FILE,
    });
  } catch (e) {
    res.status(500).json({ ok: false, code: 'STORAGE_ERROR', message: e.message });
  }
});

router.put('/', requireAuth('write'), (req, res) => {
  const next = req.body && req.body.settings;
  if (!next || typeof next !== 'object') {
    return res.status(400).json({ ok: false, code: 'INVALID_INPUT', message: 'settings (object) required' });
  }
  const errors = settingsLib.validate(next);
  if (errors.length) {
    return res.status(400).json({ ok: false, code: 'INVALID_INPUT', message: errors.join('; ') });
  }
  try {
    const before = settingsLib.read();
    const after = settingsLib.write(next);
    const diffs = settingsLib.diff(before, after);
    logger.log({
      user: 'admin',
      action: 'settings.update',
      target: 'site',
      after: diffs.slice(0, 20).join(' | ').slice(0, 800),
    });
    res.json({ ok: true, data: after, diffs });
  } catch (e) {
    res.status(500).json({ ok: false, code: 'STORAGE_ERROR', message: e.message });
  }
});

/**
 * Reset endpoint — restores defaults. Two-step confirmation in the UI;
 * here it's a plain write of DEFAULT_SETTINGS.
 */
router.post('/reset', requireAuth('write'), (req, res) => {
  try {
    const before = settingsLib.read();
    const after = settingsLib.write(settingsLib.DEFAULT_SETTINGS);
    logger.log({
      user: 'admin',
      action: 'settings.reset',
      target: 'site',
      before: Object.keys(before).join(','),
      after: Object.keys(after).join(','),
    });
    res.json({ ok: true, data: after });
  } catch (e) {
    res.status(500).json({ ok: false, code: 'STORAGE_ERROR', message: e.message });
  }
});

module.exports = router;
