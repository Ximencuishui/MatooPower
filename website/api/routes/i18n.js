/**
 * Matoo Admin API · i18n routes
 */
'use strict';

const express = require('express');
const store = require('../lib/store');
const scanner = require('../lib/scanner');
const logger = require('../lib/logger');
const { requireAuth } = require('./auth');

const router = express.Router();

router.get('/', requireAuth('read'), (req, res) => {
  const out = {};
  for (const lang of store.SUPPORTED_LANGS) {
    try { out[lang] = store.readI18n(lang); } catch (e) { out[lang] = {}; }
  }
  res.json({ ok: true, data: out });
});

router.get('/:lang', requireAuth('read'), (req, res) => {
  const { lang } = req.params;
  if (!store.isSupportedLang(lang)) return res.status(400).json({ ok: false, code: 'INVALID_INPUT', message: 'Unsupported language' });
  try {
    res.json({ ok: true, lang, data: store.readI18n(lang) });
  } catch (e) {
    res.status(500).json({ ok: false, code: 'STORAGE_ERROR', message: e.message });
  }
});

router.put('/:lang/:key(*)', requireAuth('write'), (req, res) => {
  const { lang, key } = req.params;
  if (!store.isSupportedLang(lang)) return res.status(400).json({ ok: false, code: 'INVALID_INPUT' });
  const value = req.body ? req.body.value : undefined;
  if (typeof value !== 'string') {
    return res.status(400).json({ ok: false, code: 'INVALID_INPUT', message: 'value (string) required' });
  }
  try {
    const result = store.updateTranslation(lang, key, value);
    logger.log({
      user: 'admin',
      action: 'i18n.update',
      target: lang + '@' + key,
      before: result.before,
      after: result.after,
    });
    res.json({ ok: true, lang, key, value });
  } catch (err) {
    if (err.httpStatus) return res.status(err.httpStatus).json({ ok: false, code: err.code, message: err.message });
    res.status(500).json({ ok: false, code: 'STORAGE_ERROR', message: err.message });
  }
});

router.get('/audit/keys', requireAuth('read'), (req, res) => {
  const { usedKeys } = scanner.buildKeyIndex();
  // For each language, compute keys present vs keys used by HTML
  const langKeys = {};
  for (const lang of store.SUPPORTED_LANGS) {
    try { langKeys[lang] = new Set(store.flattenKeys(store.readI18n(lang))); }
    catch (_) { langKeys[lang] = new Set(); }
  }
  const used = new Set(usedKeys.keys());

  const missing = []; // used in HTML but missing in ALL languages
  const missingPartial = []; // used in HTML but missing in at least one language
  const orphan = [];  // exists in lang but not used in HTML
  const onlyInLang = {}; // lang -> array of keys

  for (const lang of store.SUPPORTED_LANGS) {
    const have = langKeys[lang];
    const langOnly = [];
    for (const k of have) {
      if (!used.has(k)) langOnly.push(k);
    }
    onlyInLang[lang] = langOnly;
  }

  for (const k of used) {
    const missingIn = store.SUPPORTED_LANGS.filter((l) => !langKeys[l].has(k));
    if (missingIn.length === store.SUPPORTED_LANGS.length) {
      missing.push({ key: k, usedIn: Array.from(usedKeys.get(k) || []) });
    } else if (missingIn.length > 0) {
      missingPartial.push({ key: k, missingIn, usedIn: Array.from(usedKeys.get(k) || []) });
    }
  }

  // Truly orphan = exists in some lang but never used anywhere
  for (const lang of store.SUPPORTED_LANGS) {
    for (const k of onlyInLang[lang]) {
      const usedAnywhere = used.has(k);
      if (!usedAnywhere) {
        if (!orphan.find((o) => o.key === k)) orphan.push({ key: k });
      }
    }
  }

  res.json({
    ok: true,
    usedKeys: Array.from(usedKeys.entries()).map(([key, files]) => ({ key, files: Array.from(files) })),
    missing,         // all languages missing
    missingPartial,  // at least one language missing (operator-facing)
    orphan,
    onlyInLang,
  });
});

router.get('/backups/:lang', requireAuth('read'), (req, res) => {
  const { lang } = req.params;
  if (!store.isSupportedLang(lang)) return res.status(400).json({ ok: false, code: 'INVALID_INPUT' });
  res.json({ ok: true, lang, backups: store.listBackups(lang) });
});

router.post('/restore/:lang', requireAuth('write'), (req, res) => {
  const { lang } = req.params;
  const { backup } = req.body || {};
  if (!backup) return res.status(400).json({ ok: false, code: 'INVALID_INPUT' });
  try {
    store.restoreBackup(lang, backup);
    logger.log({ user: 'admin', action: 'i18n.restore', target: lang + '@' + backup });
    res.json({ ok: true });
  } catch (err) {
    if (err.httpStatus) return res.status(err.httpStatus).json({ ok: false, code: err.code, message: err.message });
    res.status(500).json({ ok: false, code: 'STORAGE_ERROR', message: err.message });
  }
});

module.exports = router;