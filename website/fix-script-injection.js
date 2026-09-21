#!/usr/bin/env node
/**
 * Matoo Power · Fix known script-injection artifacts in i18n-data blocks.
 *
 * Background: a previous template-injection pass left behind literal
 * ` type="application/json"` substrings where a $-prefixed token was
 * meant to appear (e.g. "$1M+" became " type="application/json"M+").
 *
 * This script locates every occurrence inside every i18n-data block
 * and replaces it with a `$` if the surrounding context indicates one
 * was lost (the byte immediately following the artefact was a digit).
 *
 * Idempotent: running again finds nothing to do.
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

// We must operate *only* inside the JSON block (between <script ...> and
// </script>). Outside the block, " type="application/json"" is the
// legitimate script-type attribute.
const SCRIPT_RE = /<script id="i18n-data"([^>]*)>([\s\S]*?)<\/script>/;

// Match the artefact when followed by a digit (e.g. "M+" after "$1M+"
// becomes " type="application/json"M+"). We restore the "$".
const PATTERNS_RESTORE = [
  // " type=\"application/json\"" + digit  → "$" + digit
  { re: / type="application\/json"(\d)/g, repl: '$$$1' },
  // " application/json" + digit            → "$" + digit
  { re: / application\/json(\d)/g, repl: '$$$1' },
];

// Generic artefact removal when no digit follows (truly orphan).
const PATTERNS_STRIP = [
  / type="application\/json"/g,
  / type="application\/ld\+json"/g,
  / type="image\/svg\+xml"/g,
  / application\/json/g,
];

let totalFixed = 0;
let filesTouched = 0;

for (const f of HTML_FILES) {
  const full = path.join(ROOT, f);
  if (!fs.existsSync(full)) continue;
  const html = fs.readFileSync(full, 'utf8');
  const m = html.match(SCRIPT_RE);
  if (!m) continue;
  let block = m[2];
  let fixed = 0;
  // First, restore $-tokens when a digit follows.
  for (const { re, repl } of PATTERNS_RESTORE) {
    re.lastIndex = 0;
    const before = block;
    block = block.replace(re, repl);
    const diff = (before.match(re) || []).length;
    if (diff > 0) fixed += diff;
  }
  // Then strip orphan occurrences (those not followed by digit anymore).
  for (const re of PATTERNS_STRIP) {
    re.lastIndex = 0;
    const before = block;
    block = block.replace(re, '');
    const diff = (before.match(re) || []).length;
    if (diff > 0) fixed += diff;
  }
  if (block !== m[2]) {
    const newBlock = '<script id="i18n-data"' + m[1] + '>' + block + '</script>';
    // IMPORTANT: use function form to avoid $N backreference interpretation.
    const newHtml = html.replace(SCRIPT_RE, function () { return newBlock; });
    fs.writeFileSync(full, newHtml, 'utf8');
    filesTouched++;
    totalFixed += fixed;
    console.log('[fix] ' + f + ' — ' + fixed + ' occurrences touched');
  }
}
console.log('');
console.log('Total: ' + totalFixed + ' artefacts handled in ' + filesTouched + ' files.');
