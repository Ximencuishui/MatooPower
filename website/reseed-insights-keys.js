#!/usr/bin/env node
/**
 * Matoo Power · Re-seed insights.* after the HTML was updated
 *
 * The insights.html newsletter block now binds:
 *   data-i18n="insights.section2_title"
 *   data-i18n="insights.section2_sub"
 *   data-i18n="insights.subscribe"
 *
 * After the orphan prune, these were missing. Re-seed using the
 * original en.json values, copying into all 14 language files.
 *
 * Idempotent: existing translations are preserved.
 */
'use strict';

const { forEachLang } = require('./_lib/i18n-file');

const SEEDS = {
  en: { section2_title: 'Get Insights Monthly',
        section2_sub:   'One curated email per month. No spam. Unsubscribe anytime.',
        subscribe:      'Subscribe' },
  zh: { section2_title: '每月获取文章',
        section2_sub:   '每月一封精选邮件。无垃圾信息，随时退订。',
        subscribe:      '订阅' },
  bn: { section2_title: 'মাসিক অন্তর্দৃষ্টি পান',
        section2_sub:   'মাসে একটি নির্বাচিত ইমেল। স্প্যাম নেই। যেকোনো সময় আনসাবস্ক্রাইব করুন।',
        subscribe:      'সাবস্ক্রাইব' },
};

function seedFor(lang) {
  return SEEDS[lang] || SEEDS.en;
}

let totalTouched = 0;

forEachLang(({ lang, json }) => {
  if (!json.insights) json.insights = {};
  const seed = seedFor(lang);
  let changed = false;
  for (const [k, v] of Object.entries(seed)) {
    if (json.insights[k] !== v) {
      json.insights[k] = v;
      changed = true;
    }
  }
  if (changed) {
    totalTouched++;
    console.log('[ok]   ' + lang);
  }
});

console.log('');
console.log('Re-seeded insights.* in ' + totalTouched + ' files.');