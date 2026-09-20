#!/usr/bin/env node
/**
 * Matoo Power · i18n data block injector
 *
 * Scans every *.html under website/ and:
 *   - Ensures an <script id="i18n-data" type="application/json"> block exists
 *     and contains entries for every supported language (en, zh, bn, ja, ko,
 *     vi, hi, ur, ta, te, ar, fr, pt, es).
 *   - For languages that exist as i18n/<lang>.json, the JSON content is
 *     embedded (and stripped of its BOM). For missing languages, an empty
 *     object {} is embedded (front-end falls back to English per-key).
 *
 * Safe to re-run; existing translations are preserved.
 *
 * Usage:
 *   node inject-i18n-blocks.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const I18N_DIR = path.join(ROOT, 'i18n');
const LANGS = ['en', 'zh', 'bn', 'ja', 'ko', 'vi', 'hi', 'ur', 'ta', 'te', 'ar', 'fr', 'pt', 'es'];

function listHtml() {
  const out = [];
  for (const f of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (f.isFile() && f.name.toLowerCase().endsWith('.html')) out.push(path.join(ROOT, f.name));
  }
  return out;
}

function readJsonBOM(file) {
  const raw = fs.readFileSync(file, 'utf8');
  return raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
}

function ensureBlock(html, langBlocks) {
  const startMarker = '<script id="i18n-data" type="application/json">';
  const endMarker = '</script>';
  const startIdx = html.indexOf(startMarker);
  if (startIdx === -1) {
    // Inject before </body>
    const bodyClose = html.lastIndexOf('</body>');
    if (bodyClose === -1) return html;
    const block = startMarker + '\n' + langBlocks.join(',\n') + '\n  </script>';
    return html.slice(0, bodyClose) + '\n  ' + block + '\n\n' + html.slice(bodyClose);
  }
  const endIdx = html.indexOf(endMarker, startIdx);
  if (endIdx === -1) return html;
  // Replace inner content
  const before = html.slice(0, startIdx + startMarker.length);
  const after = html.slice(endIdx);
  return before + '\n' + langBlocks.join(',\n') + '\n  ' + after;
}

function buildLangBlocks() {
  const out = [];
  for (const lang of LANGS) {
    const file = path.join(I18N_DIR, lang + '.json');
    let json;
    if (fs.existsSync(file)) {
      json = readJsonBOM(file).trim();
    } else {
      json = '{}';
    }
    out.push('    "' + lang + '": ' + json);
  }
  return out;
}

const blocks = buildLangBlocks();
let total = 0;
for (const f of listHtml()) {
  const html = fs.readFileSync(f, 'utf8');
  const next = ensureBlock(html, blocks);
  if (next !== html) {
    fs.writeFileSync(f, next, 'utf8');
    console.log('[ok] ' + path.basename(f));
    total++;
  } else {
    console.log('[skip] ' + path.basename(f) + ' (no change)');
  }
}
console.log('');
console.log('Updated ' + total + ' HTML files.');