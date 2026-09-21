#!/usr/bin/env node
/**
 * Matoo Power · Repair i18n-data blocks using i18n/<lang>.json as truth.
 *
 * Several historical cleanup passes introduced small typos in the inline
 * i18n-data blocks (e.g. "Project-based · $1M+" lost its "$1", "USD
 * $100" lost its "$1"). This script re-syncs every language's inline
 * block from the canonical /i18n/<lang>.json, leaving any custom local
 * values alone.
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

function loadLang(lang) {
  const file = path.join(ROOT, 'i18n', lang + '.json');
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return null; }
}

// Walk both objects; for every key present in both, prefer the value
// from `truth` when the inline one is a "damaged" pattern (missing $,
// missing digit etc.). If the inline value matches the truth exactly,
// leave alone.
function isDamagedPattern(value, truthValue) {
  if (typeof value !== 'string' || typeof truthValue !== 'string') return false;
  if (value === truthValue) return false;
  // Detect missing "$1" style tokens: truth "USD $100" / "· $1M+", inline
  // "USD 100" / "· M+".
  if (/\$\d/.test(truthValue) && !/\$\d/.test(value)) {
    // Truth has $-prefixed number, inline does not → damaged.
    return true;
  }
  return false;
}

let totalFixed = 0;
let filesTouched = 0;

for (const f of HTML_FILES) {
  const full = path.join(ROOT, f);
  if (!fs.existsSync(full)) continue;
  const html = fs.readFileSync(full, 'utf8');
  const re = /<script id="i18n-data"([^>]*)>([\s\S]*?)<\/script>/;
  const m = html.match(re);
  if (!m) continue;
  let dict;
  try { dict = JSON.parse(m[2]); }
  catch (e) { console.error('  [parse-error] ' + f + ' ' + e.message); continue; }
  let repaired = 0;
  for (const lang of SUPPORTED) {
    const truth = loadLang(lang);
    if (!dict[lang] || !truth) continue;
    (function walk(inline, truthNode, p) {
      if (!inline || !truthNode || typeof inline !== 'object' || typeof truthNode !== 'object') return;
      for (const [k, tv] of Object.entries(truthNode)) {
        if (k === '_meta') continue;
        const cur = [...p, k].join('.');
        if (typeof tv === 'string') {
          const iv = inline[k];
          if (isDamagedPattern(iv, tv)) {
            inline[k] = tv;
            repaired++;
          }
        } else if (tv && typeof tv === 'object') {
          if (!inline[k] || typeof inline[k] !== 'object') inline[k] = {};
          walk(inline[k], tv, [...p, k]);
        }
      }
    })(dict[lang], truth, []);
  }
  if (repaired > 0) {
    const newJson = JSON.stringify(dict, null, 2);
    const newBlock = '<script id="i18n-data"' + m[1] + '>' + newJson + '</script>';
    // IMPORTANT: use function form to avoid $N backreference interpretation.
    const newHtml = html.replace(re, function () { return newBlock; });
    fs.writeFileSync(full, newHtml, 'utf8');
    filesTouched++;
    totalFixed += repaired;
    console.log('  [repair] ' + f + ' +' + repaired);
  }
}
console.log('');
console.log('Total: ' + totalFixed + ' values repaired across ' + filesTouched + ' files.');
