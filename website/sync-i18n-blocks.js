#!/usr/bin/env node
/**
 * Matoo Power · Re-inject i18n/<lang>.json into inline i18n-data blocks
 *
 * Rebuilds the inline <script id="i18n-data"> JSON in each HTML page
 * by re-running the standard inject pattern: keep en inline, and
 * ensure every other language has the same key set as en (filling from
 * en fallback if absent).
 *
 * This is the bridge that makes changes to i18n/<lang>.json visible
 * to the inline blocks. Idempotent.
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
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function flatKeys(o, prefix = '', out = []) {
  if (!o || typeof o !== 'object') return out;
  for (const [k, v] of Object.entries(o)) {
    if (k === '_meta') continue;
    const f = prefix ? prefix + '.' + k : k;
    if (typeof v === 'string') out.push(f);
    else if (v && typeof v === 'object') flatKeys(v, f, out);
  }
  return out;
}

function getNested(obj, dotted) {
  const parts = dotted.split('.');
  let cur = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

function setNested(obj, dotted, value) {
  const parts = dotted.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

// Compute union of all en keys across all i18n JSON files and HTML blocks.
const enSources = [];
const enFromHtml = [];
for (const lang of SUPPORTED) {
  const j = loadLang(lang);
  if (j) enSources.push({ lang, json: j });
}
for (const f of HTML_FILES) {
  const full = path.join(ROOT, f);
  if (!fs.existsSync(full)) continue;
  const html = fs.readFileSync(full, 'utf8');
  const m = html.match(/<script id="i18n-data"([^>]*)>([\s\S]*?)<\/script>/);
  if (!m) continue;
  try { enFromHtml.push(JSON.parse(m[2])); } catch {}
}

const enKeySet = new Set();
for (const src of enSources) {
  if (src.lang !== 'en') continue;
  for (const k of flatKeys(src.json)) enKeySet.add(k);
}
for (const d of enFromHtml) {
  if (!d.en) continue;
  for (const k of flatKeys(d.en)) enKeySet.add(k);
}
console.log('en reference key count: ' + enKeySet.size);

let totalTouched = 0;
let totalFilled = 0;
for (const f of HTML_FILES) {
  const full = path.join(ROOT, f);
  if (!fs.existsSync(full)) continue;
  const html = fs.readFileSync(full, 'utf8');
  const re = /<script id="i18n-data"([^>]*)>([\s\S]*?)<\/script>/;
  const m = html.match(re);
  if (!m) continue;
  let dict;
  try { dict = JSON.parse(m[2]); }
  catch (e) { console.error('[parse-error] ' + f + ' ' + e.message); continue; }
  if (!dict.en) dict.en = {};
  let filled = 0;
  // Make sure every en key is present in dict.en too (merge from JSON).
  for (const src of enSources) {
    if (src.lang !== 'en') continue;
    for (const k of enKeySet) {
      if (getNested(dict.en, k) !== undefined) continue;
      const v = getNested(src.json, k);
      if (typeof v === 'string') {
        setNested(dict.en, k, v);
        filled++;
      }
    }
  }
  // For each other lang, fill from its JSON or fall back to en.
  for (const lang of SUPPORTED) {
    if (lang === 'en') continue;
    const jsonLang = enSources.find(s => s.lang === lang);
    if (!dict[lang]) dict[lang] = {};
    const have = new Set(flatKeys(dict[lang]));
    for (const k of enKeySet) {
      if (have.has(k)) continue;
      let v = jsonLang ? getNested(jsonLang.json, k) : undefined;
      if (typeof v !== 'string') v = getNested(dict.en, k);
      if (typeof v === 'string') {
        setNested(dict[lang], k, v);
        filled++;
      }
    }
  }
  if (filled > 0) {
    const newJson = JSON.stringify(dict, null, 2);
    const newBlock = '<script id="i18n-data"' + m[1] + '>' + newJson + '</script>';
    // IMPORTANT: use function form to avoid $N backreference interpretation.
    const newHtml = html.replace(re, function () { return newBlock; });
    if (newHtml !== html) {
      fs.writeFileSync(full, newHtml, 'utf8');
      totalTouched++;
      totalFilled += filled;
      console.log('  [fill] ' + f + ' +' + filled);
    }
  }
}
console.log('');
console.log('HTML pages touched: ' + totalTouched + ', total keys filled: ' + totalFilled);
