#!/usr/bin/env node
/**
 * Matoo Power · Prune corrupted values from inline i18n-data blocks.
 *
 * Same logic as prune-mojibake.js but operates on the inline
 * <script id="i18n-data"> block inside each of the 12 main HTML pages.
 * Never touches any HTML outside the block (e.g. legitimate
 * `type="application/json"` script-type attribute).
 *
 * Idempotent.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname);
const SUPPORTED = ['en','zh','bn','ja','ko','vi','hi','ur','ta','te','ar','fr','pt','es'];
const HTML_FILES = [
  'index.html', 'products.html', 'technology.html', 'manufacturing.html',
  'partnership.html', 'insights.html', 'about.html', 'contact.html',
  'privacy.html', 'cookies.html', 'terms.html', 'configurator.html',
];
const SCRIPT_RE = /<script id="i18n-data"([^>]*)>([\s\S]*?)<\/script>/;

const PATTERNS = {
  ZQX: /\bZQX\s*\d/,
  QX: /\bQX\d{2,3}[A-Z]?\b/,
  PHONE_XXXX: /X{4,}/,
  REPLACEMENT: /\ufffd/,
  PUA: /[\ue000-\uf8ff]/,
  GARBLED_HASH: /^#[A-Z\^\\\[\]\?]{4,}/,
  LEGAL_NAME_OK: /深圳华溢智能科技|新加坡华溢科技|华溢科技/,
};

function isCorrupt(value, lang) {
  if (typeof value !== 'string') return false;
  if (PATTERNS.REPLACEMENT.test(value)) return true;
  if (PATTERNS.PUA.test(value)) return true;
  if (PATTERNS.GARBLED_HASH.test(value)) return true;
  if (PATTERNS.ZQX.test(value)) return true;
  if (PATTERNS.QX.test(value)) return true;
  if (PATTERNS.PHONE_XXXX.test(value)) return true;
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
      removed += prune(v, lang, [...prefix, k]);
      if (Object.keys(v).length === 0) delete obj[k];
    }
  }
  return removed;
}

let total = 0;
let touched = 0;
for (const f of HTML_FILES) {
  const full = path.join(ROOT, f);
  if (!fs.existsSync(full)) continue;
  const html = fs.readFileSync(full, 'utf8');
  const m = html.match(SCRIPT_RE);
  if (!m) continue;
  let dict;
  try { dict = JSON.parse(m[2]); }
  catch (e) { console.error('  [parse-error] ' + f + ' ' + e.message); continue; }
  let removed = 0;
  for (const lang of SUPPORTED) {
    if (!dict[lang]) continue;
    removed += prune(dict[lang], lang);
  }
  if (removed > 0) {
    const newJson = JSON.stringify(dict, null, 2);
    const newBlock = '<script id="i18n-data"' + m[1] + '>' + newJson + '</script>';
    // IMPORTANT: use function form of replace to avoid $N backreference
    // interpretation (where $1 expands to `[^>]*` = ` type="application/json"`).
    const newHtml = html.replace(SCRIPT_RE, function () { return newBlock; });
    fs.writeFileSync(full, newHtml, 'utf8');
    touched++;
    total += removed;
    console.log('[write] ' + f + ' (-' + removed + ')');
  }
}
console.log('Removed ' + total + ' corrupted keys from ' + touched + ' HTML blocks.');
