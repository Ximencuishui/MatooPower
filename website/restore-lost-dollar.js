#!/usr/bin/env node
/**
 * Matoo Power · Restore $1 lost during previous artefact cleanup.
 *
 * Background: An earlier pass deleted ` type="application/json"` from
 * inside i18n-data blocks, but in doing so dropped the `$1` token from
 * values such as `Project-based · $1M+`. The result is `Project-based ·
 * M+`, which is wrong. This script restores the leading `$` whenever a
 * run of characters matches `· ` directly followed by a digit.
 *
 * Idempotent: does not re-add `$` if already present.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname);
const HTML_FILES = [
  'index.html', 'products.html', 'technology.html', 'manufacturing.html',
  'partnership.html', 'insights.html', 'about.html', 'contact.html',
  'privacy.html', 'cookies.html', 'terms.html', 'configurator.html',
];

const SCRIPT_RE = /<script id="i18n-data"([^>]*)>([\s\S]*?)<\/script>/;

// Match " · " followed by a digit but NOT preceded by '$'.
const RE = /(?<!\$)· (\d)/g;

let totalFixed = 0;
let filesTouched = 0;

for (const f of HTML_FILES) {
  const full = path.join(ROOT, f);
  if (!fs.existsSync(full)) continue;
  const html = fs.readFileSync(full, 'utf8');
  const m = html.match(SCRIPT_RE);
  if (!m) continue;
  let block = m[2];
  RE.lastIndex = 0;
  const before = block;
  block = block.replace(RE, '· $$$1');
  const n = (before.match(RE) || []).length;
  if (n > 0) {
    const newBlock = '<script id="i18n-data"' + m[1] + '>' + block + '</script>';
    // IMPORTANT: use function form to avoid $N backreference interpretation.
    const newHtml = html.replace(SCRIPT_RE, function () { return newBlock; });
    fs.writeFileSync(full, newHtml, 'utf8');
    filesTouched++;
    totalFixed += n;
    console.log('[restore] ' + f + ' — ' + n + ' tokens');
  }
}
console.log('');
console.log('Total: ' + totalFixed + ' $ tokens restored in ' + filesTouched + ' files.');
