#!/usr/bin/env node
/**
 * Matoo Power · Remove orphan keys from i18n files
 *
 * After the flatten pass, a few legacy keys in en.json (and its
 * skeleton copies) are no longer referenced by any HTML. Drop them
 * to keep the catalog aligned with the templates.
 *
 * The list of orphan keys is determined by the smoke-test's
 * /api/i18n/audit/keys report. Keep them in sync when the templates
 * introduce new naming.
 */
'use strict';

const { forEachLang, deleteNested } = require('./_lib/i18n-file');

// Orphans confirmed by audit at the time of cleanup.
const ORPHAN_KEYS = [
  'modules.mod1.title', 'modules.mod1.desc', 'modules.mod1.cta',
  'modules.mod2.title', 'modules.mod2.desc', 'modules.mod2.cta',
  'modules.mod3.title', 'modules.mod3.desc', 'modules.mod3.cta',
  'mfg.hero_title', 'mfg.hero_sub',
  'mfg.section1_title', 'mfg.section1_sub',
  'mfg.section2_title', 'mfg.section2_sub',
  'mfg.section3_title', 'mfg.section3_sub',
  'mfg.section4_title', 'mfg.section4_sub',
  'mfg.cta_title', 'mfg.cta_sub', 'mfg.cta_primary', 'mfg.cta_secondary',
  'partnership.hero_title', 'partnership.hero_sub',
  'partnership.section1_title', 'partnership.section1_sub',
  'partnership.section2_title', 'partnership.section2_sub',
  'partnership.section3_title', 'partnership.section3_sub',
  'partnership.section4_title', 'partnership.section4_sub',
  'partnership.cta_title', 'partnership.cta_sub', 'partnership.cta_primary', 'partnership.cta_secondary',
  'insights.hero_title', 'insights.hero_sub',
  'insights.section1_title', 'insights.section1_sub',
  'insights.newsletter_sub',
  'privacy.hero_title', 'privacy.hero_sub',
  'cookies_page.hero_title', 'cookies_page.hero_sub',
  'terms_page.hero_title', 'terms_page.hero_sub',
];

// Safety whitelist: even if a key appears in ORPHAN_KEYS, never
// delete it here. The ORPHAN_KEYS list was captured at a single
// audit moment; if HTML later rebinds one of those keys (e.g. the
// insights newsletter block was retrofitted to data-i18n="insights.
// section2_*" / "insights.subscribe") the catalog must survive
// subsequent prunes. Add rebinds here rather than just editing
// ORPHAN_KEYS, so the historical intent stays auditable.
const PROTECTED_KEYS = new Set([
  'insights.section2_title',
  'insights.section2_sub',
  'insights.subscribe',
]);

let totalDeleted = 0;
let filesTouched = 0;

forEachLang(({ lang, json }) => {
  let deleted = 0;
  for (const k of ORPHAN_KEYS) {
    if (PROTECTED_KEYS.has(k)) continue;
    if (deleteNested(json, k)) deleted++;
  }
  if (deleted > 0) {
    filesTouched++;
    totalDeleted += deleted;
    console.log('[ok]   ' + lang + ' (' + deleted + ' removed)');
  }
});

console.log('');
console.log('Removed ' + totalDeleted + ' orphan keys from ' + filesTouched + ' files.');