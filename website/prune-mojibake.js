#!/usr/bin/env node
/**
 * Matoo Power · Prune corrupted values from i18n JSON files only.
 *
 * Targets a small set of unambiguous corruption patterns:
 *   - ZQX / QX-style placeholders
 *   - XXXX phone placeholders (4+ X)
 *   - U+FFFD replacement chars
 *   - PUA codepoints
 *   - Bogus hash-prefixed garbled values
 *
 * Conservative: preserves legitimate accented Latin and middle-dot
 * bullets. NEVER touches inline i18n-data blocks inside HTML files —
 * those are handled by fix-script-injection.js.
 *
 * Idempotent.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { forEachLang, writeIfChanged } = require('./_lib/i18n-file');

const PATTERNS = {
  ZQX: /\bZQX\s*\d/,
  QX: /\bQX\d{2,3}[A-Z]?\b/,
  PHONE_XXXX: /X{4,}/,
  REPLACEMENT: /\ufffd/,
  PUA: /[\ue000-\uf8ff]/,
  GARBLED_HASH: /^#[A-Z\^\\\[\]\?]{4,}/,
  LEGAL_NAME_OK: /深圳华溢智能科技|新加坡华溢科技|华溢科技/,
  RANDOM_TAIL_PLACEHOLDER: /_(?:rd|tx|wi|pn|qv|wd)\b.*?(?:ZQX|QX\d)/,
};

function isCorrupt(value, lang) {
  if (typeof value !== 'string') return false;
  if (PATTERNS.REPLACEMENT.test(value)) return true;
  if (PATTERNS.PUA.test(value)) return true;
  if (PATTERNS.GARBLED_HASH.test(value)) return true;
  if (PATTERNS.ZQX.test(value)) return true;
  if (PATTERNS.QX.test(value)) return true;
  if (PATTERNS.PHONE_XXXX.test(value)) return true;
  if (PATTERNS.RANDOM_TAIL_PLACEHOLDER.test(value)) return true;
  if (lang !== 'zh' && /[一-鿿]/.test(value) && !PATTERNS.LEGAL_NAME_OK.test(value)) return true;
  return false;
}

function prune(obj, lang, prefix = []) {
  if (!obj || typeof obj !== 'object') return 0;
  let removed = 0;
  for (const [k, v] of Object.entries(obj)) {
    if (k === '_meta') continue;
    if (typeof v === 'string') {
      if (isCorrupt(v, lang)) {
        delete obj[k];
        removed++;
        const short = v.length > 60 ? v.slice(0, 57) + '...' : v;
        console.log('  [del] ' + lang + '.' + [...prefix, k].join('.') + ' = ' + JSON.stringify(short));
      }
    } else if (v && typeof v === 'object') {
      const sub = prune(v, lang, [...prefix, k]);
      removed += sub;
      if (Object.keys(v).length === 0) delete obj[k];
    }
  }
  return removed;
}

let total = 0;
let touched = 0;
console.log('--- Prune i18n/<lang>.json files ---');
forEachLang(({ lang, file, json }) => {
  const n = prune(json, lang);
  if (n > 0) {
    touched++;
    total += n;
    if (writeIfChanged(file, json)) console.log('  [write] ' + path.basename(file));
  }
});
console.log('Removed ' + total + ' corrupted keys from ' + touched + ' files.');
